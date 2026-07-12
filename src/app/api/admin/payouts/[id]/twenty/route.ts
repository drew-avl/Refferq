import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor, isFullAdmin } from '@/lib/admin-access';
import { notifyPayoutChanged } from '@/lib/referral-integrations';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const user = await getAdminActor(request);

    if (!isFullAdmin(user)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const result = await notifyPayoutChanged(params.id, 'payout.updated');

    return NextResponse.json({
      success: true,
      queued: true,
      result,
    }, { status: 202 });
  } catch (error) {
    console.error('Send payout to TwentyCRM error:', error);
    return NextResponse.json(
      { error: 'Failed to send payout to TwentyCRM' },
      { status: 500 }
    );
  }
}
