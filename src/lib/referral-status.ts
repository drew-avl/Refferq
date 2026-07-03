export const REFERRAL_STATUSES = ['NEW', 'PENDING', 'SOLD', 'COMPLETED', 'REJECTED'] as const;

export type ReferralStatusValue = (typeof REFERRAL_STATUSES)[number];

export const SOLD_REFERRAL_STATUSES: ReferralStatusValue[] = ['SOLD', 'COMPLETED'];
export const PAYOUT_ELIGIBLE_REFERRAL_STATUS: ReferralStatusValue = 'COMPLETED';

export function isReferralStatus(value: string): value is ReferralStatusValue {
  return REFERRAL_STATUSES.includes(value as ReferralStatusValue);
}

export function isSoldReferralStatus(value: string) {
  return SOLD_REFERRAL_STATUSES.includes(value as ReferralStatusValue);
}

export function isPayoutEligibleReferralStatus(value: string) {
  return value === PAYOUT_ELIGIBLE_REFERRAL_STATUS;
}

export function referralStatusFromAction(action: string): ReferralStatusValue | null {
  const normalized = action.toLowerCase();
  if (normalized === 'new') return 'NEW';
  if (normalized === 'review' || normalized === 'pending' || normalized === 'pend') return 'PENDING';
  if (normalized === 'sell' || normalized === 'sold' || normalized === 'approve') return 'SOLD';
  if (normalized === 'complete' || normalized === 'completed') return 'COMPLETED';
  if (normalized === 'reject' || normalized === 'rejected') return 'REJECTED';
  return null;
}

export function canTransitionReferralStatus(current: string, next: ReferralStatusValue) {
  if (next === 'REJECTED') {
    return current === 'NEW' || current === 'PENDING' || current === 'SOLD';
  }

  if (current === 'NEW') return next === 'PENDING';
  if (current === 'PENDING') return next === 'SOLD';
  if (current === 'SOLD') return next === 'COMPLETED';
  return false;
}
