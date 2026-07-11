import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getReferralMetadataDetails } from '@/lib/referrals';
import {
  formatLeadAgeLabel,
  formatReferralReminderSms,
  formatReferralTimestamp,
  getAdminLeadUrl,
} from '@/lib/referral-alerts';

const REMINDER_METADATA_KEY = 'unactionedReminderSentAt';
const REMINDER_EMAIL_METADATA_KEY = 'unactionedReminderEmailSent';
const REMINDER_SMS_METADATA_KEY = 'unactionedReminderSmsSent';

function toPlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getNumberEnv(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
}

function getReminderConfig() {
  return {
    timeZone: process.env.REFERRAL_REMINDER_TIME_ZONE || 'America/New_York',
    startHour: getNumberEnv('REFERRAL_REMINDER_BUSINESS_START_HOUR', 8),
    endHour: getNumberEnv('REFERRAL_REMINDER_BUSINESS_END_HOUR', 17),
    delayMinutes: getNumberEnv('REFERRAL_REMINDER_DELAY_MINUTES', 60),
    batchSize: getNumberEnv('REFERRAL_REMINDER_BATCH_SIZE', 25),
  };
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const cronSecret = request.headers.get('x-cron-secret');
  const authorization = request.headers.get('authorization') || '';

  return cronSecret === secret || authorization === `Bearer ${secret}`;
}

function isBusinessTime(now: Date, timeZone: string, startHour: number, endHour: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);

  return (
    weekday !== 'Sat' &&
    weekday !== 'Sun' &&
    Number.isFinite(hour) &&
    hour >= startHour &&
    hour < endHour
  );
}

function getBusinessMinutesElapsed(
  start: Date,
  end: Date,
  timeZone: string,
  startHour: number,
  endHour: number,
  maxMinutes: number
) {
  if (start >= end) return 0;

  let minutes = 0;
  const cursor = new Date(start);
  cursor.setSeconds(0, 0);

  while (cursor < end && minutes < maxMinutes) {
    if (isBusinessTime(cursor, timeZone, startHour, endHour)) {
      minutes += 1;
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return minutes;
}

async function handleReferralReminders(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = getReminderConfig();
  const now = new Date();

  if (!isBusinessTime(now, config.timeZone, config.startHour, config.endHour)) {
    return NextResponse.json({
      success: true,
      skipped: true,
      message: 'Outside referral reminder business hours',
      timeZone: config.timeZone,
      businessHours: `${config.startHour}:00-${config.endHour}:00`,
    });
  }

  const cutoff = new Date(now.getTime() - config.delayMinutes * 60_000);
  const referrals = await prisma.referral.findMany({
    where: {
      status: 'NEW',
      reviewedAt: null,
      createdAt: { lte: cutoff },
    },
    include: {
      program: {
        select: {
          name: true,
        },
      },
      affiliate: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: config.batchSize,
  });

  let sent = 0;
  let skippedAlreadySent = 0;
  let skippedNotDue = 0;
  const failures: Array<{ referralId: string; leadName: string; email?: string; sms?: string }> = [];

  for (const referral of referrals) {
    const metadata = toPlainObject(referral.metadata);
    if (metadata[REMINDER_METADATA_KEY]) {
      skippedAlreadySent += 1;
      continue;
    }

    const businessMinutesElapsed = getBusinessMinutesElapsed(
      referral.createdAt,
      now,
      config.timeZone,
      config.startHour,
      config.endHour,
      config.delayMinutes
    );
    if (businessMinutesElapsed < config.delayMinutes) {
      skippedNotDue += 1;
      continue;
    }

    const details = getReferralMetadataDetails(referral.metadata);
    const ageLabel = formatLeadAgeLabel(referral.createdAt, now);
    const adminUrl = getAdminLeadUrl(referral.id);
    const emailData = {
      referralId: referral.id,
      affiliateName: referral.affiliate.user.name,
      leadName: referral.leadName,
      leadEmail: referral.leadEmail,
      leadPhone: referral.leadPhone || '',
      company: details.company,
      estimatedValue: details.estimatedValue ? Math.round(details.estimatedValue * 100) : 0,
      address: details.address,
      address2: details.address2,
      moveInDate: details.moveInDate,
      notes: referral.notes || details.notes,
      programName: referral.program?.name || '',
      submittedAt: formatReferralTimestamp(referral.createdAt, config.timeZone),
      adminUrl,
      ageLabel,
    };

    let emailSuccess = false;
    let smsSuccess = false;
    let emailMessage = '';
    let smsMessage = '';

    try {
      const { emailService } = await import('@/lib/email');
      const result = await emailService.sendReferralFollowUpNotification(emailData, {
        affiliateId: referral.affiliateId,
      });
      emailSuccess = result.success;
      emailMessage = result.message;
    } catch (error) {
      emailMessage = error instanceof Error ? error.message : 'Failed to send reminder email';
      console.error('Failed to send referral follow-up email:', error);
    }

    try {
      const { smsService } = await import('@/lib/sms');
      const result = await smsService.sendAdminAlert(
        formatReferralReminderSms({
          referralId: referral.id,
          affiliateName: referral.affiliate.user.name,
          leadName: referral.leadName,
          leadEmail: referral.leadEmail,
          leadPhone: referral.leadPhone,
          company: details.company,
          address: details.address,
          address2: details.address2,
          programName: referral.program?.name || '',
          ageLabel,
        })
      );
      smsSuccess = result.success;
      smsMessage = result.success
        ? `Referral follow-up SMS sent to ${result.sent} recipient(s)`
        : result.results.map((item) => item.message).join('; ');
      if (!result.success) {
        console.error('Failed to send referral follow-up SMS:', result.results);
      }
    } catch (error) {
      smsMessage = error instanceof Error ? error.message : 'Failed to send reminder SMS';
      console.error('Failed to send referral follow-up SMS:', error);
    }

    if (emailSuccess || smsSuccess) {
      await prisma.referral.updateMany({
        where: {
          id: referral.id,
          status: 'NEW',
        },
        data: {
          metadata: {
            ...metadata,
            [REMINDER_METADATA_KEY]: now.toISOString(),
            [REMINDER_EMAIL_METADATA_KEY]: emailSuccess,
            [REMINDER_SMS_METADATA_KEY]: smsSuccess,
          },
        },
      });
      sent += 1;
    } else {
      failures.push({
        referralId: referral.id,
        leadName: referral.leadName,
        email: emailMessage,
        sms: smsMessage,
      });
    }
  }

  return NextResponse.json({
    success: failures.length === 0,
    checked: referrals.length,
    sent,
    skippedAlreadySent,
    skippedNotDue,
    failed: failures.length,
    failures,
  });
}

export async function GET(request: NextRequest) {
  return handleReferralReminders(request);
}

export async function POST(request: NextRequest) {
  return handleReferralReminders(request);
}
