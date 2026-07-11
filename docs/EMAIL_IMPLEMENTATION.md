# Email and Text Alert Implementation

ReferConnect now sends transactional email through SMTP using Nodemailer. The default deployment target is Microsoft 365 SMTP client submission.

## Runtime Wiring

- `src/lib/email.ts` owns SMTP transport creation and the public `emailService` methods.
- `src/lib/otp.ts` sends login codes through `emailService.sendCustomEmail`.
- `src/app/api/admin/reports/email/route.ts` sends report emails through the same SMTP-backed service, including CSV attachments.
- `scripts/test-email.js` verifies SMTP credentials from `.env.local`.

## Required Email Environment

```env
SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_USER="notifications@yourdomain.com"
SMTP_PASSWORD="your-mailbox-password-or-app-password"
SMTP_FROM_EMAIL="ReferConnect <notifications@yourdomain.com>"
NEXT_PUBLIC_APP_URL="https://app.yourdomain.com"
ADMIN_EMAILS="admin@yourdomain.com"
```

## Text Alerts

SMS delivery is implemented in `src/lib/sms.ts` and is disabled unless `SMS_ENABLED="true"`.

New lead text alerts go to `ADMIN_SMS_NUMBERS`. Partner transaction and payout text alerts use the partner's `payoutDetails.notificationPhone`, surfaced as Text Alert Phone in affiliate settings.

```env
SMS_ENABLED="true"
SMS_PROVIDER="voipms"
ADMIN_SMS_NUMBERS="+15551234567"
VOIPMS_API_USERNAME=""
VOIPMS_API_PASSWORD=""
VOIPMS_SMS_DID=""
THREECX_SMS_WEBHOOK_URL=""
THREECX_SMS_WEBHOOK_TOKEN=""
```

`SMS_PROVIDER` accepts `voipms`, `3cx`, or `both`. When `both` is selected, VoIP.ms is attempted first and 3CX is used as fallback.

## Verification

```bash
npm run test:email -- you@example.com
npm run typecheck
npm run build
```
