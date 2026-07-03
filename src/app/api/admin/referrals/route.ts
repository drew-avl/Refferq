import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrencySettings } from '@/lib/currency';
import { getReferralMetadataDetails } from '@/lib/referrals';
import { createCompletedReferralCommission } from '@/lib/referral-payouts';
import { canTransitionReferralStatus, referralStatusFromAction } from '@/lib/referral-status';


export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }

    const [referrals, partnerGroups, currencySettings] = await Promise.all([
      prisma.referral.findMany({
        include: {
          program: {
            select: {
              id: true,
              name: true,
              referralPayoutCents: true,
              commissionRate: true,
              commissionType: true,
              currency: true,
            },
          },
          affiliate: {
            include: {
              user: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.partnerGroup.findMany(),
      getCurrencySettings(),
    ]);

    const partnerGroupMap = new Map(partnerGroups.map(pg => [pg.id, pg.name]));

    return NextResponse.json({
      success: true,
      referrals: referrals.map(referral => {
        const metadata = getReferralMetadataDetails(referral.metadata);
        const affiliate = referral.affiliate as any;
        const pgId = affiliate.partnerGroupId;
        const pgData = pgId ? partnerGroupMap.get(pgId) : null;
        
        return {
          id: referral.id,
          affiliateId: referral.affiliateId,
          leadEmail: referral.leadEmail,
          leadName: referral.leadName,
          leadPhone: referral.leadPhone,
          status: referral.status,
          notes: referral.notes || metadata.notes,
          createdAt: referral.createdAt,
          estimatedValue: metadata.estimatedValue,
          company: metadata.company,
          address: metadata.address,
          address2: metadata.address2,
          moveInDate: metadata.moveInDate,
          program: referral.program,
          referralPayoutCents: referral.program?.referralPayoutCents ?? null,
          affiliate: {
            id: affiliate.id,
            name: affiliate.user.name,
            email: affiliate.user.email,
            referralCode: affiliate.referralCode,
            partnerGroup: pgData || 'Not assigned',
            partnerGroupId: pgId,
            commissionRate: referral.program?.commissionType === 'PERCENTAGE'
              ? (referral.program.commissionRate > 1 ? referral.program.commissionRate / 100 : referral.program.commissionRate)
              : 0
          }
        };
      }),
      ...currencySettings,
    });

  } catch (error) {
    console.error('Admin referrals API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referrals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { referralIds, action } = body; // action: 'pending' | 'sell' | 'complete' | 'reject'

    if (!referralIds || !Array.isArray(referralIds) || referralIds.length === 0) {
      return NextResponse.json(
        { error: 'Referral IDs array is required' },
        { status: 400 }
      );
    }

    const targetStatus = action ? referralStatusFromAction(action) : null;

    if (!targetStatus || targetStatus === 'NEW') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "pending", "sell", "complete", or "reject"' },
        { status: 400 }
      );
    }

    let updatedCount = 0;
    let payoutEligibleCount = 0;

    for (const referralId of referralIds) {
      const referral = await prisma.referral.findUnique({
        where: { id: referralId },
        select: { status: true }
      });

      if (!referral) {
        return NextResponse.json(
          { error: `Referral ${referralId} was not found` },
          { status: 404 }
        );
      }

      if (!canTransitionReferralStatus(referral.status, targetStatus)) {
        return NextResponse.json(
          { error: `Cannot move referral from ${referral.status.toLowerCase()} to ${targetStatus.toLowerCase()}` },
          { status: 400 }
        );
      }

      const updatedReferral = await prisma.referral.update({
        where: { id: referralId },
        data: {
          status: targetStatus,
          reviewedBy: user.id,
          reviewedAt: new Date()
        }
      });

      updatedCount += 1;

      if (updatedReferral.status === 'COMPLETED') {
        const result = await createCompletedReferralCommission(updatedReferral.id, user.id);
        if (result.created) payoutEligibleCount += 1;
      }
    }

    return NextResponse.json({
      success: true,
      message: `${updatedCount} referral${updatedCount === 1 ? '' : 's'} updated to ${targetStatus.toLowerCase()}${payoutEligibleCount ? `; ${payoutEligibleCount} payout-eligible commission${payoutEligibleCount === 1 ? '' : 's'} created` : ''}`,
      updatedCount,
      payoutEligibleCount
    });

  } catch (error) {
    console.error('Batch referral API error:', error);
    return NextResponse.json(
      { error: 'Failed to process referrals' },
      { status: 500 }
    );
  }
}
