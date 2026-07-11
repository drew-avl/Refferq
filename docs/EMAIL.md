# Email and Text Alert Configuration

ReferConnect sends transactional email through Microsoft Graph `sendMail`, not SMTP AUTH. This avoids app passwords, SMTP AUTH mailbox toggles, and Basic Auth tenant policy issues.

## Microsoft Graph Email

Create an Entra app registration for ReferConnect:

1. Microsoft Entra admin center -> App registrations -> New registration.
2. Add an application client secret.
3. API permissions -> Microsoft Graph -> Application permissions -> `Mail.Send`.
4. Grant admin consent.
5. Use a real Exchange Online mailbox as the sender, for example `notifications@yourdomain.com`.

`MICROSOFT_GRAPH_SENDER` is used in the Graph endpoint `/users/{sender}/sendMail`. It must identify a mailbox that exists in the tenant. Do not set it to an unlicensed address, a distribution list, or an alias-only address. If you want to send from a shared mailbox, use that shared mailbox's actual Microsoft 365 mailbox identity and make sure the app is allowed to send as it.

```env
MICROSOFT_TENANT_ID="your-tenant-id"
MICROSOFT_CLIENT_ID="your-app-client-id"
MICROSOFT_CLIENT_SECRET="your-app-client-secret"
MICROSOFT_GRAPH_SENDER="notifications@yourdomain.com"
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

## Admin Newsletters

Admin -> Emails sends newsletter-style messages to all active referral agents. Use the composer to write a subject, headline, message body, and optional button. Test sends go to the admin user; live sends are delivered individually to active referral partners so recipients do not see each other's addresses.

Automated welcome, new-lead, report, payout, and OTP flows use code-rendered system emails through `emailService`, so stale database templates do not override production copy.

## Text Alerts

SMS delivery is disabled until explicitly enabled:

```env
SMS_ENABLED="true"
SMS_PROVIDER="relay" # relay, voipms, 3cx, both, or comma-separated providers such as relay,3cx
ADMIN_SMS_NUMBERS="+15551234567,+15557654321"
```

New lead alerts go to `ADMIN_SMS_NUMBERS`. Partner payout and completed-order alerts go to the partner's Text Alert Phone in partner settings, stored as `payoutDetails.notificationPhone`.

SMS message bodies are capped at 160 characters before delivery so VoIP.ms and the fixed-IP relay do not reject over-length messages. Referral lead texts prioritize lead name, phone/email, partner/source, and only include the admin review URL when it fits.

### Referral Follow-up Reminders

ReferConnect can remind the team when a new lead has not been actioned. A lead is considered unactioned while it remains in `NEW` status with no `reviewedAt` value. The Vercel cron in `vercel.json` calls `/api/cron/referral-reminders` every 15 minutes; the route only counts elapsed time inside the configured Monday-Friday business window and stamps referral metadata after a reminder is sent so the same lead is not repeatedly notified.

```env
CRON_SECRET="long-random-cron-secret"
REFERRAL_REMINDER_TIME_ZONE="America/New_York"
REFERRAL_REMINDER_BUSINESS_START_HOUR="8"
REFERRAL_REMINDER_BUSINESS_END_HOUR="17"
REFERRAL_REMINDER_DELAY_MINUTES="60"
REFERRAL_REMINDER_BATCH_SIZE="25"
```

On Vercel, set `CRON_SECRET` in project environment variables. The route accepts either `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`.

### Fixed-IP Relay for Vercel

Use a standalone `referconnect-sms-relay` service when the app runs on Vercel and VoIP.ms requires API source IP allowlisting. Vercel sends SMS requests to the relay over HTTPS, and the relay calls VoIP.ms from your VPS static IP.

Vercel environment:

```env
SMS_ENABLED="true"
SMS_PROVIDER="relay"
SMS_RELAY_URL="https://sms-relay.example.com/send-sms"
SMS_RELAY_TOKEN="same-token-as-the-vps-relay"
ADMIN_SMS_NUMBERS="+15551234567,+15557654321"
```

VPS relay environment:

```env
SMS_RELAY_TOKEN="same-token-as-vercel"
VOIPMS_API_USERNAME="your-voipms-api-username"
VOIPMS_API_PASSWORD="your-voipms-api-password"
VOIPMS_SMS_DID="15551234567"
VOIPMS_API_ENDPOINT="https://voip.ms/api/v1/rest.php"
```

Deploy the standalone relay bundle to the VPS and keep it outside the Vercel project.

### VoIP.ms

```env
VOIPMS_API_USERNAME="your-voipms-api-username"
VOIPMS_API_PASSWORD="your-voipms-api-password"
VOIPMS_SMS_DID="15551234567"
VOIPMS_API_ENDPOINT="https://voip.ms/api/v1/rest.php"
```

The sender DID must be SMS-capable in VoIP.ms. The app calls the VoIP.ms REST `sendSMS` method as a GET request with the configured DID, destination number, and message.

If VoIP.ms returns HTTP 500, check the provider response detail in the app logs. A SOAP `Bad Request` fault usually means the API was called with the wrong HTTP shape. Other common configuration causes are disabled VoIP.ms API access, an API IP restriction that does not include the server's outbound IP, invalid API credentials, over-length SMS bodies, or a `VOIPMS_SMS_DID` that is not SMS-capable.

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
- If Graph returns `ErrorInvalidUser`, the configured sender mailbox does not resolve in that tenant. Create/license the mailbox or change `MICROSOFT_GRAPH_SENDER` to one that exists.
- Check Microsoft Graph errors in server logs for token or `sendMail` failures.
- Check VoIP.ms SMS errors in server logs for the provider response body, not just the HTTP status.
- Leave `SMS_ENABLED="false"` until provider credentials are ready.
- Use E.164 phone numbers, for example `+15551234567`.
