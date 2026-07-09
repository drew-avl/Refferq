import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminActor, isFullAdmin } from '@/lib/admin-access';
import { PAYOUT_EVENT_INCLUDE } from '@/lib/referral-event-payload';
import { sendPayoutToTwenty } from '@/lib/twenty-referrals';

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

    const payout = await prisma.payout.findUnique({
      where: { id: params.id },
      include: PAYOUT_EVENT_INCLUDE,
    });

    if (!payout) {
      return NextResponse.json(
        { error: 'Payout not found' },
        { status: 404 }
      );
    }

    const result = await sendPayoutToTwenty(payout, 'payout.updated');

    return NextResponse.json({
      success: result.status === 'success',
      result,
    }, {
      status: result.status === 'failed' ? 502 : 200,
    });
  } catch (error) {
    console.error('Send payout to TwentyCRM error:', error);
    return NextResponse.json(
      { error: 'Failed to send payout to TwentyCRM' },
      { status: 500 }
    );
  }
}
