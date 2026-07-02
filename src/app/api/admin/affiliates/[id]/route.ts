import { NextRequest, NextResponse } from 'next/server';
import { UserStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';


// Update referral partner details
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { success, data, error: validationError } = await import('@/lib/validations')
      .then(m => m.affiliateUpdateSchema.safeParse(body));

    if (!success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.issues },
        { status: 400 }
      );
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'At least one editable field is required' },
        { status: 400 }
      );
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        programAssignments: {
          include: { program: true }
        }
      }
    });

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Referral partner not found' },
        { status: 404 }
      );
    }

    const normalizedEmail = data.email?.toLowerCase().trim();
    if (normalizedEmail && normalizedEmail !== affiliate.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail }
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 400 }
        );
      }
    }

    const assignedProgramIds = Array.isArray(data.assignedProgramIds)
      ? Array.from(new Set(data.assignedProgramIds.filter(Boolean)))
      : null;

    if (assignedProgramIds) {
      const programs = await prisma.program.findMany({
        where: { id: { in: assignedProgramIds } },
        select: { id: true }
      });

      if (programs.length !== assignedProgramIds.length) {
        return NextResponse.json(
          { error: 'One or more selected programs do not exist' },
          { status: 400 }
        );
      }
    }

    const currentPayoutDetails =
      affiliate.payoutDetails &&
      typeof affiliate.payoutDetails === 'object' &&
      !Array.isArray(affiliate.payoutDetails)
        ? affiliate.payoutDetails as Record<string, unknown>
        : {};

    const updatedAffiliate = await prisma.$transaction(async (tx) => {
      const userUpdates: Record<string, unknown> = {};
      if (data.name !== undefined) userUpdates.name = data.name.trim();
      if (normalizedEmail) userUpdates.email = normalizedEmail;
      if (data.status !== undefined) userUpdates.status = data.status as UserStatus;

      if (Object.keys(userUpdates).length > 0) {
        await tx.user.update({
          where: { id: affiliate.userId },
          data: userUpdates
        });
      }

      const affiliateUpdates: Record<string, unknown> = {};
      if (
        data.company !== undefined ||
        data.payoutMethod !== undefined ||
        data.paypalEmail !== undefined
      ) {
        affiliateUpdates.payoutDetails = {
          ...currentPayoutDetails,
          ...(data.company !== undefined && { company: data.company.trim() }),
          ...(data.payoutMethod !== undefined && { paymentMethod: data.payoutMethod }),
          ...(data.paypalEmail !== undefined && {
            paymentEmail: data.paypalEmail.trim() || normalizedEmail || affiliate.user.email
          })
        };
      }

      if (Object.keys(affiliateUpdates).length > 0) {
        await tx.affiliate.update({
          where: { id: params.id },
          data: affiliateUpdates
        });
      }

      if (assignedProgramIds) {
        await tx.affiliateProgram.deleteMany({
          where: { affiliateId: params.id }
        });

        if (assignedProgramIds.length > 0) {
          await tx.affiliateProgram.createMany({
            data: assignedProgramIds.map((programId) => ({
              affiliateId: params.id,
              programId
            })),
            skipDuplicates: true
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'UPDATE_AFFILIATE',
          objectType: 'AFFILIATE',
          objectId: params.id,
          payload: {
            previous: {
              name: affiliate.user.name,
              email: affiliate.user.email,
              status: affiliate.user.status,
              assignedProgramIds: affiliate.programAssignments.map((assignment) => assignment.programId)
            },
            updated: {
              name: data.name,
              email: normalizedEmail,
              status: data.status,
              company: data.company,
              payoutMethod: data.payoutMethod,
              assignedProgramIds
            }
          }
        }
      });

      return tx.affiliate.findUnique({
        where: { id: params.id },
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
                  currency: true
                }
              }
            },
            orderBy: { createdAt: 'asc' }
          },
          _count: {
            select: {
              referrals: true
            }
          }
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Referral partner updated successfully',
      affiliate: updatedAffiliate
    });

  } catch (error) {
    console.error('Update referral partner error:', error);
    return NextResponse.json(
      { error: 'Failed to update referral partner' },
      { status: 500 }
    );
  }
}

// Delete referral partner
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const userId = request.headers.get('x-user-id')!;
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get referral partner to find userId
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: params.id },
      include: { user: true }
    });

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Referral partner not found' },
        { status: 404 }
      );
    }

    // Delete user (will cascade delete referral partner profile due to Prisma schema)
    await prisma.user.delete({
      where: { id: affiliate.userId }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'DELETE_AFFILIATE',
        objectType: 'AFFILIATE',
        objectId: params.id,
        payload: {
          affiliateName: affiliate.user.name,
          affiliateEmail: affiliate.user.email,
          referralCode: affiliate.referralCode
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Referral partner deleted successfully'
    });

  } catch (error) {
    console.error('Delete referral partner error:', error);
    return NextResponse.json(
      { error: 'Failed to delete referral partner' },
      { status: 500 }
    );
  }
}
