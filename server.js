const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const { notifyPayment, getAdminNotifications, markNotificationAsRead } = require('./notifications');
const aiMatchesService = require('./ai-matches-service');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Store for demo (replace with database in production)
const users = {};
const transactions = {};

// ============================================
// M-PESA CONFIGURATION
// ============================================
const MPESA_CONFIG = {
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  businessShortCode: process.env.MPESA_BUSINESS_SHORT_CODE,
  lipaNaMpesaOnlinePasskey: process.env.MPESA_PASSKEY,
  mpesaApiUrl: process.env.MPESA_API_URL || 'https://sandbox.safaricom.co.ke',
  callbackUrl: process.env.CALLBACK_URL || 'http://your-domain.com/api/mpesa/callback',
};

// ============================================
// GET M-PESA ACCESS TOKEN
// ============================================
async function getMpesaAccessToken() {
  try {
    const auth = Buffer.from(
      `${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`
    ).toString('base64');

    const response = await axios.get(
      `${MPESA_CONFIG.mpesaApiUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting M-Pesa access token:', error);
    throw error;
  }
}

// ============================================
// AI MATCHES API ENDPOINTS
// ============================================

/**
 * GET /api/matches/live
 * Fetch all live matches with AI-generated odds
 */
app.get('/api/matches/live', async (req, res) => {
  try {
    const liveMatches = await aiMatchesService.fetchLiveMatches();
    res.json({
      success: true,
      count: liveMatches.length,
      matches: liveMatches,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error fetching live matches:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching live matches',
      error: error.message,
    });
  }
});

/**
 * GET /api/matches/upcoming
 * Fetch upcoming matches
 */
app.get('/api/matches/upcoming', (req, res) => {
  try {
    const upcomingMatches = aiMatchesService.getUpcomingMatches();
    res.json({
      success: true,
      count: upcomingMatches.length,
      matches: upcomingMatches,
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching upcoming matches',
      error: error.message,
    });
  }
});

/**
 * GET /api/matches/all
 * Fetch all matches (live + upcoming)
 */
app.get('/api/matches/all', async (req, res) => {
  try {
    const allMatches = await aiMatchesService.getAllMatches();
    res.json({
      success: true,
      data: allMatches,
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching all matches',
      error: error.message,
    });
  }
});

/**
 * GET /api/matches/:id
 * Get specific match details
 */
app.get('/api/matches/:id', async (req, res) => {
  try {
    const allMatches = await aiMatchesService.getAllMatches();
    const match = [...allMatches.live, ...allMatches.upcoming].find(
      m => m.id === parseInt(req.params.id)
    );

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    res.json({
      success: true,
      match,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching match',
      error: error.message,
    });
  }
});

/**
 * POST /api/matches/odds/:matchId
 * Get updated odds for a specific match (with AI adjustment)
 */
app.post('/api/matches/odds/:matchId', async (req, res) => {
  try {
    const { goals, updateType } = req.body;
    const matchId = parseInt(req.params.matchId);

    // Create mock match for odds calculation
    const mockMatch = {
      teams: {
        home: { name: 'Team A' },
        away: { name: 'Team B' },
      },
      goals: goals || { home: 0, away: 0 },
    };

    const odds = aiMatchesService.generateDynamicOdds(mockMatch);

    res.json({
      success: true,
      matchId,
      odds,
      updateType: updateType || 'standard',
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error calculating odds',
      error: error.message,
    });
  }
});

// ============================================
// INITIATE M-PESA STK PUSH (DEPOSIT)
// ============================================
app.post('/api/mpesa/initiate-deposit', async (req, res) => {
  try {
    const { amount, phoneNumber, userEmail } = req.body;

    // Validate input
    if (!amount || !phoneNumber || !userEmail) {
      return res.status(400).json({
        success: false,
        message: 'Amount, phone number, and email are required',
      });
    }

    // Validate phone number format (254XXXXXXXXX or 07XXXXXXXXX)
    let formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    // Get access token
    const accessToken = await getMpesaAccessToken();

    // Generate timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:-]|\.000Z/g, '')
      .slice(0, -3);

    // Generate password (Business Short Code + Passkey + Timestamp, then Base64 encode)
    const password = Buffer.from(
      `${MPESA_CONFIG.businessShortCode}${MPESA_CONFIG.lipaNaMpesaOnlinePasskey}${timestamp}`
    ).toString('base64');

    // STK Push request
    const stkPushRequest = {
      BusinessShortCode: MPESA_CONFIG.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.floor(amount),
      PartyA: formattedPhone,
      PartyB: MPESA_CONFIG.businessShortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: MPESA_CONFIG.callbackUrl,
      AccountReference: userEmail,
      TransactionDesc: 'Betting Platform Deposit',
    };

    const response = await axios.post(
      `${MPESA_CONFIG.mpesaApiUrl}/mpesa/stkpush/v1/processrequest`,
      stkPushRequest,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Store transaction
    const transactionId = response.data.CheckoutRequestID;
    transactions[transactionId] = {
      userEmail,
      phoneNumber: formattedPhone,
      amount,
      status: 'pending',
      timestamp: new Date(),
      checkoutRequestId: transactionId,
    };

    res.json({
      success: true,
      message: 'STK Push sent successfully',
      checkoutRequestId: transactionId,
      data: response.data,
    });
  } catch (error) {
    console.error('Error initiating M-Pesa deposit:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate deposit',
      error: error.response?.data || error.message,
    });
  }
});

// ============================================
// M-PESA CALLBACK (DEPOSIT CONFIRMATION)
// ============================================
app.post('/api/mpesa/callback', (req, res) => {
  try {
    const callbackData = req.body;
    console.log('M-Pesa Callback received:', JSON.stringify(callbackData, null, 2));

    const stkCallback = callbackData.Body.stkCallback;
    const checkoutRequestId = stkCallback.CheckoutRequestID;

    // Update transaction status
    if (transactions[checkoutRequestId]) {
      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;

      if (resultCode === 0) {
        // Payment successful
        transactions[checkoutRequestId].status = 'completed';
        transactions[checkoutRequestId].resultDesc = resultDesc;

        // Extract payment details
        const callbackMetadata = stkCallback.CallbackMetadata.Item;
        const amount = callbackMetadata.find(item => item.Name === 'Amount')?.Value;
        const mpesaReceiptNumber = callbackMetadata.find(
          item => item.Name === 'MpesaReceiptNumber'
        )?.Value;
        const transactionDate = callbackMetadata.find(
          item => item.Name === 'TransactionDate'
        )?.Value;
        const phoneNumber = callbackMetadata.find(
          item => item.Name === 'PhoneNumber'
        )?.Value;

        transactions[checkoutRequestId].mpesaReceiptNumber = mpesaReceiptNumber;
        transactions[checkoutRequestId].transactionDate = transactionDate;
        transactions[checkoutRequestId].completedAmount = amount;

        // Update user balance
        const userEmail = transactions[checkoutRequestId].userEmail;
        if (!users[userEmail]) {
          users[userEmail] = {
            email: userEmail,
            balance: 0,
            deposits: [],
          };
        }
        users[userEmail].balance += amount;
        users[userEmail].deposits.push({
          amount,
          mpesaReceiptNumber,
          date: new Date(),
        });

        console.log(`✅ Payment successful for ${userEmail}: KES ${amount}`);

        // ============================================
        // SEND NOTIFICATION TO OWNER
        // ============================================
        notifyPayment({
          userEmail,
          phoneNumber,
          amount,
          mpesaReceiptNumber,
          transactionDate,
          checkoutRequestId,
          status: 'completed',
        });
      } else {
        // Payment failed
        transactions[checkoutRequestId].status = 'failed';
        transactions[checkoutRequestId].resultDesc = resultDesc;
        console.log(`❌ Payment failed for ${checkoutRequestId}: ${resultDesc}`);
      }
    }

    // Acknowledge receipt of callback
    res.json({
      Body: {
        stkCallback: {
          MerchantRequestID: stkCallback.MerchantRequestID,
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 0,
          ResultDesc: 'The service request has been accepted successfully',
        },
      },
    });
  } catch (error) {
    console.error('Error processing M-Pesa callback:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing callback',
    });
  }
});

// ============================================
// CHECK TRANSACTION STATUS
// ============================================
app.get('/api/transaction/:checkoutRequestId', (req, res) => {
  try {
    const { checkoutRequestId } = req.params;
    const transaction = transactions[checkoutRequestId];

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction',
      error: error.message,
    });
  }
});

// ============================================
// GET USER BALANCE
// ============================================
app.get('/api/user/:email/balance', (req, res) => {
  try {
    const { email } = req.params;
    const user = users[email];

    if (!user) {
      return res.json({
        success: true,
        email,
        balance: 0,
        deposits: [],
      });
    }

    res.json({
      success: true,
      email,
      balance: user.balance,
      deposits: user.deposits,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user balance',
      error: error.message,
    });
  }
});

// ============================================
// WITHDRAW FUNDS (M-PESA)
// ============================================
app.post('/api/mpesa/withdraw', async (req, res) => {
  try {
    const { amount, phoneNumber, userEmail } = req.body;

    // Validate input
    if (!amount || !phoneNumber || !userEmail) {
      return res.status(400).json({
        success: false,
        message: 'Amount, phone number, and email are required',
      });
    }

    // Check user balance
    const user = users[userEmail];
    if (!user || user.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance',
      });
    }

    // Format phone number
    let formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    // Get access token
    const accessToken = await getMpesaAccessToken();

    // B2C request (withdrawal)
    const b2cRequest = {
      OriginatorConversationID: `${userEmail}-${Date.now()}`,
      InitiatedName: 'Betting Platform',
      SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL, // Encrypted
      CommandID: 'BusinessPayment',
      Amount: Math.floor(amount),
      PartyB: formattedPhone,
      Remarks: 'Betting Platform Withdrawal',
      QueueTimeOutURL: MPESA_CONFIG.callbackUrl,
      ResultURL: MPESA_CONFIG.callbackUrl,
    };

    const response = await axios.post(
      `${MPESA_CONFIG.mpesaApiUrl}/mpesa/b2c/v1/paymentrequest`,
      b2cRequest,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Deduct from user balance
    user.balance -= amount;

    res.json({
      success: true,
      message: 'Withdrawal initiated successfully',
      data: response.data,
      newBalance: user.balance,
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to process withdrawal',
      error: error.response?.data || error.message,
    });
  }
});

// ============================================
// GET ADMIN NOTIFICATIONS
// ============================================
app.get('/api/admin/notifications', (req, res) => {
  try {
    const limit = req.query.limit || 20;
    const notifications = getAdminNotifications(limit);

    res.json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error.message,
    });
  }
});

// ============================================
// MARK NOTIFICATION AS READ
// ============================================
app.put('/api/admin/notifications/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    const notification = markNotificationAsRead(parseInt(id));

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating notification',
      error: error.message,
    });
  }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is running',
    timestamp: new Date(),
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Betting Platform Backend running on port ${PORT}`);
  console.log(`📱 M-Pesa Integration Active`);
  console.log(`🔗 Callback URL: ${MPESA_CONFIG.callbackUrl}`);
  console.log(`📢 Payment Notifications Active - Owner: ${process.env.OWNER_PHONE || '+254799941621'}`);
  console.log(`🎮 AI Matches Service Active`);
});
