# Email and Text Alert Implementation

ReferConnect sends transactional email through Microsoft Graph `sendMail` using app-only client credentials.

## Runtime Wiring

- `src/lib/email.ts` owns Graph token retrieval, `sendMail` calls, recipient parsing, and CSV/report attachment conversion.
- `src/lib/otp.ts` sends login codes through `emailService.sendCustomEmail`.
- `src/app/admin/emails/page.tsx` is a newsletter composer for active referral agents.
- `src/app/api/admin/emails/route.ts` lists active referral-agent recipients and sends newsletter emails individually.
- `src/app/api/admin/reports/email/route.ts` sends report emails through the same Graph-backed service, including CSV attachments.
- `scripts/test-email.js` verifies Graph credentials from `.env.local`.

## Required Email Environment

```env
MICROSOFT_TENANT_ID="your-tenant-id"
MICROSOFT_CLIENT_ID="your-app-client-id"
MICROSOFT_CLIENT_SECRET="your-app-client-secret"
MICROSOFT_GRAPH_SENDER="notifications@yourdomain.com"
NEXT_PUBLIC_APP_URL="https://app.yourdomain.com"
ADMIN_EMAILS="admin@yourdomain.com"
```

The Entra app must have Microsoft Graph `Mail.Send` as an application permission with admin consent.
`MICROSOFT_GRAPH_SENDER` must be a real Exchange Online mailbox that resolves in the tenant; alias-only addresses and distribution lists will fail with `ErrorInvalidUser`.

## Text Alerts

SMS delivery is implemented in `src/lib/sms.ts` and is disabled unless `SMS_ENABLED="true"`.

New lead text alerts go to `ADMIN_SMS_NUMBERS`. Partner transaction and payout text alerts use the partner's `payoutDetails.notificationPhone`, surfaced as Text Alert Phone in affiliate settings.

```env
SMS_ENABLED="true"
SMS_PROVIDER="relay"
ADMIN_SMS_NUMBERS="+15551234567"
SMS_RELAY_URL="https://sms-relay.example.com/send-sms"
SMS_RELAY_TOKEN=""
SMS_RELAY_TIMEOUT_MS="10000"
REFERRAL_REMINDER_TIME_ZONE="America/New_York"
REFERRAL_REMINDER_BUSINESS_START_HOUR="8"
REFERRAL_REMINDER_BUSINESS_END_HOUR="17"
REFERRAL_REMINDER_DELAY_MINUTES="60"
REFERRAL_REMINDER_BATCH_SIZE="25"
VOIPMS_API_USERNAME=""
VOIPMS_API_PASSWORD=""
VOIPMS_SMS_DID=""
VOIPMS_API_ENDPOINT="https://voip.ms/api/v1/rest.php"
THREECX_SMS_WEBHOOK_URL=""
THREECX_SMS_WEBHOOK_TOKEN=""
THREECX_SMS_FROM=""
```

`SMS_PROVIDER` accepts `relay`, `voipms`, `3cx`, `both`, or comma-separated providers such as `relay,3cx`. When `relay` is selected, the Vercel app posts to `SMS_RELAY_URL` with `SMS_RELAY_TOKEN`; the VPS relay keeps the VoIP.ms credentials and static IP.
Use the standalone `referconnect-sms-relay` VPS service for Vercel deployments where VoIP.ms API IP restrictions must remain enabled.
For VoIP.ms, API access must be enabled, any API IP restriction must allow the app server's outbound IP, and `VOIPMS_SMS_DID` must be an SMS-capable DID.
Referral follow-up reminders are handled by `/api/cron/referral-reminders`. The endpoint finds `NEW` leads, counts elapsed time only inside the configured weekday business window, sends email and text reminders after `REFERRAL_REMINDER_DELAY_MINUTES`, and records `unactionedReminderSentAt` in referral metadata to prevent repeat reminders.

## Verification

```bash
npm run test:email -- you@example.com
npm run typecheck
npm run build
```
