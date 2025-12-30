# WhatsApp Transfer Approval System Setup

## Overview
This system sends transfer approval requests to your WhatsApp and automatically completes transfers when you reply with approval. The backend receives your reply via a Twilio webhook.

## What You Just Installed

✅ **Real WhatsApp Integration** - Messages are now sent directly to your WhatsApp number via Twilio
✅ **Webhook Handler** - Backend endpoint receives your approval replies
✅ **Auto-Complete Transfers** - Transfers complete when you reply "APPROVE TXN-{id}"

## Current Setup

**Environment Variables (Already Set):**
- `TWILIO_ACCOUNT_SID` - Your Twilio account ID
- `TWILIO_AUTH_TOKEN` - Your Twilio auth token
- `TWILIO_WHATSAPP_NUMBER` - Your WhatsApp Business number
- Admin phone: `+1-478-416-5940`

## How It Works

### 1. User Initiates Transfer
- User sends a transfer request through the app
- Backend creates a "pending" transaction

### 2. Admin Gets WhatsApp Message
- System sends WhatsApp message to your phone (+1-478-416-5940)
- Message format:
```
TRANSFER APPROVAL REQUIRED

User: John Doe
Amount: $500
From: Checking Account (ID: 1)
To: Savings Account (ID: 2)
Ref: TXN-123

Reply with "APPROVE TXN-123" to complete this transfer.
```

### 3. Admin Approves via WhatsApp
- You reply: `APPROVE TXN-123`
- Backend webhook receives your message
- Validates the transaction ID
- Marks transfer as "completed"
- Sends confirmation back to your WhatsApp

## Webhook Configuration

**Webhook URL (Production Endpoint):**
```
https://your-app-url.com/api/whatsapp/webhook
```

Replace `your-app-url.com` with your actual domain (Vercel/Render URL).

### Setting Up Twilio Webhook

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to: **Messaging** → **WhatsApp Senders** → Your WhatsApp number
3. Under **Webhook Configuration**:
   - Set: `https://your-app-url.com/api/whatsapp/webhook`
   - Method: `HTTP POST`
4. Save settings

## Testing Locally

For local testing without production webhook:
- Use manual approval endpoint instead: `POST /api/admin/approve-transaction/:id`
- In production, use WhatsApp replies

## Message Format Rules

**Approval Message Format:**
```
APPROVE TXN-{transactionId}
```

**Examples:**
- `APPROVE TXN-123` ✅ Works
- `Approve TXN-456` ✅ Works (case-insensitive)
- `APPROVE TXN-789` ✅ Works
- `TXN-123` ❌ Doesn't work (must include APPROVE)

## Troubleshooting

### Messages Not Being Sent
- Check Twilio credentials are set correctly
- Verify WhatsApp Business account is active in Twilio
- Check server logs for errors: `Failed to send WhatsApp message`

### Webhooks Not Triggering
- Ensure webhook URL is publicly accessible (HTTPS)
- Verify the URL in Twilio settings matches exactly
- Check admin phone number is correct: `+1-478-416-5940`
- Review server logs for webhook events

### Transaction Not Updating
- Verify message format: `APPROVE TXN-{id}`
- Check transaction exists and is in "pending" status
- Look for message in server logs: `WhatsApp webhook received`

## API Reference

### Send Transfer (Auto-sends WhatsApp message)
```
POST /api/transactions/transfer
{
  "fromAccountId": 1,
  "toAccountId": 2,
  "amount": "500"
}

Response:
{
  "id": 123,
  "status": "pending",
  "messageSid": "SMxxxxxxxxx",
  "note": "Transfer created and approval request sent to admin via WhatsApp"
}
```

### Receive WhatsApp Approval (Webhook - Automatic)
```
POST /api/whatsapp/webhook
Body: {
  "Body": "APPROVE TXN-123",
  "From": "whatsapp:+14784165940",
  ...other Twilio fields
}
```

### Manual Approval (Fallback)
```
POST /api/admin/approve-transaction/123
Authorization: Bearer {sessionToken}

Response: {
  "message": "Transaction approved and completed"
}
```

## Security Notes

- Only messages from admin WhatsApp number (+1-478-416-5940) are accepted
- Webhook validates transaction exists and is pending before approving
- All requests are logged for audit purposes
- Consider adding IP allowlisting for Twilio webhooks if needed

## Next Steps

1. **Update your production domain** in Twilio webhook settings
2. **Test a transfer** and reply via WhatsApp to verify
3. **Monitor server logs** for any issues
4. **Review transaction history** to confirm completions
