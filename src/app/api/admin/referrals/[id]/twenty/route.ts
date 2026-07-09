import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessReferral, getAdminActor } from '@/lib/admin-access';
import { REFERRAL_EVENT_INCLUDE } from '@/lib/referral-event-payload';
import { sendReferralToTwenty } from '@/lib/twenty-referrals';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const user = await getAdminActor(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Admin or staff access required' },
        { status: 403 }
      );
    }

    const allowed = await canAccessReferral(user, params.id);
    if (!allowed) {
      return NextResponse.json(
        { error: 'You can only send leads assigned to you' },
        { status: 403 }
      );
    }

    const referral = await prisma.referral.findUnique({
      where: { id: params.id },
      include: REFERRAL_EVENT_INCLUDE,
    });

    if (!referral) {
      return NextResponse.json(
        { error: 'Referral not found' },
        { status: 404 }
      );
    }

    const result = await sendReferralToTwenty(referral, 'referral.updated');

    return NextResponse.json({
      success: result.status === 'success',
      result,
    }, {
      status: result.status === 'failed' ? 502 : 200,
    });
  } catch (error) {
    console.error('Send referral to TwentyCRM error:', error);
    return NextResponse.json(
      { error: 'Failed to send referral to TwentyCRM' },
      { status: 500 }
    );
  }
}
