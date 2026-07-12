import { prisma } from '@/lib/prisma';
import {
  buildPayoutEventData, buildReferralPartnerEventData, buildReferralSubmittedEventData,
  PAYOUT_EVENT_INCLUDE, REFERRAL_EVENT_INCLUDE, REFERRAL_PARTNER_EVENT_INCLUDE,
} from '@/lib/referral-event-payload';
import { enqueueIntegrationEvent } from '@/lib/integrations/outbox';

const ENTITIES = ['referral', 'referral_partner', 'payout'] as const;
type EntityType = typeof ENTITIES[number];
type ReconciliationMode = 'dry-run' | 'missing-only' | 'changed-since' | 'full' | 'entity-specific' | 'verify-only';

type Counts = {
  scanned: number; created: number; updated: number; unchanged: number;
  ambiguous: number; failed: number; skipped: number; retried: number;
};

const emptyCounts = (): Counts => ({
  scanned: 0, created: 0, updated: 0, unchanged: 0,
  ambiguous: 0, failed: 0, skipped: 0, retried: 0,
});

function asCounts(value: unknown): Counts {
  const input = value && typeof value === 'object' ? value as Partial<Counts> : {};
  return Object.fromEntries(Object.keys(emptyCounts()).map((key) => [key, Number(input[key as keyof Counts] || 0)])) as Counts;
}

export async function createReconciliationJob(options: {
  mode: ReconciliationMode;
  entityType?: EntityType;
  requestedBy: string;
  changedSince?: string;
}) {
  if (options.mode === 'entity-specific' && !options.entityType) throw new Error('entity-specific mode requires entityType.');
  return prisma.integrationReconciliationJob.create({
    data: {
      provider: 'twenty', mode: options.mode, entityType: options.entityType,
      requestedBy: options.requestedBy,
      checkpoint: { entityIndex: 0, changedSince: options.changedSince || null },
      counts: emptyCounts(),
    },
  });
}

function checkpoint(value: unknown) {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { entityIndex: Number(data.entityIndex || 0), changedSince: typeof data.changedSince === 'string' ? data.changedSince : null };
}

function remoteObject(entity: EntityType) {
  return entity === 'referral' ? 'referConnectReferral' : entity === 'referral_partner' ? 'referConnectReferralPartner' : 'referConnectPayout';
}

async function recordsFor(entity: EntityType, cursor: string | null, take: number) {
  const where = cursor ? { id: { gt: cursor } } : {};
  if (entity === 'referral') return prisma.referral.findMany({ where, include: REFERRAL_EVENT_INCLUDE, orderBy: { id: 'asc' }, take });
  if (entity === 'referral_partner') return prisma.affiliate.findMany({ where, include: REFERRAL_PARTNER_EVENT_INCLUDE, orderBy: { id: 'asc' }, take });
  return prisma.payout.findMany({ where, include: PAYOUT_EVENT_INCLUDE, orderBy: { id: 'asc' }, take });
}

function eventFor(entity: EntityType, record: Awaited<ReturnType<typeof recordsFor>>[number]) {
  if (entity === 'referral') return buildReferralSubmittedEventData(record as Parameters<typeof buildReferralSubmittedEventData>[0], 'referral.updated');
  if (entity === 'referral_partner') return buildReferralPartnerEventData(record as Parameters<typeof buildReferralPartnerEventData>[0], 'affiliate.updated');
  return buildPayoutEventData(record as Parameters<typeof buildPayoutEventData>[0], 'payout.updated');
}

function eventType(entity: EntityType) {
  return entity === 'referral' ? 'referral.updated' : entity === 'referral_partner' ? 'referral_partner.updated' : 'payout.updated';
}

export async function processOneReconciliationPage(batchSize = 50) {
  const job = await prisma.integrationReconciliationJob.findFirst({
    where: { provider: 'twenty', status: { in: ['PENDING', 'RUNNING'] } },
    orderBy: { createdAt: 'asc' },
  });
  if (!job) return { processed: false as const };
  const claimed = await prisma.integrationReconciliationJob.updateMany({
    where: { id: job.id, updatedAt: job.updatedAt, status: { in: ['PENDING', 'RUNNING'] } },
    data: { status: 'RUNNING', startedAt: job.startedAt || new Date() },
  });
  if (claimed.count !== 1) return { processed: false as const };

  const state = checkpoint(job.checkpoint);
  const entities: readonly EntityType[] = job.entityType ? [job.entityType as EntityType] : ENTITIES;
  const entity = entities[state.entityIndex];
  if (!entity) {
    await prisma.integrationReconciliationJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    return { processed: true as const, completed: true as const, jobId: job.id };
  }
  const counts = asCounts(job.counts);
  const report = job.report && typeof job.report === 'object' ? job.report as Record<string, unknown> : {};
  const failures = Array.isArray(report.failures) ? [...report.failures] : [];
  const records = await recordsFor(entity, job.cursor, Math.min(Math.max(batchSize, 1), 60));

  for (const record of records) {
    counts.scanned += 1;
    try {
      const mapping = await prisma.integrationObjectMap.findUnique({
        where: {
          provider_localEntityType_localEntityId_remoteObject: {
            provider: 'twenty', localEntityType: entity, localEntityId: record.id, remoteObject: remoteObject(entity),
          },
        },
      });
      const changedSince = state.changedSince ? new Date(state.changedSince) : null;
      const shouldQueue = !['dry-run', 'verify-only'].includes(job.mode) && (
        job.mode === 'full' || job.mode === 'entity-specific' ||
        (job.mode === 'missing-only' && !mapping) ||
        (job.mode === 'changed-since' && (!mapping || record.updatedAt > (changedSince || mapping.lastSyncedAt)))
      );
      if (!shouldQueue) {
        if (!mapping && ['dry-run', 'verify-only', 'missing-only'].includes(job.mode)) counts.skipped += 1;
        else counts.unchanged += 1;
        continue;
      }
      await enqueueIntegrationEvent(prisma, {
        eventType: eventType(entity), entityType: entity, entityId: record.id,
        sourceVersion: entity === 'referral' && 'sourceVersion' in record
          ? Number(record.sourceVersion) : Math.max(1, Math.floor(record.updatedAt.getTime() / 1000)),
        occurredAt: record.updatedAt,
        data: eventFor(entity, record),
      });
      if (mapping) counts.updated += 1; else counts.created += 1;
    } catch (error) {
      counts.failed += 1;
      if (failures.length < 100) failures.push({ id: record.id, entity, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const finishedEntity = records.length < Math.min(Math.max(batchSize, 1), 60);
  const nextEntityIndex = finishedEntity ? state.entityIndex + 1 : state.entityIndex;
  const completed = finishedEntity && nextEntityIndex >= entities.length;
  await prisma.integrationReconciliationJob.update({
    where: { id: job.id },
    data: {
      cursor: finishedEntity ? null : records.at(-1)?.id || job.cursor,
      checkpoint: { ...state, entityIndex: nextEntityIndex },
      counts,
      report: { failures },
      status: completed ? 'COMPLETED' : 'RUNNING',
      completedAt: completed ? new Date() : null,
      error: counts.failed > 0 ? `${counts.failed} item(s) failed; see redacted report.` : null,
    },
  });
  return { processed: true as const, completed, jobId: job.id, entity, pageCount: records.length, counts };
}

