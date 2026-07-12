import crypto from 'node:crypto';

export function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || '';
}

export function normalizePhone(value: string | null | undefined, countryCode = '1') {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+${countryCode}${digits}`;
  return `+${digits}`;
}

export function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Unknown',
    lastName: parts.slice(1).join(' ') || '',
  };
}

export function normalizeAddressPart(value: string | null | undefined) {
  return (value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizedAddressKey(address: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
}) {
  const source = [
    address.addressLine1, address.addressLine2, address.city,
    address.state, address.postalCode, address.countryCode || 'US',
  ].map(normalizeAddressPart).join('|');
  return crypto.createHash('sha256').update(source).digest('hex');
}

export function syntheticKey(...parts: Array<string | null | undefined>) {
  return crypto.createHash('sha256').update(parts.map((part) => normalizeAddressPart(part)).join('|')).digest('hex');
}

