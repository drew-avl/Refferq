import { APP_DEFAULTS, PROGRAM_DEFAULTS } from './program-defaults';

export function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || APP_DEFAULTS.publicAppUrl;
}

export function getDefaultPortalSubdomain() {
  try {
    return new URL(getPublicAppUrl()).hostname;
  } catch (_error) {
    return new URL(APP_DEFAULTS.publicAppUrl).hostname;
  }
}

export function getDefaultProgramSettings() {
  return {
    programId: `prg_${Date.now()}`,
    productName: process.env.PLATFORM_PRODUCT_NAME || APP_DEFAULTS.productName,
    programName: process.env.PLATFORM_PROGRAM_NAME || APP_DEFAULTS.programName,
    websiteUrl: process.env.NEXT_PUBLIC_MARKETING_URL || getPublicAppUrl(),
    currency: process.env.PLATFORM_DEFAULT_CURRENCY || PROGRAM_DEFAULTS.currency,
    portalSubdomain: process.env.PLATFORM_PORTAL_SUBDOMAIN || getDefaultPortalSubdomain(),
    companyName: process.env.PLATFORM_COMPANY_NAME || APP_DEFAULTS.productName,
    brandBackgroundColor: '#f8fafc',
    brandButtonColor: '#059669',
    brandTextColor: '#0f172a',
    minimumPayoutThreshold: PROGRAM_DEFAULTS.minPayoutCents,
    payoutTerm: 'NET-15',
    commissionHoldDays: PROGRAM_DEFAULTS.commissionHoldDays,
    minPayoutCents: PROGRAM_DEFAULTS.minPayoutCents,
    payoutFrequency: PROGRAM_DEFAULTS.payoutFrequency,
  };
}
