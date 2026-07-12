import crypto from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type DbClient = Prisma.TransactionClient | PrismaClient;

export interface IntegrationEventInput {
  provider?: string;
  eventId?: string;
  eventType: string;
  entityType: 'referral' | 'referral_partner' | 'payout' | 'property' | 'provider_availability' | 'visit';
  entityId: string;
  sourceVersion?: number;
  occurredAt?: Date;
  data: Record<string, unknown>;
}

export function redactIntegrationPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactIntegrationPayload);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
    key,
    /password|secret|token|api.?key|bank|routing|account.?number|ssn|tax.?id|card/i.test(key)
      ? '[REDACTED]'
      : redactIntegrationPayload(child),
  ]));
}

export async function enqueueIntegrationEvent(db: DbClient, input: IntegrationEventInput) {
  const eventId = input.eventId || crypto.randomUUID();
  const occurredAt = input.occurredAt || new Date();
  const sourceVersion = Math.max(1, input.sourceVersion || 1);
  const payload = redactIntegrationPayload({
    contractVersion: 1,
    eventId,
    event: input.eventType,
    source: 'refferq',
    sourceVersion,
    occurredAt: occurredAt.toISOString(),
    entity: input.entityType,
    entityId: input.entityId,
    data: input.data,
  }) as Prisma.InputJsonValue;

  return db.integrationOutboxEvent.create({
    data: {
      eventId,
      provider: input.provider || 'twenty',
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      sourceVersion,
      payload,
    },
  });
}

export async function claimOutboxEvents(options: {
  workerId: string;
  limit?: number;
  leaseMs?: number;
}) {
  const limit = Math.min(Math.max(options.limit || 10, 1), 50);
  const leaseMs = Math.max(options.leaseMs || 5 * 60_000, 30_000);
  const now = new Date();
  const staleBefore = new Date(now.getTime() - leaseMs);
  const candidates = await prisma.integrationOutboxEvent.findMany({
    where: {
      provider: 'twenty',
      availableAt: { lte: now },
      OR: [
        { status: { in: ['PENDING', 'RETRY'] } },
        { status: 'PROCESSING', lockedAt: { lt: staleBefore } },
      ],
    },
    orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
    take: limit * 2,
    select: { id: true },
  });

  const claimed: string[] = [];
  for (const candidate of candidates) {
    if (claimed.length >= limit) break;
    const result = await prisma.integrationOutboxEvent.updateMany({
      where: {
        id: candidate.id,
        availableAt: { lte: now },
        OR: [
          { status: { in: ['PENDING', 'RETRY'] } },
          { status: 'PROCESSING', lockedAt: { lt: staleBefore } },
        ],
      },
      data: { status: 'PROCESSING', lockedAt: now, lockedBy: options.workerId },
    });
    if (result.count === 1) claimed.push(candidate.id);
  }

  return prisma.integrationOutboxEvent.findMany({
    where: { id: { in: claimed }, lockedBy: options.workerId, status: 'PROCESSING' },
    orderBy: { createdAt: 'asc' },
  });
}

function retryDelayMs(attempt: number) {
  const base = Math.min(60 * 60_000, 2 ** Math.min(attempt, 10) * 1000);
  return base + Math.floor(Math.random() * Math.max(250, base * 0.2));
}

export async function recordOutboxSuccess(options: {
  id: string;
  workerId: string;
  statusCode?: number;
  requestId?: string;
  response?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.integrationOutboxEvent.findFirst({
      where: { id: options.id, lockedBy: options.workerId, status: 'PROCESSING' },
    });
    if (!event) return null;
    const attempt = event.attempts + 1;
    await tx.integrationDeliveryAttempt.create({
      data: {
        outboxId: event.id,
        attempt,
        status: 'SUCCESS',
        statusCode: options.statusCode,
        requestId: options.requestId,
        response: options.response?.slice(0, 2000),
        completedAt: new Date(),
      },
    });
    return tx.integrationOutboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'DELIVERED', attempts: attempt, cycleAttempts: event.cycleAttempts + 1, deliveredAt: new Date(),
        lockedAt: null, lockedBy: null, lastError: null,
      },
    });
  });
}

export async function recordOutboxFailure(options: {
  id: string;
  workerId: string;
  error: string;
  statusCode?: number;
  requestId?: string;
  response?: string;
  maxAttempts?: number;
  retryAfterMs?: number;
}) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.integrationOutboxEvent.findFirst({
      where: { id: options.id, lockedBy: options.workerId, status: 'PROCESSING' },
    });
    if (!event) return null;
    const attempt = event.attempts + 1;
    const cycleAttempt = event.cycleAttempts + 1;
    const deadLetter = cycleAttempt >= (options.maxAttempts || 10);
    const now = new Date();
    await tx.integrationDeliveryAttempt.create({
      data: {
        outboxId: event.id,
        attempt,
        status: 'FAILED',
        statusCode: options.statusCode,
        requestId: options.requestId,
        response: options.response?.slice(0, 2000),
        error: options.error.slice(0, 2000),
        completedAt: now,
      },
    });
    return tx.integrationOutboxEvent.update({
      where: { id: event.id },
      data: {
        status: deadLetter ? 'DEAD_LETTER' : 'RETRY',
        attempts: attempt,
        cycleAttempts: cycleAttempt,
        availableAt: deadLetter ? event.availableAt : new Date(now.getTime() + Math.max(retryDelayMs(attempt), options.retryAfterMs || 0)),
        deadLetteredAt: deadLetter ? now : null,
        lockedAt: null,
        lockedBy: null,
        lastError: options.error.slice(0, 2000),
      },
    });
  });
}

export async function replayOutboxEvent(id: string) {
  return prisma.integrationOutboxEvent.update({
    where: { id },
    data: {
      status: 'PENDING', cycleAttempts: 0, availableAt: new Date(), lockedAt: null,
      lockedBy: null, deliveredAt: null, deadLetteredAt: null, lastError: null,
    },
  });
}
