export interface ReferralMetadataDetails {
  company: string;
  notes: string;
  estimatedValue: number;
  address: string;
  address2: string;
  moveInDate: string;
}

function toPlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function toStringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

export function getReferralMetadataDetails(metadata: unknown): ReferralMetadataDetails {
  const data = toPlainObject(metadata);
  const estimatedValue = Number(data.estimated_value ?? data.estimatedValue ?? 0);

  return {
    company: toStringValue(data.company),
    notes: toStringValue(data.notes),
    estimatedValue: Number.isFinite(estimatedValue) ? estimatedValue : 0,
    address: toStringValue(data.address),
    address2: toStringValue(data.address2 ?? data.address_2),
    moveInDate: toStringValue(data.move_in_date ?? data.moveInDate),
  };
}
