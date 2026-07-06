import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCompletedReferralCommission } from '@/lib/referral-payouts';
import { canTransitionReferralStatus, isReferralStatus, referralStatusFromAction } from '@/lib/referral-status';
import { recordReferralStatusChange } from '@/lib/referral-audit';
import { canAccessReferral, getAdminActor } from '@/lib/admin-access';


export async function PUT(
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

    const body = await request.json();
    const { action, reviewNotes } = body;
    const targetStatus = action ? referralStatusFromAction(action) : null;

    if (!targetStatus || targetStatus === 'NEW') {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const referral = await prisma.referral.findUnique({
      where: { id: params.id },
      include: {
        program: true,
        affiliate: {
          include: { partnerGroup: true }
        }
      }
    });

    if (!referral) {
      return NextResponse.json(
        { error: 'Referral not found' },
        { status: 404 }
      );
    }

    const allowed = await canAccessReferral(user, params.id);
    if (!allowed) {
      return NextResponse.json(
        { error: 'You can only update leads for partners assigned to you' },
        { status: 403 }
      );
    }

    if (!canTransitionReferralStatus(referral.status, targetStatus)) {
      return NextResponse.json(
        { error: `Cannot move referral from ${referral.status.toLowerCase()} to ${targetStatus.toLowerCase()}` },
        { status: 400 }
      );
    }

    const updatedReferral = await prisma.$transaction(async (tx) => {
      const changedReferral = await tx.referral.update({
        where: { id: params.id },
        data: {
          status: targetStatus,
          reviewNotes: reviewNotes || null,
          reviewedBy: user.id,
          reviewedAt: new Date()
        }
      });

      await recordReferralStatusChange({
        tx,
        actorId: user.id,
        referralId: params.id,
        fromStatus: referral.status,
        toStatus: targetStatus,
        reviewNotes,
        source: 'single',
      });

      return changedReferral;
    });

    const payoutResult = updatedReferral.status === 'COMPLETED'
      ? await createCompletedReferralCommission(updatedReferral.id, user.id)
      : null;

    return NextResponse.json({
      success: true,
      message: payoutResult?.created
        ? 'Referral completed and payout-eligible commission created'
        : `Referral updated to ${targetStatus.toLowerCase()} successfully`,
      referral: updatedReferral
    });

  } catch (error) {
    console.error('Referral approval error:', error);
    return NextResponse.json(
      { error: 'Failed to process referral' },
      { status: 500 }
    );
  }
}

