import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyReferralPartnerChanged } from '@/lib/referral-integrations';
import { getReferralMetadataDetails } from '@/lib/referrals';
import { isSoldReferralStatus } from '@/lib/referral-status';
import { PROGRAM_DEFAULTS } from '@/lib/program-defaults';
import { PAYOUT_METHODS, isPayoutMethod } from '@/lib/payout-methods';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database to ensure they still exist and get latest data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        affiliate: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    if (user.role !== 'AFFILIATE') {
      return NextResponse.json(
        { error: 'Access denied. Referral partner role required.' },
        { status: 403 }
      );
    }

    const affiliate = user.affiliate as any;
    if (!affiliate) {
      return NextResponse.json(
        { error: 'Referral partner profile not found' },
        { status: 404 }
      );
    }

    // Get referral partner statistics
    const [referrals, conversions, commissions, programSettings, programs] = await Promise.all([
      prisma.referral.findMany({
        where: { affiliateId: affiliate.id },
        include: {
          program: {
            select: {
              id: true,
              name: true,
              referralPayoutCents: true,
              minPayoutCents: true,
              currency: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.conversion.findMany({
        where: { affiliateId: affiliate.id },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.commission.findMany({
        where: { affiliateId: affiliate.id },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.programSettings.findFirst(),
      prisma.program.findMany({
        where: {
          isActive: true,
          affiliateAssignments: {
            some: { affiliateId: affiliate.id },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          referralPayoutCents: true,
          minPayoutCents: true,
          currency: true,
          isDefault: true,
        },
      }),
    ]);

    // Calculate stats
    // Available earnings = COMPLETED (PAID) + APPROVED but not yet paid
    const availableEarnings = commissions
      .filter(c => c.status === 'PAID' || c.status === 'APPROVED')
      .reduce((sum, c) => sum + c.amountCents, 0);

    const pendingCommissionsList = commissions.filter(c => c.status === 'PENDING');
    const pendingEarningsCents = pendingCommissionsList.reduce((sum, c) => sum + c.amountCents, 0);

    const totalCommissions = commissions.length;
    const pendingCommissionsCount = pendingCommissionsList.length;
    const totalConversions = conversions.length;
    const totalSold = referrals.filter((referral) => isSoldReferralStatus(referral.status)).length;
    const conversionRate = referrals.length > 0 ? (totalSold / referrals.length) * 100 : 0;

    // Next maturation date for pending commissions
    const nextMaturesAt = pendingCommissionsList
      .filter(c => (c as any).maturesAt)
      .sort((a, b) => ((a as any).maturesAt.getTime() - (b as any).maturesAt.getTime()))[0]?.maturesAt || null;

    const stats = {
      totalEarnings: availableEarnings,
      pendingEarnings: pendingEarningsCents,
      pendingEarningsList: pendingCommissionsList.length,
      nextMaturesAt,
      totalCommissions,
      pendingCommissions: pendingCommissionsCount,
      totalConversions,
      totalSold,
      conversionRate
    };

    // Map referrals to include lead details from metadata
    const mappedReferrals = referrals.map(ref => {
      const metadata = getReferralMetadataDetails(ref.metadata);
      return {
        ...ref,
        estimatedValue: metadata.estimatedValue,
        company: metadata.company,
        notes: ref.notes || metadata.notes,
        address: metadata.address,
        address2: metadata.address2,
        moveInDate: metadata.moveInDate,
        program: ref.program,
      };
    });

    // Get currency symbol
    const { getCurrencySymbol } = await import('@/lib/currency');
    const currencySymbol = await getCurrencySymbol();
    const programMinPayouts = programs
      .map((program) => program.minPayoutCents)
      .filter((value): value is number => typeof value === 'number' && value >= 0);
    const fallbackMinPayoutCents = programSettings?.minPayoutCents ?? PROGRAM_DEFAULTS.minPayoutCents;
    const minPayoutCents = programMinPayouts.length > 0
      ? Math.min(...programMinPayouts)
      : fallbackMinPayoutCents;
    const maxPayoutCents = programMinPayouts.length > 0
      ? Math.max(...programMinPayouts)
      : fallbackMinPayoutCents;

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      affiliate: affiliate,
      stats,
      referrals: mappedReferrals,
      programs,
      conversions,
      commissions,
      currencySymbol,
      payoutSettings: {
        minPayoutCents,
        maxPayoutCents,
        source: programMinPayouts.length > 0 ? 'PROGRAM' : 'GLOBAL',
      },
    });
  } catch (error) {
    console.error('Referral partner profile API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referral partner profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        affiliate: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    if (user.role !== 'AFFILIATE') {
      return NextResponse.json(
        { error: 'Access denied. Referral partner role required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, company, email, country, paymentMethod, paymentEmail, notificationPhone } = body;

    if (paymentMethod && !isPayoutMethod(paymentMethod)) {
      return NextResponse.json(
        { error: `Payment method must be ${PAYOUT_METHODS.join(', ')}` },
        { status: 400 }
      );
    }

    // Update user name and email if provided
    const userUpdateData: any = {};
    if (name && name.trim()) {
      userUpdateData.name = name.trim();
    }
    if (email && email.trim() && email !== user.email) {
      // Check if email is already taken
      const existingUser = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() }
      });
      if (existingUser && existingUser.id !== user.id) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        );
      }
      userUpdateData.email = email.trim().toLowerCase();
    }

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: userUpdateData
      });
    }

    // Update referral partner payout details if provided
    if (user.affiliate) {
      const payoutDetails: any =
        user.affiliate.payoutDetails &&
        typeof user.affiliate.payoutDetails === 'object' &&
        !Array.isArray(user.affiliate.payoutDetails)
          ? { ...(user.affiliate.payoutDetails as Record<string, unknown>) }
          : {};

      if (company !== undefined) payoutDetails.company = company.trim();
      if (country !== undefined) payoutDetails.country = country;
      if (paymentMethod !== undefined) payoutDetails.paymentMethod = paymentMethod;
      if (paymentEmail !== undefined) payoutDetails.paymentEmail = paymentEmail.trim();
      if (notificationPhone !== undefined) payoutDetails.notificationPhone = notificationPhone.trim();

      await prisma.affiliate.update({
        where: { id: user.affiliate.id },
        data: {
          payoutDetails: payoutDetails
        }
      });
      try {
        await notifyReferralPartnerChanged(user.affiliate.id, 'affiliate.updated');
      } catch (integrationError) {
        console.error('Failed to enqueue referral partner profile update:', integrationError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Referral partner profile update API error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
