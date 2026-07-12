import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminActor, isFullAdmin } from '@/lib/admin-access';
import { replayOutboxEvent } from '@/lib/integrations/outbox';

export async function GET(request: NextRequest) {
  const user = await getAdminActor(request);
  if (!isFullAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const [outboxByStatus, inboxByStatus, signatureFailures, lastDelivery, recentDeadLetters, jobs] = await Promise.all([
    prisma.integrationOutboxEvent.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.inboundIntegrationEvent.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.inboundIntegrationEvent.count({ where: { eventType: 'webhook.signature_rejected' } }),
    prisma.integrationOutboxEvent.findFirst({ where: { status: 'DELIVERED' }, orderBy: { deliveredAt: 'desc' }, select: { deliveredAt: true } }),
    prisma.integrationOutboxEvent.findMany({
      where: { status: 'DEAD_LETTER' }, orderBy: { deadLetteredAt: 'desc' }, take: 25,
      select: { id: true, eventId: true, eventType: true, entityType: true, entityId: true, attempts: true, lastError: true, deadLetteredAt: true },
    }),
    prisma.integrationReconciliationJob.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);
  return NextResponse.json({
    success: true,
    mode: process.env.TWENTY_SYNC_MODE || 'api',
    configured: Boolean(process.env.TWENTY_API_BASE_URL && process.env.TWENTY_API_KEY),
    lastSuccessAt: lastDelivery?.deliveredAt || null,
    outbox: Object.fromEntries(outboxByStatus.map((row) => [row.status, row._count._all])),
    inbox: Object.fromEntries(inboxByStatus.map((row) => [row.status, row._count._all])),
    signatureFailures,
    deadLetters: recentDeadLetters,
    reconciliationJobs: jobs,
  });
}

export async function POST(request: NextRequest) {
  const user = await getAdminActor(request);
  if (!isFullAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (body.action !== 'replay' || typeof body.eventId !== 'string') {
    return NextResponse.json({ error: 'action=replay and eventId are required.' }, { status: 400 });
  }
  const event = await prisma.integrationOutboxEvent.findUnique({ where: { id: body.eventId } });
  if (!event || event.status !== 'DEAD_LETTER') return NextResponse.json({ error: 'Dead-letter event not found.' }, { status: 404 });
  const replayed = await replayOutboxEvent(event.id);
  return NextResponse.json({ success: true, event: { id: replayed.id, status: replayed.status } });
}
