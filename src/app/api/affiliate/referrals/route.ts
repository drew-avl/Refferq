import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrencySettings } from '@/lib/currency';
import { getReferralMetadataDetails } from '@/lib/referrals';

function normalizeReferralBody(body: any) {
  return {
    leadName: body.leadName ?? body.lead_name,
    leadEmail: body.leadEmail ?? body.lead_email,
    leadPhone: body.leadPhone ?? body.lead_phone,
    address: body.address,
    address2: body.address2 ?? body.address_2 ?? '',
    moveInDate: body.moveInDate ?? body.move_in_date,
    company: body.company,
    notes: body.notes,
    estimatedValue: body.estimatedValue ?? body.estimated_value ?? 0,
  };
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database

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
        { error: 'Access denied. Affiliate role required.' },
        { status: 403 }
      );
    }

    if (!user.affiliate) {
      return NextResponse.json(
        { error: 'Affiliate profile not found' },
        { status: 404 }
      );
    }

    const body = normalizeReferralBody(await request.json());

    // Validate with Zod
    const { success, data, error: validationError } = await import('@/lib/validations').then(m => m.referralSchema.safeParse(body));

    if (!success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.issues },
        { status: 400 }
      );
    }

    const { leadName, leadEmail, leadPhone, address, address2, moveInDate, company, notes, estimatedValue } = data;

    // Create the referral
    const referral = await prisma.referral.create({
      data: {
        affiliateId: user.affiliate.id,
        leadName: leadName.trim(),
        leadEmail: leadEmail.toLowerCase().trim(),
        leadPhone: leadPhone.trim(),
        status: 'PENDING',
        metadata: {
          company: company || '',
          notes: notes || '',
          source: 'manual',
          estimated_value: estimatedValue || 0,
          address: address.trim(),
          address2: address2?.trim() || '',
          move_in_date: moveInDate,
        },
      }
    });

    try {
      const { emailService } = await import('@/lib/email');
      await emailService.sendReferralNotification({
        affiliateName: user.name,
        leadName: referral.leadName,
        leadEmail: referral.leadEmail,
        company: company || '',
        estimatedValue: Math.round((estimatedValue || 0) * 100),
      });
    } catch (emailError) {
      console.error('Failed to send referral notification:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'Referral submitted successfully',
      referral,
    });
  } catch (error) {
    console.error('Submit referral API error:', error);
    return NextResponse.json(
      { error: 'Failed to submit referral' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database

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
        { error: 'Access denied. Affiliate role required.' },
        { status: 403 }
      );
    }

    if (!user.affiliate) {
      return NextResponse.json(
        { error: 'Affiliate profile not found' },
        { status: 404 }
      );
    }

    const referrals = await prisma.referral.findMany({
      where: { affiliateId: user.affiliate.id },
      orderBy: { createdAt: 'desc' }
    });

    // Map referrals to include metadata details
    const mappedReferrals = referrals.map((ref) => {
      const metadata = getReferralMetadataDetails(ref.metadata);
      return {
        ...ref,
        estimatedValue: metadata.estimatedValue,
        company: metadata.company,
        address: metadata.address,
        address2: metadata.address2,
        moveInDate: metadata.moveInDate,
      };
    });

    const currencySettings = await getCurrencySettings();

    return NextResponse.json({
      success: true,
      referrals: mappedReferrals,
      ...currencySettings,
    });
  } catch (error) {
    console.error('Get referrals API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referrals' },
      { status: 500 }
    );
  }
}
