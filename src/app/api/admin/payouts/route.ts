import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditAction } from '@/lib/audit';
import { getAllowedPayoutMethod } from '@/lib/payout-methods';


// Helper: Verify admin auth from DB (not just JWT payload)
// Helper: Verify admin auth from DB (middleware already checked role, but we double check status)
async function verifyAdmin(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return { error: 'Unauthorized', status: 401 };

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE') {
      return { error: 'Forbidden', status: 403 };
    }
    return { user };
  } catch {
    return { error: 'Authentication internal error', status: 500 };
  }
}

function sanitizeCSVValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // Prevent CSV formula injection by prefixing dangerous characters with a single quote
  const needsEscape = /^[=+\-@\t\r]/.test(str);
  const escaped = str.replace(/"/g, '""');
  if (needsEscape || str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${needsEscape ? "'" : ''}${escaped}"`;
  }
  return escaped;
}

function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]).map(h => sanitizeCSVValue(h)).join(',');
  const rows = data.map(row =>
    Object.values(row).map(val => sanitizeCSVValue(val)).join(',')
  );
  return [headers, ...rows].join('\n');
}

function getPayoutDetailsMethod(payoutDetails: unknown) {
  if (payoutDetails && typeof payoutDetails === 'object' && !Array.isArray(payoutDetails)) {
    return getAllowedPayoutMethod((payoutDetails as Record<string, unknown>).paymentMethod as string | undefined);
  }

  return getAllowedPayoutMethod(undefined);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const affiliateId = searchParams.get('affiliateId');

    // Build where clause
    const where: any = {};
    if (affiliateId) {
      where.affiliateId = affiliateId;
    }

    // Fetch payouts from database
    const payouts = await (prisma as any).payout.findMany({
      where,
      include: {
        affiliate: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        commissions: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format response
    const formattedPayouts = payouts.map((payout: any) => ({
      id: payout.id,
      affiliateId: payout.affiliateId,
      affiliateName: payout.affiliate.user.name,
      affiliateEmail: payout.affiliate.user.email,
      amountCents: payout.amountCents,
      commissionCount: payout.commissionCount || payout.commissions?.length || 0,
      status: payout.status,
      method: payout.method,
      notes: payout.notes,
      createdAt: payout.createdAt,
      processedAt: payout.processedAt,
    }));

    const eligibleCommissions = await prisma.commission.findMany({
      where: {
        status: 'APPROVED',
        ...(affiliateId && { affiliateId }),
      },
      include: {
        affiliate: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        conversion: {
          include: {
            referral: {
              select: {
                leadName: true,
                leadEmail: true,
              },
            },
          },
        },
      },
      orderBy: [
        { approvedAt: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const formattedEligibleCommissions = eligibleCommissions.map((commission) => ({
      id: commission.id,
      affiliateId: commission.affiliateId,
      affiliateName: commission.affiliate.user.name,
      affiliateEmail: commission.affiliate.user.email,
      customerName: commission.conversion.referral?.leadName || 'Commission',
      customerEmail: commission.conversion.referral?.leadEmail || '',
      amountCents: commission.amountCents,
      rate: commission.rate,
      status: commission.status,
      approvedAt: commission.approvedAt,
      createdAt: commission.createdAt,
    }));

    const eligiblePartnerMap = new Map<string, {
      affiliateId: string;
      affiliateName: string;
      affiliateEmail: string;
      amountCents: number;
      commissionCount: number;
      commissionIds: string[];
      method: string;
    }>();

    for (const commission of eligibleCommissions) {
      const existing = eligiblePartnerMap.get(commission.affiliateId);
      if (existing) {
        existing.amountCents += commission.amountCents;
        existing.commissionCount += 1;
        existing.commissionIds.push(commission.id);
      } else {
        eligiblePartnerMap.set(commission.affiliateId, {
          affiliateId: commission.affiliateId,
          affiliateName: commission.affiliate.user.name,
          affiliateEmail: commission.affiliate.user.email,
          amountCents: commission.amountCents,
          commissionCount: 1,
          commissionIds: [commission.id],
          method: getPayoutDetailsMethod(commission.affiliate.payoutDetails),
        });
      }
    }

    const eligiblePartners = Array.from(eligiblePartnerMap.values())
      .sort((a, b) => b.amountCents - a.amountCents);

    if (searchParams.get('format') === 'csv') {
      const csv = convertToCSV(formattedPayouts);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="payouts-${Date.now()}.csv"`
        }
      });
    }

    // Get currency symbol
    const { getCurrencySymbol } = await import('@/lib/currency');
    const currencySymbol = await getCurrencySymbol();

    return NextResponse.json({
      success: true,
      payouts: formattedPayouts,
      eligibleCommissions: formattedEligibleCommissions,
      eligiblePartners,
      currencySymbol, // Add currency symbol to response
    });

  } catch (error: any) {
    console.error('Payouts API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payouts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();

    // Validate with Zod
    const { success, data, error: validationError } = await import('@/lib/validations').then(m => m.payoutSchema.safeParse(body));

    if (!success) {
      return NextResponse.json({ error: 'Validation failed', details: validationError.issues }, { status: 400 });
    }

    const { affiliateId, commissionIds, method, notes } = data;

    // Verify affiliate exists
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!affiliate) {
      return NextResponse.json({ error: 'Referral partner not found' }, { status: 404 });
    }

    // Fetch commissions for these IDs (must be APPROVED)
    const commissions = await prisma.commission.findMany({
      where: {
        id: { in: commissionIds },
        affiliateId: affiliateId,
        status: 'APPROVED',
      },
    });

    if (commissions.length === 0) {
      return NextResponse.json({ error: 'No valid (approved) commissions found' }, { status: 404 });
    }

    if (commissions.length !== commissionIds.length) {
      // Check if some are still PENDING
      const pCount = await prisma.commission.count({
        where: { id: { in: commissionIds }, status: 'PENDING' }
      });

      if (pCount > 0) {
        return NextResponse.json({
          error: `${pCount} commission(s) are still in the hold period and cannot be paid out yet.`
        }, { status: 400 });
      }

      return NextResponse.json(
        { error: 'Some commissions are invalid, cancelled, or already paid.' },
        { status: 400 }
      );
    }

    // Calculate total amount
    const totalAmountCents = commissions.reduce(
      (sum, c) => sum + c.amountCents,
      0
    );
    const payoutMethod = method || getPayoutDetailsMethod(affiliate.payoutDetails);

    // Create payout record
    const payout = await prisma.$transaction(async (tx) => {
      const createdPayout = await (tx as any).payout.create({
        data: {
          userId: affiliate.userId,
          affiliateId,
          amountCents: totalAmountCents,
          commissionCount: commissions.length,
          status: 'PENDING',
          method: payoutMethod,
          notes: notes || null,
          createdBy: auth.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          affiliate: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      await tx.commission.updateMany({
        where: {
          id: { in: commissionIds },
        },
        data: {
          status: 'PAID',
          payoutId: createdPayout.id,
          paidAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const currentAffiliate = await tx.affiliate.findUnique({
        where: { id: affiliateId },
        select: { balanceCents: true },
      });

      await tx.affiliate.update({
        where: { id: affiliateId },
        data: {
          balanceCents: Math.max(0, (currentAffiliate?.balanceCents || 0) - totalAmountCents),
        },
      });

      return createdPayout;
    });

    // Log the action
    await logAuditAction({
      actorId: auth.user.id,
      action: 'CREATE_PAYOUT',
      objectType: 'PAYOUT',
      objectId: payout.id,
      payload: { amountCents: totalAmountCents, affiliateId }
    });

    // Send email notification to affiliate
    try {
      const affiliateUser = payout.affiliate.user;

      if (affiliateUser?.email) {
        const { emailService } = await import('@/lib/email');
        await emailService.sendPayoutCreatedEmail(affiliateUser.email, {
          affiliateName: affiliateUser.name || 'Partner',
          amountCents: totalAmountCents,
          commissionCount: commissions.length,
          payoutId: payout.id,
          method: payoutMethod
        });
      }
    } catch (emailError) {
      console.error('Failed to send payout created email:', emailError);
      // Don't fail the payout if email fails
    }

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        affiliateId: payout.affiliateId,
        affiliateName: payout.affiliate.user.name,
        affiliateEmail: payout.affiliate.user.email,
        amountCents: payout.amountCents,
        commissionCount: payout.commissionCount,
        status: payout.status,
        method: payout.method,
        notes: payout.notes,
        createdAt: payout.createdAt,
      },
    });

  } catch (error: any) {
    console.error('Process payouts API error:', error);
    return NextResponse.json(
      { error: 'Failed to create payout' },
      { status: 500 }
    );
  }
}

// PUT - Update payout status
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();

    // Validate with Zod
    const { success, data, error: validationError } = await import('@/lib/validations').then(m => m.payoutUpdateSchema.safeParse(body));

    if (!success) {
      return NextResponse.json({ error: 'Validation failed', details: validationError.issues }, { status: 400 });
    }

    const { id, status, method, notes } = data;

    // Build update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (status) {
      updateData.status = status;
      if (status === 'COMPLETED') {
        updateData.processedAt = new Date();
      }
    }
    if (method !== undefined) updateData.method = method;
    if (notes !== undefined) updateData.notes = notes;

    // Update payout
    // Update payout
    const payout = await (prisma as any).payout.update({
      where: { id },
      data: updateData,
      include: {
        affiliate: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Log the action
    await logAuditAction({
      actorId: auth.user.id,
      action: 'UPDATE_PAYOUT_STATUS',
      objectType: 'PAYOUT',
      objectId: payout.id,
      payload: { status, method }
    });

    // Send email notification if status changed to COMPLETED
    if (status === 'COMPLETED') {
      try {
        const affiliateUser = payout.affiliate.user;

        if (affiliateUser?.email) {
          const { emailService } = await import('@/lib/email');
          await emailService.sendPayoutCompletedEmail(affiliateUser.email, {
            affiliateName: affiliateUser.name || 'Partner',
            amountCents: payout.amountCents,
            commissionCount: payout.commissionCount,
            payoutId: payout.id,
            method: payout.method || 'PayPal',
            processedAt: payout.processedAt?.toISOString() || new Date().toISOString()
          });
        }
      } catch (emailError) {
        console.error('Failed to send payout completed email:', emailError);
        // Don't fail the update if email fails
      }
    }

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        affiliateId: payout.affiliateId,
        affiliateName: payout.affiliate.user.name,
        affiliateEmail: payout.affiliate.user.email,
        amountCents: payout.amountCents,
        commissionCount: payout.commissionCount,
        status: payout.status,
        method: payout.method,
        notes: payout.notes,
        createdAt: payout.createdAt,
        processedAt: payout.processedAt,
      },
    });
  } catch (error: any) {
    console.error('Error updating payout:', error);
    return NextResponse.json(
      { error: 'Failed to update payout' },
      { status: 500 }
    );
  }
}

// DELETE - Delete payout
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Payout ID is required' }, { status: 400 });
    }

    // Delete payout
    await (prisma as any).payout.delete({
      where: { id },
    });

    // Log the action
    await logAuditAction({
      actorId: auth.user.id,
      action: 'DELETE_PAYOUT',
      objectType: 'PAYOUT',
      objectId: id
    });

    return NextResponse.json({
      success: true,
      message: 'Payout deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting payout:', error);
    return NextResponse.json(
      { error: 'Failed to delete payout' },
      { status: 500 }
    );
  }
}
