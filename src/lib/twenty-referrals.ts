import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  buildTwentyPayoutWebhookPayload,
  buildTwentyReferralPartnerWebhookPayload,
  buildTwentyReferralWebhookPayload,
  type PayoutWithEventRelations,
  type ReferralPartnerWithEventRelations,
  type ReferralWithEventRelations,
} from '@/lib/referral-event-payload';

type TwentySyncStatus = 'skipped' | 'success' | 'failed';
type TwentySyncView = 'referral_list' | 'referral_partners' | 'payouts';

export interface TwentySyncResult {
  status: TwentySyncStatus;
  method: 'webhook';
  configured: boolean;
  view: TwentySyncView;
  event: string;
  statusCode?: number;
  response?: string;
  error?: string;
}

function isDisabled(value: string | undefined): boolean {
  if (!value) return false;
  return ['0', 'false', 'off', 'no'].includes(value.trim().toLowerCase());
}

function getWebhookUrl(view: TwentySyncView): string | null {
  const viewWebhookUrls: Record<TwentySyncView, string | undefined> = {
    referral_list: process.env.TWENTY_REFERRAL_WEBHOOK_URL,
    referral_partners: process.env.TWENTY_PARTNER_WEBHOOK_URL,
    payouts: process.env.TWENTY_PAYOUT_WEBHOOK_URL,
  };
  const webhookUrl = viewWebhookUrls[view]?.trim() || process.env.TWENTY_WEBHOOK_URL?.trim();
  return webhookUrl || null;
}

function isSyncDisabled(view: TwentySyncView): boolean {
  if (isDisabled(process.env.TWENTY_SYNC_ENABLED)) return true;

  const viewFlags: Record<TwentySyncView, string | undefined> = {
    referral_list: process.env.TWENTY_REFERRAL_SYNC_ENABLED,
    referral_partners: process.env.TWENTY_PARTNER_SYNC_ENABLED,
    payouts: process.env.TWENTY_PAYOUT_SYNC_ENABLED,
  };

  return isDisabled(viewFlags[view]);
}

function getTimeoutMs(): number {
  const timeoutMs = Number(process.env.TWENTY_WEBHOOK_TIMEOUT_MS || 12000);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000;
}

function validateWebhookUrl(urlString: string): string | null {
  try {
    const parsed = new URL(urlString);
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return 'Twenty webhook URL must use http or https';
    }
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return 'Twenty webhook URL must use https in production';
    }
    return null;
  } catch {
    return 'Twenty webhook URL is invalid';
  }
}

function createSignature(payload: string, timestamp: string, secret: string): string {
  return `sha256=${crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}:${payload}`)
    .digest('hex')}`;
}

function toPlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

async function recordTwentySyncResult(
  referral: ReferralWithEventRelations,
  result: TwentySyncResult
) {
  if (result.status === 'skipped') return;

  const metadata = toPlainObject(referral.metadata);
  const integrations = toPlainObject(metadata.integrations);
  const priorTwenty = toPlainObject(integrations.twenty);
  const priorAttempts = Number(priorTwenty.attempts || 0);

  await prisma.referral.update({
    where: { id: referral.id },
    data: {
      metadata: {
        ...metadata,
        integrations: {
          ...integrations,
          twenty: {
            view: result.view,
            event: result.event,
            method: result.method,
            status: result.status,
            attempts: Number.isFinite(priorAttempts) ? priorAttempts + 1 : 1,
            lastAttemptAt: new Date().toISOString(),
            statusCode: result.statusCode || null,
            error: result.error ? result.error.slice(0, 500) : null,
            response: result.response ? result.response.slice(0, 500) : null,
          },
        },
      },
    },
  });
}

async function recordTwentyPartnerSyncResult(
  affiliate: ReferralPartnerWithEventRelations,
  result: TwentySyncResult
) {
  if (result.status === 'skipped') return;

  const payoutDetails = toPlainObject(affiliate.payoutDetails);
  const integrations = toPlainObject(payoutDetails.integrations);
  const priorTwenty = toPlainObject(integrations.twenty);
  const priorAttempts = Number(priorTwenty.attempts || 0);

  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: {
      payoutDetails: {
        ...payoutDetails,
        integrations: {
          ...integrations,
          twenty: {
            view: result.view,
            event: result.event,
            method: result.method,
            status: result.status,
            attempts: Number.isFinite(priorAttempts) ? priorAttempts + 1 : 1,
            lastAttemptAt: new Date().toISOString(),
            statusCode: result.statusCode || null,
            error: result.error ? result.error.slice(0, 500) : null,
            response: result.response ? result.response.slice(0, 500) : null,
          },
        },
      },
    },
  });
}

async function postTwentyWebhook(
  view: TwentySyncView,
  event: string,
  recordId: string,
  payload: Record<string, unknown>
): Promise<TwentySyncResult> {
  if (isSyncDisabled(view)) {
    return { status: 'skipped', method: 'webhook', configured: false, view, event };
  }

  const webhookUrl = getWebhookUrl(view);
  if (!webhookUrl) {
    return { status: 'skipped', method: 'webhook', configured: false, view, event };
  }

  const validationError = validateWebhookUrl(webhookUrl);
  if (validationError) {
    return {
      status: 'failed',
      method: 'webhook',
      configured: true,
      view,
      event,
      error: validationError,
    };
  }

  const body = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const secret = process.env.TWENTY_WEBHOOK_SECRET?.trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ReferConnect-Event': event,
        'X-ReferConnect-Record-Id': recordId,
        'X-ReferConnect-View': view,
        'X-ReferConnect-Timestamp': timestamp,
        ...(secret ? { 'X-ReferConnect-Signature': createSignature(body, timestamp, secret) } : {}),
      },
      body,
      signal: controller.signal,
    });

    const responseText = await response.text().catch(() => '');
    return {
      status: response.ok ? 'success' : 'failed',
      method: 'webhook',
      configured: true,
      view,
      event,
      statusCode: response.status,
      response: responseText,
      error: response.ok ? undefined : `Twenty webhook returned HTTP ${response.status}`,
    };
  } catch (error: any) {
    return {
      status: 'failed',
      method: 'webhook',
      configured: true,
      view,
      event,
      error: error?.name === 'AbortError' ? 'Twenty webhook timed out' : error?.message || 'Twenty webhook failed',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function sendReferralToTwenty(
  referral: ReferralWithEventRelations,
  event = 'referral.submitted'
): Promise<TwentySyncResult> {
  const result = await postTwentyWebhook(
    'referral_list',
    event,
    referral.id,
    buildTwentyReferralWebhookPayload(referral, event)
  );

  await recordTwentySyncResult(referral, result);
  return result;
}

export async function sendReferralPartnerToTwenty(
  affiliate: ReferralPartnerWithEventRelations,
  event = 'referral_partner.updated'
): Promise<TwentySyncResult> {
  const result = await postTwentyWebhook(
    'referral_partners',
    event,
    affiliate.id,
    buildTwentyReferralPartnerWebhookPayload(affiliate, event)
  );

  await recordTwentyPartnerSyncResult(affiliate, result);
  return result;
}

export async function sendPayoutToTwenty(
  payout: PayoutWithEventRelations,
  event = 'payout.updated'
): Promise<TwentySyncResult> {
  return postTwentyWebhook(
    'payouts',
    event,
    payout.id,
    buildTwentyPayoutWebhookPayload(payout, event)
  );
}
