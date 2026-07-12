import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor, isFullAdmin } from '@/lib/admin-access';
import { createReconciliationJob } from '@/lib/integrations/twenty/reconciliation';

const MODES = ['dry-run', 'missing-only', 'changed-since', 'full', 'entity-specific', 'verify-only'] as const;
const ENTITIES = ['referral', 'referral_partner', 'payout'] as const;

export async function POST(request: NextRequest) {
  try {
    const user = await getAdminActor(request);
    if (!isFullAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const mode = MODES.includes(body.mode) ? body.mode : 'missing-only';
    const entityType = ENTITIES.includes(body.entityType) ? body.entityType : undefined;
    const job = await createReconciliationJob({
      mode, entityType, requestedBy: user!.id,
      changedSince: typeof body.changedSince === 'string' ? body.changedSince : undefined,
    });
    return NextResponse.json({ success: true, queued: true, job }, { status: 202 });
  } catch (error) {
    console.error('Twenty reconciliation job creation failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to queue reconciliation.' }, { status: 400 });
  }
}
