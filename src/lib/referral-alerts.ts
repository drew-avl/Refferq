import { getPublicAppUrl } from './platform-defaults';

export interface ReferralAlertCopyData {
  referralId: string;
  affiliateName: string;
  leadName: string;
  leadEmail: string;
  leadPhone?: string | null;
  company?: string | null;
  address?: string | null;
  address2?: string | null;
  programName?: string | null;
  ageLabel?: string;
}

function cleanPart(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(maxLength - 3, 0)).trim()}...`;
}

export function getAdminLeadUrl(referralId: string) {
  return `${getPublicAppUrl()}/admin/customers/${encodeURIComponent(referralId)}`;
}

export function formatLeadAgeLabel(createdAt: Date, now = new Date()) {
  const minutes = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 60000));
  if (minutes < 120) return `${minutes} minutes`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours} hours`;
}

export function formatReferralTimestamp(date: Date, timeZone = process.env.REFERRAL_REMINDER_TIME_ZONE || 'America/New_York') {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

function leadContext(data: ReferralAlertCopyData) {
  const company = cleanPart(data.company);
  const address = [data.address, data.address2].map(cleanPart).filter(Boolean).join(', ');
  const context = [company, address].filter(Boolean).join(' - ');
  return context ? ` (${truncate(context, 80)})` : '';
}

function leadDetailParts(data: ReferralAlertCopyData) {
  const address = [data.address, data.address2].map(cleanPart).filter(Boolean).join(', ');
  return [
    cleanPart(data.leadPhone) ? `Phone: ${cleanPart(data.leadPhone)}` : '',
    cleanPart(data.leadEmail) ? `Email: ${cleanPart(data.leadEmail)}` : '',
    cleanPart(data.programName) ? `Source: ${cleanPart(data.programName)}` : '',
    cleanPart(data.company) ? `Company: ${cleanPart(data.company)}` : '',
    address ? `Address: ${truncate(address, 100)}` : '',
  ].filter(Boolean);
}

export function formatNewReferralSms(data: ReferralAlertCopyData) {
  const url = getAdminLeadUrl(data.referralId);
  const details = leadDetailParts(data).join('. ');
  return truncate(
    `ReferConnect new lead: ${cleanPart(data.leadName)}${leadContext(data)}. Partner: ${cleanPart(data.affiliateName)}. ${details ? `${details}. ` : ''}Review: ${url}`,
    480
  );
}

export function formatReferralReminderSms(data: ReferralAlertCopyData) {
  const url = getAdminLeadUrl(data.referralId);
  const details = leadDetailParts(data).join('. ');
  return truncate(
    `ReferConnect follow-up: ${cleanPart(data.leadName)} has been New for ${data.ageLabel || 'over 1 hour'}. ${details ? `${details}. ` : ''}Review: ${url}`,
    480
  );
}
