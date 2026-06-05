const nodemailer = require('nodemailer');
const axios = require('axios');

// ============================================
// NOTIFICATION CONFIGURATION
// ============================================

// Email configuration
const emailConfig = {
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
};

// Owner contact info
const ownerEmail = process.env.OWNER_EMAIL || 'owner@example.com';
const ownerPhoneNumber = process.env.OWNER_PHONE; // For SMS notifications

// Webhook URL for custom notifications
const webhookUrl = process.env.WEBHOOK_URL;

// ============================================
// EMAIL NOTIFICATION
// ============================================
async function sendEmailNotification(paymentData) {
  try {
    const transporter = nodemailer.createTransport(emailConfig);

    const emailContent = `
      <h2>💰 New Payment Received!</h2>
      <p><strong>Customer Email:</strong> ${paymentData.userEmail}</p>
      <p><strong>Amount:</strong> KES ${paymentData.amount}</p>
      <p><strong>Phone Number:</strong> ${paymentData.phoneNumber}</p>
      <p><strong>M-Pesa Receipt:</strong> ${paymentData.mpesaReceiptNumber || 'N/A'}</p>
      <p><strong>Transaction Date:</strong> ${paymentData.transactionDate || new Date().toLocaleString()}</p>
      <p><strong>Status:</strong> ✅ ${paymentData.status}</p>
      <hr>
      <p><small>Transaction ID: ${paymentData.checkoutRequestId}</small></p>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: ownerEmail,
      subject: `🎯 New Deposit: KES ${paymentData.amount} from ${paymentData.userEmail}`,
      html: emailContent,
    });

    console.log(`✉️ Email notification sent to ${ownerEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending email notification:', error);
    return false;
  }
}

// ============================================
// SMS NOTIFICATION (Using Africa's Talking or Twilio)
// ============================================
async function sendSmsNotification(paymentData) {
  try {
    if (!ownerPhoneNumber) {
      console.log('⚠️ SMS: Owner phone number not configured');
      return false;
    }

    // Using Africa's Talking (popular in Kenya)
    const message = `PaymentAlert: KES${paymentData.amount} received from ${paymentData.userEmail}. Receipt: ${paymentData.mpesaReceiptNumber || 'pending'}`;

    const response = await axios.post(
      'https://api.sandbox.africastalking.com/version1/messaging',
      {
        username: process.env.AFRICAS_TALKING_USERNAME,
        APIkey: process.env.AFRICAS_TALKING_API_KEY,
        recipients: [ownerPhoneNumber],
        message: message,
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log(`📱 SMS notification sent to ${ownerPhoneNumber}`);
    return true;
  } catch (error) {
    console.error('Error sending SMS notification:', error);
    return false;
  }
}

// ============================================
// WEBHOOK NOTIFICATION
// ============================================
async function sendWebhookNotification(paymentData) {
  try {
    if (!webhookUrl) {
      console.log('⚠️ Webhook: URL not configured');
      return false;
    }

    await axios.post(webhookUrl, {
      event: 'payment_received',
      timestamp: new Date().toISOString(),
      payment: paymentData,
    });

    console.log(`🔗 Webhook notification sent to ${webhookUrl}`);
    return true;
  } catch (error) {
    console.error('Error sending webhook notification:', error);
    return false;
  }
}

// ============================================
// DASHBOARD NOTIFICATION (Stored in memory/DB)
// ============================================
const adminNotifications = [];

function addDashboardNotification(paymentData) {
  const notification = {
    id: Date.now(),
    type: 'payment',
    message: `New deposit of KES ${paymentData.amount} from ${paymentData.userEmail}`,
    data: paymentData,
    timestamp: new Date(),
    read: false,
  };

  adminNotifications.unshift(notification);

  // Keep only last 100 notifications
  if (adminNotifications.length > 100) {
    adminNotifications.pop();
  }

  console.log(`📊 Dashboard notification added`);
  return notification;
}

// ============================================
// SEND ALL NOTIFICATIONS
// ============================================
async function notifyPayment(paymentData) {
  try {
    console.log('🔔 Sending payment notifications...');

    const notifications = await Promise.all([
      sendEmailNotification(paymentData),
      sendSmsNotification(paymentData),
      sendWebhookNotification(paymentData),
    ]);

    addDashboardNotification(paymentData);

    console.log('✅ All notifications sent');
    return notifications;
  } catch (error) {
    console.error('Error in notifyPayment:', error);
  }
}

// ============================================
// GET ADMIN NOTIFICATIONS
// ============================================
function getAdminNotifications(limit = 20) {
  return adminNotifications.slice(0, limit);
}

// ============================================
// MARK NOTIFICATION AS READ
// ============================================
function markNotificationAsRead(notificationId) {
  const notification = adminNotifications.find(n => n.id === notificationId);
  if (notification) {
    notification.read = true;
  }
  return notification;
}

module.exports = {
  notifyPayment,
  sendEmailNotification,
  sendSmsNotification,
  sendWebhookNotification,
  getAdminNotifications,
  markNotificationAsRead,
  adminNotifications,
};
