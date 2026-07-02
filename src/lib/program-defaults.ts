export const PROGRAM_DEFAULTS = {
  referralPayoutCents: 0,
  commissionRate: 0,
  commissionType: 'FIXED',
  cookieDurationDays: 30,
  commissionHoldDays: 30,
  currency: 'USD',
  minPayoutCents: 0,
  payoutFrequency: 'MONTHLY',
  brandColor: '#6366f1',
  autoApprove: false,
} as const;

export const APP_DEFAULTS = {
  publicAppUrl: 'https://app.referconnect.com',
  productName: 'ReferConnect',
  programName: 'ReferConnect Referral Program',
} as const;

export const NOTIFICATION_POLL_INTERVAL_MS = 30_000;
export const INVOICE_DUE_DAYS = 30;
