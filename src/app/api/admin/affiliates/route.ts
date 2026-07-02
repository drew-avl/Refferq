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

    return NextResponse.json({
      success: true,
      affiliates,
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

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        role: 'AFFILIATE',
        status: 'ACTIVE',
        password: hashedPassword
      }
    });

    // Create affiliate profile
    const affiliate = await prisma.affiliate.create({
      data: {
        userId: newUser.id,
        referralCode: `AF${Date.now()}${(await import('crypto')).randomBytes(3).toString('hex').toUpperCase().slice(0, 4)}`,
        balanceCents: 0,
        payoutDetails: {
          company: company?.trim() || '',
          paymentMethod: payoutMethod || '',
          paymentEmail: paypalEmail?.trim() || normalizedEmail,
        }
      }
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
          password: userPassword,
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
        referralCode: affiliate.referralCode,
        balanceCents: affiliate.balanceCents,
        createdAt: affiliate.createdAt
      },
      // Note: Password is sent to admin once and should be communicated
      // securely to the referral partner. It is not stored in logs.
      temporaryPassword: userPassword,
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