// Add PATCH method for updating referral/lead details
export async function PATCH(
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

    const body = await request.json();
    const {
      action,
      leadName,
      leadEmail,
      leadPhone,
      address,
      address2,
      moveInDate,
      estimatedValue,
      company,
      notes,
      status,
      reviewNotes
    } = body;

    // Check if referral exists
    const referral = await prisma.referral.findUnique({
      where: { id: params.id },
      include: { affiliate: { include: { partnerGroup: true } }, program: true }
    });

    if (!referral) {
      return NextResponse.json(
        { error: 'Referral not found' },
        { status: 404 }
      );
    }

    const allowed = await canAccessReferral(user, params.id);
    if (!allowed) {
      return NextResponse.json(
        { error: 'You can only update leads for partners assigned to you' },
        { status: 403 }
      );
    }

    const targetStatus = action ? referralStatusFromAction(action) : null;

    // If action is provided, handle status transitions.
    if (targetStatus && targetStatus !== 'NEW') {
      if (!canTransitionReferralStatus(referral.status, targetStatus)) {
        return NextResponse.json(
          { error: `Cannot move referral from ${referral.status.toLowerCase()} to ${targetStatus.toLowerCase()}` },
          { status: 400 }
        );
      }

      const updatedReferral = await prisma.$transaction(async (tx) => {
        const changedReferral = await tx.referral.update({
          where: { id: params.id },
          data: {
            status: targetStatus,
            reviewNotes: reviewNotes || null,
            reviewedBy: user.id,
            reviewedAt: new Date()
          }
        });

        await recordReferralStatusChange({
          tx,
          actorId: user.id,
          referralId: params.id,
          fromStatus: referral.status,
          toStatus: targetStatus,
          reviewNotes,
          source: 'single',
        });

        return changedReferral;
      });

      const payoutResult = updatedReferral.status === 'COMPLETED'
        ? await createCompletedReferralCommission(updatedReferral.id, user.id)
        : null;

      return NextResponse.json({
        success: true,
        message: payoutResult?.created
          ? 'Referral completed and payout-eligible commission created'
          : `Referral updated to ${targetStatus.toLowerCase()} successfully`,
        referral: updatedReferral
      });
    }

    // Otherwise, handle lead detail updates
    const updateData: any = {};
    
    if (leadName !== undefined) updateData.leadName = leadName;
    if (leadEmail !== undefined) updateData.leadEmail = leadEmail;
    if (leadPhone !== undefined) updateData.leadPhone = leadPhone;
    if (notes !== undefined) updateData.notes = notes || null;
    if (status !== undefined) {
      if (!isReferralStatus(status)) {
        return NextResponse.json(
          { error: 'Invalid referral status' },
          { status: 400 }
        );
      }
      updateData.status = status;
      updateData.reviewedBy = user.id;
      updateData.reviewedAt = new Date();
    }

    const metadataUpdates: Record<string, unknown> = {};
    if (address !== undefined) metadataUpdates.address = address;
    if (address2 !== undefined) metadataUpdates.address2 = address2;
    if (moveInDate !== undefined) metadataUpdates.move_in_date = moveInDate;
    if (estimatedValue !== undefined) metadataUpdates.estimated_value = Number(estimatedValue) || 0;
    if (company !== undefined) metadataUpdates.company = company;
    if (notes !== undefined) metadataUpdates.notes = notes;

    if (Object.keys(metadataUpdates).length > 0) {
      updateData.metadata = {
        ...((referral.metadata as Record<string, unknown>) || {}),
        ...metadataUpdates,
      };
    }

    const updatedReferral = await prisma.$transaction(async (tx) => {
      const changedReferral = await tx.referral.update({
        where: { id: params.id },
        data: updateData
      });

      if (status !== undefined && status !== referral.status) {
        await recordReferralStatusChange({
          tx,
          actorId: user.id,
          referralId: params.id,
          fromStatus: referral.status,
          toStatus: status,
          reviewNotes,
          source: 'direct',
        });
      }

      return changedReferral;
    });

    if (updatedReferral.status === 'COMPLETED') {
      await createCompletedReferralCommission(updatedReferral.id, user.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Lead updated successfully',
      referral: updatedReferral
    });

  } catch (error) {
    console.error('Update referral error:', error);
    return NextResponse.json(
      { error: 'Failed to update referral' },
      { status: 500 }
    );
  }
}

// Add DELETE method to allow admins to delete referrals
export async function DELETE(
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

    // Check if referral exists
    const referral = await prisma.referral.findUnique({
      where: { id: params.id }
    });

    if (!referral) {
      return NextResponse.json(
        { error: 'Referral not found' },
        { status: 404 }
      );
    }

    const allowed = await canAccessReferral(user, params.id);
    if (!allowed) {
      return NextResponse.json(
        { error: 'You can only delete leads for partners assigned to you' },
        { status: 403 }
      );
    }

    // Delete the referral (will cascade delete related commissions due to Prisma schema)
    await prisma.referral.delete({
      where: { id: params.id }
    });

    return NextResponse.json({
      success: true,
      message: 'Referral deleted successfully'
    });

  } catch (error) {
    console.error('Delete referral error:', error);
    return NextResponse.json(
      { error: 'Failed to delete referral' },
      { status: 500 }
    );
  }
}
