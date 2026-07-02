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
    programId: body.programId ?? body.program_id,
    company: body.company,
    notes: body.notes,
    estimatedValue: body.estimatedValue ?? body.estimated_value ?? 0,
  };
}

async function getAssignedPrograms(affiliateId: string) {
  return prisma.program.findMany({
    where: {
      isActive: true,
      affiliateAssignments: {
        some: { affiliateId },
      },
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      referralPayoutCents: true,
      currency: true,
      isDefault: true,
    },
  });
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

    const { leadName, leadEmail, leadPhone, address, address2, moveInDate, programId, company, notes, estimatedValue } = data;

    const [activeProgramCount, assignedPrograms] = await Promise.all([
      prisma.program.count({ where: { isActive: true } }),
      getAssignedPrograms(user.affiliate.id),
    ]);

    const selectedProgramId = programId || null;
    if (activeProgramCount > 0 && assignedPrograms.length === 0) {
      return NextResponse.json(
        { error: 'No property programs are assigned to your account yet. Please contact an admin.' },
        { status: 400 }
      );
    }

    if (assignedPrograms.length > 0 && !selectedProgramId) {
      return NextResponse.json(
        { error: 'Please select a property program for this lead' },
        { status: 400 }
      );
    }

    if (selectedProgramId && !assignedPrograms.some((program) => program.id === selectedProgramId)) {
      return NextResponse.json(
        { error: 'Selected property program is not assigned to your account' },
        { status: 400 }
      );
    }

    // Create the referral
    const referral = await prisma.referral.create({
      data: {
        affiliateId: user.affiliate.id,
        programId: selectedProgramId,
        leadName: leadName.trim(),
        leadEmail: leadEmail.toLowerCase().trim(),
        leadPhone: leadPhone.trim(),
        status: 'PENDING',
        notes: notes?.trim() || null,
        metadata: {
          company: company || '',
          notes: notes?.trim() || '',
          source: 'manual',
          program_id: selectedProgramId,
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
      include: {
        program: {
          select: {
            id: true,
            name: true,
            referralPayoutCents: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    const programs = await getAssignedPrograms(user.affiliate.id);

    // Map referrals to include metadata details
    const mappedReferrals = referrals.map((ref) => {
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

    const currencySettings = await getCurrencySettings();

    return NextResponse.json({
      success: true,
      referrals: mappedReferrals,
      programs,
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

export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { affiliate: true }
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

    const rawBody = await request.json();
    const referralId = rawBody.id ?? rawBody.referralId;
    if (!referralId) {
      return NextResponse.json(
        { error: 'Referral ID is required' },
        { status: 400 }
      );
    }

    const referral = await prisma.referral.findFirst({
      where: {
        id: referralId,
        affiliateId: user.affiliate.id,
      },
    });

    if (!referral) {
      return NextResponse.json(
        { error: 'Referral not found' },
        { status: 404 }
      );
    }

    if (referral.status === 'COMPLETED' || referral.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Completed or rejected leads can no longer be edited' },
        { status: 400 }
      );
    }

    const body = normalizeReferralBody(rawBody);
    const { success, data, error: validationError } = await import('@/lib/validations').then(m => m.referralSchema.safeParse(body));

    if (!success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.issues },
        { status: 400 }
      );
    }

    const { leadName, leadEmail, leadPhone, address, address2, moveInDate, programId, company, notes, estimatedValue } = data;

    const [activeProgramCount, assignedPrograms] = await Promise.all([
      prisma.program.count({ where: { isActive: true } }),
      getAssignedPrograms(user.affiliate.id),
    ]);

    const selectedProgramId = programId || null;
    if (activeProgramCount > 0 && assignedPrograms.length === 0) {
      return NextResponse.json(
        { error: 'No property programs are assigned to your account yet. Please contact an admin.' },
        { status: 400 }
      );
    }

    if (assignedPrograms.length > 0 && !selectedProgramId) {
      return NextResponse.json(
        { error: 'Please select a property program for this lead' },
        { status: 400 }
      );
    }

    if (selectedProgramId && !assignedPrograms.some((program) => program.id === selectedProgramId)) {
      return NextResponse.json(
        { error: 'Selected property program is not assigned to your account' },
        { status: 400 }
      );
    }

    const updatedReferral = await prisma.referral.update({
      where: { id: referral.id },
      data: {
        programId: selectedProgramId,
        leadName: leadName.trim(),
        leadEmail: leadEmail.toLowerCase().trim(),
        leadPhone: leadPhone.trim(),
        notes: notes?.trim() || null,
        metadata: {
          ...((referral.metadata as Record<string, unknown>) || {}),
          company: company || '',
          notes: notes?.trim() || '',
          program_id: selectedProgramId,
          estimated_value: estimatedValue || 0,
          address: address.trim(),
          address2: address2?.trim() || '',
          move_in_date: moveInDate,
        },
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Lead updated successfully',
      referral: updatedReferral,
    });
  } catch (error) {
    console.error('Update affiliate referral API error:', error);
    return NextResponse.json(
      { error: 'Failed to update referral' },
      { status: 500 }
    );
  }
}
