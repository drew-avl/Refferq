import { NextRequest, NextResponse } from 'next/server';
import { canAccessAffiliate, getAdminActor } from '@/lib/admin-access';
import { notifyReferralPartnerChanged } from '@/lib/referral-integrations';

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

    const result = await notifyReferralPartnerChanged(params.id, 'affiliate.updated');

    return NextResponse.json({
      success: true,
      queued: true,
      result,
    }, { status: 202 });
  } catch (error) {
    console.error('Send referral partner to TwentyCRM error:', error);
    return NextResponse.json(
      { error: 'Failed to send referral partner to TwentyCRM' },
      { status: 500 }
    );
  }
}
