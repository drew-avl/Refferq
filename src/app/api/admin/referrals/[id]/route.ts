import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrencySettings } from '@/lib/currency';
import { getReferralMetadataDetails } from '@/lib/referrals';

function estimatedValueToCents(metadata: unknown): number {
  const details = getReferralMetadataDetails(metadata);
  return Math.max(0, Math.round(details.estimatedValue * 100));
}


export async function PUT(
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
    const { action, reviewNotes } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const referral = await prisma.referral.findUnique({
      where: { id: params.id },
      include: {
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

    // Get estimated value from referral metadata
    const estimatedValueCents = estimatedValueToCents(referral.metadata);
    const { currency } = await getCurrencySettings();

    const updatedReferral = await prisma.referral.update({
      where: { id: params.id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        reviewNotes: reviewNotes || null,
        reviewedBy: user.id,
        reviewedAt: new Date()
      }
    });

    // If approved, create conversion and commission
    if (action === 'approve') {
      // Get commission rate from partner group or use default 10%
      const commissionRate = referral.affiliate.partnerGroup?.commissionRate
        ? referral.affiliate.partnerGroup.commissionRate / 100
        : 0.1;

      const conversion = await prisma.conversion.create({
        data: {
          affiliateId: referral.affiliateId,
          referralId: referral.id,
          eventType: 'PURCHASE',
          amountCents: estimatedValueCents,
          currency,
          status: 'PENDING'
        }
      });

      const commissionAmount = Math.round(estimatedValueCents * commissionRate);

      await prisma.commission.create({
        data: {
          affiliateId: referral.affiliateId,
          conversionId: conversion.id,
          userId: referral.affiliate.userId,
          rate: commissionRate,
          amountCents: commissionAmount,
          status: 'PENDING'
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Referral ${action}d successfully`,
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

// Add PATCH method for updating referral/customer details
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
      include: { affiliate: { include: { partnerGroup: true } } }
    });

    if (!referral) {
      return NextResponse.json(
        { error: 'Referral not found' },
        { status: 404 }
      );
    }

    // If action is provided, handle approve/reject (legacy behavior)
    if (action && ['approve', 'reject'].includes(action)) {
      const updatedReferral = await prisma.referral.update({
        where: { id: params.id },
        data: {
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          reviewNotes: reviewNotes || null,
          reviewedBy: user.id,
          reviewedAt: new Date()
        }
      });

      // If approved, create conversion and commission
      if (action === 'approve') {
        const estValueCents = estimatedValueToCents(referral.metadata);
        const { currency } = await getCurrencySettings();
        const commissionRate = referral.affiliate.partnerGroup?.commissionRate
          ? referral.affiliate.partnerGroup.commissionRate / 100
          : 0.1;

        const conversion = await prisma.conversion.create({
          data: {
            affiliateId: referral.affiliateId,
            referralId: referral.id,
            eventType: 'PURCHASE',
            amountCents: estValueCents,
            currency,
            status: 'PENDING'
          }
        });

        const commissionAmount = Math.round(estValueCents * commissionRate);
        
        await prisma.commission.create({
          data: {
            affiliateId: referral.affiliateId,
            conversionId: conversion.id,
            userId: referral.affiliate.userId,
            rate: commissionRate,
            amountCents: commissionAmount,
            status: 'PENDING'
          }
        });
      }

      return NextResponse.json({
        success: true,
        message: `Referral ${action}d successfully`,
        referral: updatedReferral
      });
    }

    // Otherwise, handle customer detail updates
    const updateData: any = {};
    
    if (leadName !== undefined) updateData.leadName = leadName;
    if (leadEmail !== undefined) updateData.leadEmail = leadEmail;
    if (leadPhone !== undefined) updateData.leadPhone = leadPhone;
    if (notes !== undefined) updateData.notes = notes || null;
    if (status !== undefined) {
      // Map status values
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

    const updatedReferral = await prisma.referral.update({
      where: { id: params.id },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: 'Customer updated successfully',
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
