import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPublicAppUrl } from '@/lib/platform-defaults';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }

    // Fetch all affiliates with their user info and counts
    const affiliates = await prisma.affiliate.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            referrals: true
          }
        },
        partnerGroup: {
          select: {
            id: true,
            name: true
          }
        },
        programAssignments: {
          include: {
            program: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                isDefault: true,
                referralPayoutCents: true,
                commissionRate: true,
                commissionType: true,
                currency: true,
                minPayoutCents: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get currency symbol
    const { getCurrencySymbol } = await import('@/lib/currency');
    const currencySymbol = await getCurrencySymbol();
    const affiliatesForResponse = affiliates.map((affiliate) => ({
      id: affiliate.id,
      userId: affiliate.userId,
      payoutDetails: affiliate.payoutDetails,
      balanceCents: affiliate.balanceCents,
      createdAt: affiliate.createdAt,
      updatedAt: affiliate.updatedAt,
      partnerGroupId: affiliate.partnerGroupId,
      user: affiliate.user,
      _count: affiliate._count,
      partnerGroup: affiliate.partnerGroup,
      programAssignments: affiliate.programAssignments,
    }));

    return NextResponse.json({
      success: true,
      affiliates: affiliatesForResponse,
      currencySymbol, // Add currency symbol to response
    });
  } catch (error) {
    console.error('Get referral partners API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referral partners' },
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

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate with Zod
    const { success, data, error: validationError } = await import('@/lib/validations').then(m => m.affiliateCreateSchema.safeParse(body));

    if (!success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.issues },
        { status: 400 }
      );
    }

    const {
      name,
      email,
      password,
      company,
      payoutMethod,
      paypalEmail,
      sendWelcomeEmail = true,
      assignedProgramIds,
    } = data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Generate password if not provided
    const crypto = await import('crypto');
    const userPassword = password || `AF${crypto.randomBytes(12).toString('base64url')}`;

    // Hash password with bcrypt
    const hashedPassword = await (await import('bcryptjs')).hash(userPassword, 12);

    const uniqueProgramIds = Array.from(new Set((assignedProgramIds || []).filter(Boolean)));

    if (uniqueProgramIds.length > 0) {
      const programs = await prisma.program.findMany({
        where: { id: { in: uniqueProgramIds } },
        select: { id: true }
      });

      if (programs.length !== uniqueProgramIds.length) {
        return NextResponse.json(
          { error: 'One or more selected property programs do not exist' },
          { status: 400 }
        );
      }
    }

    const defaultProgram = uniqueProgramIds.length === 0
      ? await prisma.program.findFirst({
          where: { isActive: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
        })
      : null;
    const programIdsToAssign = uniqueProgramIds.length > 0
      ? uniqueProgramIds
      : defaultProgram
        ? [defaultProgram.id]
        : [];

    const { newUser, affiliate } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          role: 'AFFILIATE',
          status: 'ACTIVE',
          password: hashedPassword
        }
      });

      const createdAffiliate = await tx.affiliate.create({
        data: {
          userId: createdUser.id,
          referralCode: `AF${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4)}`,
          balanceCents: 0,
          payoutDetails: {
            company: company?.trim() || '',
            paymentMethod: payoutMethod || '',
            paymentEmail: paypalEmail?.trim() || normalizedEmail,
          }
        }
      });

      if (programIdsToAssign.length > 0) {
        await tx.affiliateProgram.createMany({
          data: programIdsToAssign.map((programId) => ({
            affiliateId: createdAffiliate.id,
            programId
          })),
          skipDuplicates: true
        });
      }

      return { newUser: createdUser, affiliate: createdAffiliate };
    });

    let welcomeEmailSent = false;
    if (sendWelcomeEmail) {
      try {
        const { emailService } = await import('@/lib/email');
        const loginUrl = `${getPublicAppUrl()}/login`;
        const emailResult = await emailService.sendWelcomeEmail({
          name: newUser.name,
          email: newUser.email,
          role: 'affiliate',
          loginUrl,
          accountStatus: 'active',
        });
        welcomeEmailSent = emailResult.success;
      } catch (emailError) {
        console.error('Failed to send referral partner welcome email:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: welcomeEmailSent
        ? 'Referral partner created and welcome email sent successfully'
        : 'Referral partner created successfully',
      affiliate: {
        id: affiliate.id,
        userId: newUser.id,
        name: newUser.name,
        email: newUser.email,
        balanceCents: affiliate.balanceCents,
        createdAt: affiliate.createdAt,
        assignedProgramIds: programIdsToAssign
      },
      welcomeEmailSent
    });
  } catch (error) {
    console.error('Create referral partner API error:', error);
    return NextResponse.json(
      { error: 'Failed to create referral partner' },
      { status: 500 }
    );
  }
}
