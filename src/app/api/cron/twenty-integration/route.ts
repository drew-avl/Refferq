import { NextRequest, NextResponse } from 'next/server';
import { processTwentyInbox } from '@/lib/integrations/twenty/inbound';
import { processTwentyOutbox } from '@/lib/integrations/twenty/worker';
import { processOneReconciliationPage } from '@/lib/integrations/twenty/reconciliation';

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
}

async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const reconciliation = await processOneReconciliationPage();
  const [outbox, inbox] = await Promise.all([processTwentyOutbox(), processTwentyInbox()]);
  return NextResponse.json({ success: true, reconciliation, outbox, inbox });
}

export const GET = run;
export const POST = run;
