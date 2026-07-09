import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessAffiliate, getAdminActor } from '@/lib/admin-access';
import { REFERRAL_PARTNER_EVENT_INCLUDE } from '@/lib/referral-event-payload';
import { sendReferralPartnerToTwenty } from '@/lib/twenty-referrals';

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

    const allowed = await canAccessAffiliate(user, params.id);
    if (!allowed) {
      return NextResponse.json(
        { error: 'You can only send referral partners assigned to you' },
        { status: 403 }
      );
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { id: params.id },
      include: REFERRAL_PARTNER_EVENT_INCLUDE,
    });

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Referral partner not found' },
        { status: 404 }
      );
    }

    const result = await sendReferralPartnerToTwenty(affiliate, 'referral_partner.updated');

    return NextResponse.json({
      success: result.status === 'success',
      result,
    }, {
      status: result.status === 'failed' ? 502 : 200,
    });
  } catch (error) {
    console.error('Send referral partner to TwentyCRM error:', error);
    return NextResponse.json(
      { error: 'Failed to send referral partner to TwentyCRM' },
      { status: 500 }
    );
  }
}
