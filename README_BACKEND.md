# PataPata - Betting Platform Backend Documentation

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment Variables
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

### 3. Run the Server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server will start on `http://localhost:3000`

---

## 📋 API Endpoints

### **Payment Endpoints**

#### Initiate Deposit (M-Pesa STK Push)
```
POST /api/mpesa/initiate-deposit
Content-Type: application/json

{
  "amount": 100,
  "phoneNumber": "0799941621",
  "userEmail": "user@example.com"
}
```

#### M-Pesa Callback (Webhook)
```
POST /api/mpesa/callback
```
This is called automatically by M-Pesa after payment

#### Check Transaction Status
```
GET /api/transaction/{checkoutRequestId}
```

#### Get User Balance
```
GET /api/user/{email}/balance
```

#### Withdraw Funds
```
POST /api/mpesa/withdraw
Content-Type: application/json

{
  "amount": 50,
  "phoneNumber": "0799941621",
  "userEmail": "user@example.com"
}
```

---

### **Notification Endpoints**

#### Get All Notifications
```
GET /api/admin/notifications?limit=20
```

#### Get Unread Count
```
GET /api/admin/notifications/unread/count
```

#### Mark Notification as Read
```
PUT /api/admin/notifications/{id}/read
```

---

### **Admin Endpoints**

#### Get Platform Statistics
```
GET /api/admin/stats
```

Response:
```json
{
  "success": true,
  "stats": {
    "totalUsers": 5,
    "totalTransactions": 12,
    "totalBalance": 5000,
    "unreadNotifications": 2,
    "timestamp": "2026-06-04T15:50:00.000Z"
  }
}
```

#### Health Check
```
GET /api/health
```

---

## 🔧 Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```env
# Server
PORT=3000
NODE_ENV=development

# M-PESA
MPESA_CONSUMER_KEY=your_key
MPESA_CONSUMER_SECRET=your_secret
MPESA_BUSINESS_SHORT_CODE=your_code
MPESA_PASSKEY=your_passkey
CALLBACK_URL=https://your-domain.com/api/mpesa/callback

# Email
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Owner
OWNER_EMAIL=owner@example.com
OWNER_PHONE=+254799941621

# SMS (Africa's Talking)
AFRICAS_TALKING_USERNAME=your_username
AFRICAS_TALKING_API_KEY=your_api_key
```

---

## 💻 Installation & Configuration

### Get M-Pesa Credentials
1. Go to https://developer.safaricom.co.ke
2. Create an account and app
3. Copy Consumer Key & Secret
4. Go to Daraja portal for Business Short Code & Passkey

### Get Email Credentials (Gmail)
1. Enable 2FA on your Gmail
2. Go to myaccount.google.com/apppasswords
3. Generate 16-character app password
4. Use this as `EMAIL_PASSWORD`

### Get SMS Credentials (Africa's Talking)
1. Register at https://africastalking.com
2. Get API Key from dashboard
3. Copy Username & API Key

---

## 📱 How It Works

### Payment Flow
1. User enters amount and phone number
2. Frontend calls `/api/mpesa/initiate-deposit`
3. Server sends STK Push to user's phone
4. User enters M-Pesa PIN
5. M-Pesa sends callback to `/api/mpesa/callback`
6. Server processes payment & sends notifications
7. **Owner receives:**
   - 📧 Email with payment details
   - 💬 SMS to +254799941621
   - 📊 Dashboard notification

### Notifications Sent
✅ When payment is successful:
- **Email** - Detailed payment receipt
- **SMS** - Quick alert to phone
- **Webhook** - To custom webhook URL (if configured)
- **Dashboard** - Stored for admin panel

---

## 🐛 Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

Common errors:
- `400` - Bad Request (missing fields, invalid format)
- `404` - Not Found (transaction doesn't exist)
- `500` - Server Error (M-Pesa API issue, email config missing)

---

## 🔒 Security Notes

⚠️ **Important:**
- Never commit `.env` file to git
- Use app-specific passwords for Gmail (not your main password)
- Keep M-Pesa credentials secure
- Validate all inputs on server-side
- Use HTTPS in production
- Add authentication to admin endpoints

---

## 📊 Testing

### Test Deposit
```bash
curl -X POST http://localhost:3000/api/mpesa/initiate-deposit \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "phoneNumber": "0799941621",
    "userEmail": "test@example.com"
  }'
```

### Check Health
```bash
curl http://localhost:3000/api/health
```

### Get Stats
```bash
curl http://localhost:3000/api/admin/stats
```

---

## 🚀 Deploy to Production

### Heroku
```bash
heroku create your-app-name
git push heroku main
heroku config:set OWNER_PHONE="+254799941621"
# Set other env variables via dashboard
```

### AWS Lambda
Package as Node.js Lambda function with serverless framework

### Digital Ocean
Deploy using App Platform with environment variables

---

## 📞 Support

**Owner**: +254799941621
**Email**: owner@example.com

For API issues, check logs:
```bash
npm run dev
# Watch console output
```

---

## 📦 Dependencies

- **express** - Web framework
- **axios** - HTTP client for M-Pesa API
- **nodemailer** - Email sending
- **cors** - Cross-origin requests
- **dotenv** - Environment variables
- **body-parser** - Request parsing

---

## 📄 License

Apache License 2.0

---

**PataPata** - Bet Smart, Win Big 🎯
