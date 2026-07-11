# Email and Text Alert Configuration

ReferConnect sends transactional email through SMTP. The default settings are for Microsoft 365 SMTP client submission.

## Microsoft 365 SMTP

Use a licensed mailbox such as `notifications@yourdomain.com`.

```env
SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_USER="notifications@yourdomain.com"
SMTP_PASSWORD="your-mailbox-password-or-app-password"
SMTP_FROM_EMAIL="ReferConnect <notifications@yourdomain.com>"
NEXT_PUBLIC_APP_URL="https://app.yourdomain.com"
ADMIN_EMAILS="admin@yourdomain.com,support@yourdomain.com"
```

Microsoft 365 usually requires SMTP AUTH to be enabled for the sending mailbox. Keep `SMTP_PORT="587"` and leave `SMTP_SECURE` unset so Nodemailer uses STARTTLS.

Test SMTP from the command line:

```bash
npm run test:email -- you@example.com
```

## Email Templates

Automated email templates are still managed in the app under Admin -> Emails. The transport changed, but callers still use `emailService`, so existing welcome, new-lead, report, payout, and OTP email flows continue through the same service.

## Text Alerts

SMS delivery is disabled until explicitly enabled:

```env
SMS_ENABLED="true"
SMS_PROVIDER="voipms" # voipms, 3cx, or both
ADMIN_SMS_NUMBERS="+15551234567,+15557654321"
```

New lead alerts go to `ADMIN_SMS_NUMBERS`. Partner payout and completed-order alerts go to the partner's Text Alert Phone in partner settings, stored as `payoutDetails.notificationPhone`.

### VoIP.ms

```env
VOIPMS_API_USERNAME="your-voipms-api-username"
VOIPMS_API_PASSWORD="your-voipms-api-password"
VOIPMS_SMS_DID="15551234567"
VOIPMS_API_ENDPOINT="https://voip.ms/api/v1/rest.php"
```

The sender DID must be SMS-capable in VoIP.ms. The app calls the VoIP.ms REST `sendSMS` method with the configured DID, destination number, and message.

### 3CX

3CX deployments vary by SMS provider and integration setup, so ReferConnect supports a configurable outbound webhook:

```env
THREECX_SMS_WEBHOOK_URL="https://your-3cx-or-middleware.example.com/sms"
THREECX_SMS_WEBHOOK_TOKEN="optional-bearer-token"
THREECX_SMS_FROM="15551234567"
```

ReferConnect posts JSON:

```json
{
  "from": "15551234567",
  "to": "+15557654321",
  "message": "Alert text"
}
```

Use this endpoint with 3CX directly if your deployment exposes one, or with a small middleware endpoint that hands the message to your 3CX SMS provider.

## Troubleshooting

- Confirm `SMTP_USER` can send mail in Microsoft 365 and SMTP AUTH is enabled for that mailbox.
- Confirm `SMTP_FROM_EMAIL` matches the mailbox or an allowed sender alias.
- Check server logs for `Email sending error` or SMS provider errors.
- Leave `SMS_ENABLED="false"` until provider credentials are ready.
- Use E.164 phone numbers, for example `+15551234567`.
