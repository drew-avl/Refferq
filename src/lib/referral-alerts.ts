import { getPublicAppUrl } from './platform-defaults';
import { SMS_MESSAGE_MAX_LENGTH, compactSmsMessage } from './sms';

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

function leadDetailParts(data: ReferralAlertCopyData) {
  const address = [data.address, data.address2].map(cleanPart).filter(Boolean).join(', ');
  return [
    cleanPart(data.leadPhone) ? `P: ${cleanPart(data.leadPhone)}` : '',
    cleanPart(data.leadEmail) ? `E: ${truncate(cleanPart(data.leadEmail), 42)}` : '',
    cleanPart(data.affiliateName) ? `Partner: ${truncate(cleanPart(data.affiliateName), 28)}` : '',
    cleanPart(data.programName) ? `Source: ${truncate(cleanPart(data.programName), 28)}` : '',
    cleanPart(data.company) ? `Co: ${truncate(cleanPart(data.company), 32)}` : '',
    address ? `Addr: ${truncate(address, 40)}` : '',
  ].filter(Boolean);
}

function appendIfFits(base: string, part: string) {
  if (!part) return base;
  const next = `${base}. ${part}`;
  return next.length <= SMS_MESSAGE_MAX_LENGTH ? next : base;
}

function buildCompactReferralSms(base: string, details: string[], adminUrl: string) {
  let message = details.reduce(appendIfFits, base);
  message = appendIfFits(message, `Review: ${adminUrl}`);
  return compactSmsMessage(message);
}

export function formatNewReferralSms(data: ReferralAlertCopyData) {
  const url = getAdminLeadUrl(data.referralId);
  return buildCompactReferralSms(
    `RC new lead: ${truncate(cleanPart(data.leadName), 36)}`,
    leadDetailParts(data),
    url
  );
}

export function formatReferralReminderSms(data: ReferralAlertCopyData) {
  const url = getAdminLeadUrl(data.referralId);
  return buildCompactReferralSms(
    `RC follow-up: ${truncate(cleanPart(data.leadName), 30)} new ${data.ageLabel || 'over 1h'}`,
    leadDetailParts(data),
    url
  );
}
