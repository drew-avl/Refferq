import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { PAYOUT_EVENT_INCLUDE, REFERRAL_EVENT_INCLUDE, REFERRAL_PARTNER_EVENT_INCLUDE } from '@/lib/referral-event-payload';
import { sendPayoutToTwenty, sendReferralPartnerToTwenty, sendReferralToTwenty } from '@/lib/twenty-referrals';
import { claimOutboxEvents, recordOutboxFailure, recordOutboxSuccess } from '@/lib/integrations/outbox';
import { TwentyApiClient, TwentyApiError } from './client';
import { deliverEnvelope, type OutboxEnvelope } from './upserts';

function syncMode() {
  const mode = (process.env.TWENTY_SYNC_MODE || 'api').trim().toLowerCase();
  if (!['api', 'workflow', 'off'].includes(mode)) throw new Error(`Unsupported TWENTY_SYNC_MODE: ${mode}`);
  return mode as 'api' | 'workflow' | 'off';
}

async function deliverWorkflow(entityType: string, entityId: string, eventType: string) {
  if (entityType === 'referral') {
    const referral = await prisma.referral.findUnique({ where: { id: entityId }, include: REFERRAL_EVENT_INCLUDE });
    if (!referral) throw new Error(`Referral ${entityId} no longer exists.`);
    return sendReferralToTwenty(referral, eventType);
  }
  if (entityType === 'referral_partner') {
    const affiliate = await prisma.affiliate.findUnique({ where: { id: entityId }, include: REFERRAL_PARTNER_EVENT_INCLUDE });
    if (!affiliate) throw new Error(`Referral partner ${entityId} no longer exists.`);
    return sendReferralPartnerToTwenty(affiliate, eventType.replace('affiliate.', 'referral_partner.'));
  }
  if (entityType === 'payout') {
    const payout = await prisma.payout.findUnique({ where: { id: entityId }, include: PAYOUT_EVENT_INCLUDE });
    if (!payout) throw new Error(`Payout ${entityId} no longer exists.`);
    return sendPayoutToTwenty(payout, eventType);
  }
  throw new Error(`Legacy workflow mode does not support ${entityType}.`);
}

async function processEvent(event: Awaited<ReturnType<typeof claimOutboxEvents>>[number], workerId: string) {
  try {
    const mode = syncMode();
    if (mode === 'off') throw new Error('Twenty sync is paused (TWENTY_SYNC_MODE=off).');
    if (mode === 'workflow') {
      const result = await deliverWorkflow(event.entityType, event.entityId, event.eventType);
      if (result.status !== 'success') {
        throw new TwentyApiError(result.error || `Legacy workflow delivery ${result.status}.`, result.statusCode || 503, undefined, undefined, result.response);
      }
      await recordOutboxSuccess({
        id: event.id, workerId, statusCode: result.statusCode, response: result.response,
      });
      return { id: event.id, status: 'delivered' as const };
    }
    const client = new TwentyApiClient();
    const result = await deliverEnvelope(client, event.payload as unknown as OutboxEnvelope);
    await recordOutboxSuccess({
      id: event.id, workerId, statusCode: result.statusCode,
      requestId: result.requestId,
      response: JSON.stringify({ created: result.created, updated: result.updated, unchanged: result.unchanged }),
    });
    return { id: event.id, status: 'delivered' as const };
  } catch (error) {
    const apiError = error instanceof TwentyApiError ? error : null;
    await recordOutboxFailure({
      id: event.id, workerId,
      error: error instanceof Error ? error.message : String(error),
      statusCode: apiError?.status,
      requestId: apiError?.requestId,
      response: apiError?.response,
      retryAfterMs: apiError?.retryAfterMs,
      maxAttempts: Number(process.env.TWENTY_OUTBOX_MAX_ATTEMPTS || 10),
    });
    return { id: event.id, status: 'failed' as const, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function processTwentyOutbox(options: { batchSize?: number; concurrency?: number; workerId?: string } = {}) {
  const workerId = options.workerId || `twenty-${crypto.randomUUID()}`;
  const batchSize = Math.min(Math.max(options.batchSize || Number(process.env.TWENTY_OUTBOX_BATCH_SIZE || 20), 1), 50);
  const concurrency = Math.min(Math.max(options.concurrency || Number(process.env.TWENTY_OUTBOX_CONCURRENCY || 4), 1), 10);
  const events = await claimOutboxEvents({ workerId, limit: batchSize });
  const results: Array<Awaited<ReturnType<typeof processEvent>>> = [];
  for (let offset = 0; offset < events.length; offset += concurrency) {
    results.push(...await Promise.all(events.slice(offset, offset + concurrency).map((event) => processEvent(event, workerId))));
  }
  return {
    workerId,
    claimed: events.length,
    delivered: results.filter((result) => result.status === 'delivered').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  };
}
