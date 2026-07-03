import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrencySettings } from '@/lib/currency';
import { getReferralMetadataDetails } from '@/lib/referrals';


export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;
    
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
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Calculate platform stats
    const totalAffiliates = await prisma.affiliate.count();
    const totalUsers = await prisma.user.count();
    const totalReferrals = await prisma.referral.count();
    const totalConversions = await prisma.conversion.count();
    
    const pendingReferrals = await prisma.referral.count({
      where: { status: { in: ['NEW', 'PENDING'] } }
    });
    
    const soldReferrals = await prisma.referral.count({
      where: { status: { in: ['SOLD', 'COMPLETED'] } }
    });

    const completedReferrals = await prisma.referral.count({
      where: { status: 'COMPLETED' }
    });
    
    // Calculate ACTUAL transaction revenue from conversions
    const totalRevenue = await prisma.conversion.aggregate({
      _sum: { amountCents: true }
    });
    
    // Calculate ESTIMATED revenue from referrals (leads)
    const referrals = await prisma.referral.findMany({
      include: {
        affiliate: true,
        program: true
      }
    });

    const fallbackProgram = await prisma.program.findFirst({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    
    let totalEstimatedRevenue = 0;
    let totalEstimatedCommission = 0;
    
    referrals.forEach((ref) => {
      const metadata = getReferralMetadataDetails(ref.metadata);
      const estimatedValue = metadata.estimatedValue;
      const valueInCents = estimatedValue * 100;
      const payoutInCents = ref.status === 'COMPLETED'
        ? (ref.program?.referralPayoutCents ?? fallbackProgram?.referralPayoutCents ?? 0)
        : 0;
      
      totalEstimatedRevenue += valueInCents;
      totalEstimatedCommission += payoutInCents;
    });

    const stats = {
      totalAffiliates,
      totalUsers,
      totalReferrals,
      totalConversions,
      pendingReferrals,
      soldReferrals,
      completedReferrals,
      totalRevenue: totalRevenue._sum?.amountCents || 0, // Actual transaction revenue
      totalEstimatedRevenue, // Estimated revenue from all leads
      totalEstimatedCommission, // Total commission to be paid
    };

    const currencySettings = await getCurrencySettings();

    return NextResponse.json({ success: true, stats, ...currencySettings });

  } catch (error) {
    console.error('Admin dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin data' },
      { status: 500 }
    );
  }
}
