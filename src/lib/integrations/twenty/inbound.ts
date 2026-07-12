import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordReferralStatusChange } from '@/lib/referral-audit';
import { createCommissionAdjustment, createCompletedReferralCommission } from '@/lib/referral-payouts';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function text(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function timestampDate(value: string) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric);
  return new Date(value);
}

export function verifyTwentyWebhookSignature(options: {
  rawBody: string;
  timestamp: string;
  signature: string;
  secret: string;
  now?: Date;
  replayWindowSeconds?: number;
}) {
  const occurredAt = timestampDate(options.timestamp);
  if (Number.isNaN(occurredAt.getTime())) return { valid: false as const, reason: 'invalid-timestamp' as const };
  const replayWindowMs = Math.max(30, options.replayWindowSeconds || 300) * 1000;
  if (Math.abs((options.now || new Date()).getTime() - occurredAt.getTime()) > replayWindowMs) {
    return { valid: false as const, reason: 'stale-timestamp' as const };
  }
  const expected = crypto.createHmac('sha256', options.secret)
    .update(`${options.timestamp}:${options.rawBody}`)
    .digest('hex');
  const received = options.signature.replace(/^sha256=/i, '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(received)) return { valid: false as const, reason: 'invalid-signature' as const };
  const valid = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
  return valid ? { valid: true as const, occurredAt } : { valid: false as const, reason: 'invalid-signature' as const };
}

export function inboundEventId(payload: JsonObject, rawBody: string) {
  const explicit = text(payload.eventId || payload.id);
  return explicit || crypto.createHash('sha256').update(rawBody).digest('hex');
}

export async function acceptTwentyWebhook(options: {
  rawBody: string;
  timestamp: string;
  signature: string;
}) {
  const secret = process.env.TWENTY_OUTBOUND_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error('TWENTY_OUTBOUND_WEBHOOK_SECRET is not configured.');
  const verified = verifyTwentyWebhookSignature({
    ...options,
    secret,
    replayWindowSeconds: Number(process.env.TWENTY_WEBHOOK_REPLAY_WINDOW_SECONDS || 300),
  });
  if (!verified.valid) {
    const bodyHash = crypto.createHash('sha256').update(options.rawBody).digest('hex');
    const rejectionId = crypto.createHash('sha256').update(`${options.timestamp}:${options.signature}:${bodyHash}`).digest('hex');
    await prisma.inboundIntegrationEvent.upsert({
      where: { provider_eventId: { provider: 'twenty', eventId: `rejected:${rejectionId}` } },
      create: {
        provider: 'twenty', eventId: `rejected:${rejectionId}`,
        eventType: 'webhook.signature_rejected',
        payload: { reason: verified.reason, bodyHash },
        occurredAt: new Date(), status: 'FAILED', processedAt: new Date(), error: verified.reason,
      },
      update: {},
    });
    return { accepted: false as const, reason: verified.reason };
  }
  let payload: JsonObject;
  try { payload = object(JSON.parse(options.rawBody)); } catch { return { accepted: false as const, reason: 'invalid-json' as const }; }
  const eventId = inboundEventId(payload, options.rawBody);
  const eventType = text(payload.event);
  if (!eventType) return { accepted: false as const, reason: 'missing-event' as const };
  const data = object(payload.data);
  const remoteObject = eventType.split('.')[0] || null;
  const remoteId = text(data.id) || null;
  try {
    const event = await prisma.inboundIntegrationEvent.create({
      data: {
        provider: 'twenty', eventId, eventType, remoteObject, remoteId,
        payload: payload as Prisma.InputJsonValue, occurredAt: verified.occurredAt,
      },
    });
    return { accepted: true as const, duplicate: false, id: event.id, eventId };
  } catch (error: unknown) {
    if (object(error).code === 'P2002') {
      const event = await prisma.inboundIntegrationEvent.findUnique({
        where: { provider_eventId: { provider: 'twenty', eventId } },
      });
      return { accepted: true as const, duplicate: true, id: event?.id, eventId };
    }
    throw error;
  }
}

async function integrationActorId() {
  if (process.env.TWENTY_INTEGRATION_ACTOR_ID) return process.env.TWENTY_INTEGRATION_ACTOR_ID;
  const actor = await prisma.user.findFirst({
    where: { role: 'ADMIN', status: 'ACTIVE' }, orderBy: { createdAt: 'asc' }, select: { id: true },
  });
  if (!actor) throw new Error('No active admin exists for integration audit attribution.');
  return actor.id;
}

function statusInstruction(data: JsonObject) {
  const stage = text(data.connectPathStage || data.stage || data.crmStatus).toUpperCase().replace(/\s+/g, '_');
  if (data.activationReversed === true || ['CHARGEBACK', 'ACTIVATION_REVERSED'].includes(stage)) return { kind: 'chargeback' as const };
  if (data.activationVerified === true) return { kind: 'status' as const, status: 'COMPLETED' as const };
  if (stage === 'CLOSED_LOST') return { kind: 'status' as const, status: 'REJECTED' as const };
  if (data.orderConfirmedAt || ['ORDER', 'ORDER_CONFIRMED'].includes(stage)) return { kind: 'status' as const, status: 'SOLD' as const };
  return { kind: 'ignore' as const };
}

function canApplyTwentyStatus(current: string, next: 'SOLD' | 'COMPLETED' | 'REJECTED') {
  if (current === next) return 'same' as const;
  if (next === 'SOLD') return ['NEW', 'PENDING'].includes(current) ? 'apply' as const : 'stale' as const;
  if (next === 'COMPLETED') return ['NEW', 'PENDING', 'SOLD'].includes(current) ? 'apply' as const : 'stale' as const;
  if (next === 'REJECTED') return current === 'REJECTED' ? 'same' as const : 'apply' as const;
  return 'invalid' as const;
}

async function processInboundEvent(id: string) {
  const claimed = await prisma.inboundIntegrationEvent.updateMany({
    where: { id, status: 'ACCEPTED' }, data: { status: 'PROCESSING' },
  });
  if (claimed.count !== 1) return { id, status: 'not-claimed' as const };
  const event = await prisma.inboundIntegrationEvent.findUnique({ where: { id } });
  if (!event) return { id, status: 'not-found' as const };
  try {
    const payload = object(event.payload);
    const data = object(payload.data);
    const supported = ['referconnectreferral', 'opportunity'].includes((event.remoteObject || '').toLowerCase());
    if (!supported || text(data.syncOrigin).toLowerCase() === 'refferq') {
      await prisma.inboundIntegrationEvent.update({
        where: { id }, data: { status: 'IGNORED', processedAt: new Date() },
      });
      return { id, status: 'ignored' as const };
    }
    const referralId = text(data.referralId || data.refferqReferralId || data.sourceExternalId);
    if (!referralId) throw new Error('Supported Twenty event is missing a Refferq referral ID.');
    const referral = await prisma.referral.findUnique({ where: { id: referralId } });
    if (!referral) throw new Error(`Refferq referral ${referralId} was not found.`);
    const instruction = statusInstruction(data);
    const actorId = await integrationActorId();
    if (instruction.kind === 'ignore') {
      await prisma.inboundIntegrationEvent.update({ where: { id }, data: { status: 'IGNORED', processedAt: new Date() } });
      return { id, status: 'ignored' as const };
    }
    if (instruction.kind === 'chargeback') {
      const commission = await prisma.commission.findFirst({
        where: { OR: [{ completionKey: `referral-completion:${referralId}` }, { conversion: { referralId } }] },
      });
      if (!commission) throw new Error('Activation reversal has no completed referral commission to adjust.');
      await createCommissionAdjustment({
        commissionId: commission.id,
        type: 'CLAWBACK',
        amountCents: -Math.abs(Number(data.chargebackAmountCents || commission.amountCents)),
        reason: text(data.chargebackReason || data.rejectionReason || 'Activation reversed in Twenty'),
        externalEventId: event.eventId,
        createdBy: actorId,
      });
    } else if (referral.status !== instruction.status) {
      const transition = canApplyTwentyStatus(referral.status, instruction.status);
      if (transition === 'stale' || transition === 'same') {
        await prisma.inboundIntegrationEvent.update({ where: { id }, data: { status: 'IGNORED', processedAt: new Date() } });
        return { id, status: 'ignored' as const };
      }
      if (transition !== 'apply') throw new Error(`Twenty cannot move referral from ${referral.status} to ${instruction.status}.`);
      if (instruction.status === 'REJECTED' && !text(data.rejectionReason)) {
        throw new Error('Closed Lost requires a rejection reason.');
      }
      await prisma.$transaction(async (tx) => {
        await tx.referral.update({
          where: { id: referral.id },
          data: {
            status: instruction.status,
            reviewNotes: instruction.status === 'REJECTED' ? text(data.rejectionReason) : referral.reviewNotes,
            reviewedBy: actorId,
            reviewedAt: new Date(),
            syncOrigin: 'twenty',
            lastIntegrationEvent: event.eventId,
          },
        });
        await recordReferralStatusChange({
          tx, actorId, referralId: referral.id, fromStatus: referral.status, toStatus: instruction.status,
          reviewNotes: instruction.status === 'REJECTED' ? text(data.rejectionReason) : undefined,
          source: 'twenty-webhook',
        });
      });
      if (instruction.status === 'COMPLETED') await createCompletedReferralCommission(referral.id, actorId);
    }
    await prisma.inboundIntegrationEvent.update({
      where: { id }, data: { status: 'PROCESSED', processedAt: new Date(), error: null },
    });
    return { id, status: 'processed' as const };
  } catch (error) {
    await prisma.inboundIntegrationEvent.update({
      where: { id },
      data: { status: 'FAILED', processedAt: new Date(), error: (error instanceof Error ? error.message : String(error)).slice(0, 2000) },
    });
    return { id, status: 'failed' as const, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function processTwentyInbox(limit = 20) {
  const events = await prisma.inboundIntegrationEvent.findMany({
    where: { provider: 'twenty', status: 'ACCEPTED' },
    orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    take: Math.min(Math.max(limit, 1), 100),
    select: { id: true },
  });
  const results = [];
  for (const event of events) results.push(await processInboundEvent(event.id));
  return {
    claimed: events.length,
    processed: results.filter((result) => result.status === 'processed').length,
    ignored: results.filter((result) => result.status === 'ignored').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  };
}
