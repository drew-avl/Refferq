# Email and Text Alert Configuration

ReferConnect sends transactional email through Microsoft Graph `sendMail`, not SMTP AUTH. This avoids app passwords, SMTP AUTH mailbox toggles, and Basic Auth tenant policy issues.

## Microsoft Graph Email

Create an Entra app registration for ReferConnect:

1. Microsoft Entra admin center -> App registrations -> New registration.
2. Add an application client secret.
3. API permissions -> Microsoft Graph -> Application permissions -> `Mail.Send`.
4. Grant admin consent.
5. Use a real Exchange Online mailbox as the sender, for example `noreply@n45tech.com`.

```env
MICROSOFT_TENANT_ID="your-tenant-id"
MICROSOFT_CLIENT_ID="your-app-client-id"
MICROSOFT_CLIENT_SECRET="your-app-client-secret"
MICROSOFT_GRAPH_SENDER="noreply@n45tech.com"
NEXT_PUBLIC_APP_URL="https://app.yourdomain.com"
ADMIN_EMAILS="admin@yourdomain.com,support@yourdomain.com"
```

Optional:

```env
MICROSOFT_GRAPH_SAVE_TO_SENT_ITEMS="false"
```

Test Graph email from the command line:

```bash
npm run test:email -- you@example.com
```

## Email Templates

Automated email templates are managed in the app under Admin -> Emails. Welcome, new-lead, report, payout, and OTP flows all use `emailService`, so they send through Microsoft Graph once the environment variables are set.

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

- Confirm the Entra app has Microsoft Graph `Mail.Send` application permission.
- Confirm admin consent has been granted after adding `Mail.Send`.
- Confirm `MICROSOFT_GRAPH_SENDER` is a real Exchange Online mailbox.
- Check Microsoft Graph errors in server logs for token or `sendMail` failures.
- Leave `SMS_ENABLED="false"` until provider credentials are ready.
- Use E.164 phone numbers, for example `+15551234567`.
