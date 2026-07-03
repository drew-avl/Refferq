export const PAYOUT_METHODS = ['PayPal', 'Zelle', 'Cash'] as const;

export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const DEFAULT_PAYOUT_METHOD: PayoutMethod = 'PayPal';

export function isPayoutMethod(value: string | null | undefined): value is PayoutMethod {
  return PAYOUT_METHODS.includes(value as PayoutMethod);
}

export function getAllowedPayoutMethod(value: string | null | undefined): PayoutMethod {
  return isPayoutMethod(value) ? value : DEFAULT_PAYOUT_METHOD;
}
