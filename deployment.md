# Deployment Guide

This guide deploys ReferConnect as a Next.js 16 application backed by PostgreSQL and Prisma.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL database
- Microsoft 365 mailbox with SMTP AUTH enabled for transactional email
- A 32+ character `JWT_SECRET`

## Required Environment Variables

Create `.env.local` for local builds or configure the same values in your hosting provider:

```env
DATABASE_URL="postgresql://user:password@host:5432/referconnect?sslmode=require"
JWT_SECRET="replace-with-a-random-secret-of-at-least-32-characters"
SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_USER="notifications@yourdomain.com"
SMTP_PASSWORD="your-mailbox-password-or-app-password"
SMTP_FROM_EMAIL="ReferConnect <notifications@yourdomain.com>"
ADMIN_EMAILS="admin@yourdomain.com"
NEXT_PUBLIC_APP_URL="https://app.yourdomain.com"
```

Optional variables used by specific features:

```env
NEXT_PUBLIC_SITE_URL="https://yourdomain.com"
WEBHOOK_SECRET="replace-with-a-random-webhook-secret"
CRON_SECRET="replace-with-a-random-cron-secret"
PLATFORM_NAME="ReferConnect"
PLATFORM_SUPPORT_EMAIL="support@yourdomain.com"
STRIPE_SECRET_KEY=""
STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""
TWENTY_API_BASE_URL="https://api.twenty.com"
TWENTY_API_KEY="tk_..."
TWENTY_SYNC_ENABLED="true"
TWENTY_REFERRAL_SYNC_ENABLED="true"
TWENTY_PARTNER_SYNC_ENABLED="true"
TWENTY_PAYOUT_SYNC_ENABLED="true"
TWENTY_WEBHOOK_URL=""
TWENTY_REFERRAL_WEBHOOK_URL=""
TWENTY_PARTNER_WEBHOOK_URL=""
TWENTY_PAYOUT_WEBHOOK_URL=""
TWENTY_WEBHOOK_SECRET=""
TWENTY_WEBHOOK_TIMEOUT_MS="12000"
SMS_ENABLED="false"
SMS_PROVIDER="voipms"
ADMIN_SMS_NUMBERS="+15551234567"
VOIPMS_API_USERNAME=""
VOIPMS_API_PASSWORD=""
VOIPMS_SMS_DID=""
THREECX_SMS_WEBHOOK_URL=""
THREECX_SMS_WEBHOOK_TOKEN=""
```

## Local Production Check

Run these before deploying:

```bash
npm ci
npm run lint
npm run typecheck
npm run build
```

Validate the Prisma schema with a database URL available:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/referconnect" npx prisma validate
```

On PowerShell:

```powershell
$env:DATABASE_URL="postgresql://user:password@localhost:5432/referconnect"; npx prisma validate
```

## Database Setup

ReferConnect currently uses Prisma `db push` rather than checked-in migration files.

```bash
npm run db:generate
npm run db:push
```

For production, run `npm run db:push` against the production `DATABASE_URL` before sending real traffic to the app. Back up existing production data first.

To seed sample data for development only:

```bash
npm run db:seed
```

## Deploying to Vercel

1. Import the repository into Vercel.
2. Use the included `vercel.json` defaults:
   - Install command: `npm ci`
   - Build command: `npm run build`
   - Framework: Next.js
3. Add all required environment variables in Vercel Project Settings.
4. Create or attach a PostgreSQL database and set `DATABASE_URL`.
5. Deploy the project.
6. From a machine with production env access, run:

```bash
npm ci
npm run db:push
```

Set `NEXT_PUBLIC_APP_URL` to the final production URL, such as `https://app.yourdomain.com`.

## Deploying with Docker Compose

Create a local `.env` file for Compose:

```env
JWT_SECRET="replace-with-a-random-secret-of-at-least-32-characters"
SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_USER="notifications@yourdomain.com"
SMTP_PASSWORD="your-mailbox-password-or-app-password"
SMTP_FROM_EMAIL="ReferConnect <notifications@yourdomain.com>"
ADMIN_EMAILS="admin@example.com"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Start PostgreSQL and the app:

```bash
docker compose up --build
```

In another terminal, initialize the schema from the host:

```bash
DATABASE_URL="postgresql://referconnect:referconnect@localhost:5432/referconnect" npm run db:push
```

On PowerShell:

```powershell
$env:DATABASE_URL="postgresql://referconnect:referconnect@localhost:5432/referconnect"; npm run db:push
```

Then open `http://localhost:3000`.

## Admin Account

1. Register through `/register`.
2. Promote the user in PostgreSQL:

```sql
UPDATE users
SET role = 'ADMIN', status = 'ACTIVE'
WHERE email = 'admin@yourdomain.com';
```

## Post-Deployment Checklist

- `npm run build` completes successfully.
- Prisma schema has been pushed to the production database.
- `NEXT_PUBLIC_APP_URL` matches the production URL.
- Microsoft 365 SMTP client submission has been tested with `npm run test:email -- you@example.com`.
- Admin account can sign in and access `/admin`.
- Affiliate registration, referral submission, and email sending have been tested.
- Text alerts are tested with `SMS_ENABLED="true"` if using VoIP.ms or 3CX.
- Webhook endpoints use `WEBHOOK_SECRET` if external systems post conversions or refunds.
- TwentyCRM sync is configured with `TWENTY_WEBHOOK_URL` or per-view webhook URLs if referrals, partners, and payouts should be pushed into Twenty.
- Scheduled commission maturation uses `CRON_SECRET` if exposed to a scheduler.
