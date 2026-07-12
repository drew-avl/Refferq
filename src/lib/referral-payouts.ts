import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrencySettings } from '@/lib/currency';
import { getReferralMetadataDetails } from '@/lib/referrals';
import {
  buildReferralPartnerEventData,
  buildReferralSubmittedEventData,
  REFERRAL_EVENT_INCLUDE,
  REFERRAL_PARTNER_EVENT_INCLUDE,
} from '@/lib/referral-event-payload';
import { enqueueIntegrationEvent } from '@/lib/integrations/outbox';

const completionKey = (referralId: string) => `referral-completion:${referralId}`;

export async function createCompletedReferralCommission(referralId: string, approvedBy: string) {
  const referral = await prisma.referral.findUnique({
    where: { id: referralId },
    include: { affiliate: true, program: true },
  });

  if (!referral || referral.status !== 'COMPLETED') {
    return { created: false, reason: 'not-completed' as const };
  }

  const existingCommission = await prisma.commission.findFirst({
    where: {
      OR: [
        { completionKey: completionKey(referralId) },
        { affiliateId: referral.affiliateId, conversion: { referralId: referral.id } },
      ],
    },
  });
  if (existingCommission) {
    return { created: false, reason: 'already-created' as const, commission: existingCommission };
  }

  const fallbackProgram = referral.program ? null : await prisma.program.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  const payoutCents = referral.program?.referralPayoutCents ?? fallbackProgram?.referralPayoutCents ?? 0;
  if (payoutCents <= 0) return { created: false, reason: 'missing-payout' as const };

  const metadata = getReferralMetadataDetails(referral.metadata);
  const estimatedValueCents = Math.max(0, Math.round(metadata.estimatedValue * 100));
  const { currency } = await getCurrencySettings();
  const key = completionKey(referral.id);

  try {
    return await prisma.$transaction(async (tx) => {
      const conversion = await tx.conversion.create({
        data: {
          affiliateId: referral.affiliateId,
          referralId: referral.id,
          completionKey: key,
          eventType: 'PURCHASE',
          amountCents: estimatedValueCents || payoutCents,
          currency,
          status: 'APPROVED',
          eventMetadata: {
            source: 'completed_referral',
            programId: referral.programId ?? fallbackProgram?.id ?? null,
            referralPayoutCents: payoutCents,
            serviceInstalled: true,
          },
        },
      });

      const commission = await tx.commission.create({
        data: {
          affiliateId: referral.affiliateId,
          conversionId: conversion.id,
          userId: referral.affiliate.userId,
          completionKey: key,
          rate: 0,
          amountCents: payoutCents,
          status: 'APPROVED',
          approvedBy,
          approvedAt: new Date(),
        },
      });

      await tx.affiliate.update({
        where: { id: referral.affiliateId },
        data: { balanceCents: { increment: payoutCents } },
      });

      const eventReferral = await tx.referral.update({
        where: { id: referral.id },
        data: {
          sourceVersion: { increment: 1 },
          lastIntegrationEvent: 'referral.completed',
          syncOrigin: 'refferq',
        },
        include: REFERRAL_EVENT_INCLUDE,
      });
      await enqueueIntegrationEvent(tx, {
        eventType: 'referral.completed',
        entityType: 'referral',
        entityId: eventReferral.id,
        sourceVersion: eventReferral.sourceVersion,
        occurredAt: eventReferral.updatedAt,
        data: buildReferralSubmittedEventData(eventReferral, 'referral.completed'),
      });

      const partner = await tx.affiliate.findUniqueOrThrow({
        where: { id: referral.affiliateId },
        include: REFERRAL_PARTNER_EVENT_INCLUDE,
      });
      await enqueueIntegrationEvent(tx, {
        eventType: 'referral_partner.updated',
        entityType: 'referral_partner',
        entityId: partner.id,
        sourceVersion: Math.max(1, Math.floor(partner.updatedAt.getTime() / 1000)),
        occurredAt: partner.updatedAt,
        data: buildReferralPartnerEventData(partner, 'affiliate.updated'),
      });

      return { created: true as const, commission, conversion };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const commission = await prisma.commission.findFirst({
        where: { OR: [{ completionKey: key }, { conversion: { completionKey: key } }] },
      });
      if (commission) return { created: false, reason: 'already-created' as const, commission };
    }
    throw error;
  }
}
export async function createCommissionAdjustment(options: {
  commissionId: string;
  type: 'CLAWBACK' | 'REVERSAL' | 'CORRECTION';
  amountCents: number;
  reason: string;
  externalEventId?: string;
  createdBy: string;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = options.externalEventId
      ? await tx.commissionAdjustment.findUnique({ where: { externalEventId: options.externalEventId } })
      : null;
    if (existing) return { created: false as const, adjustment: existing };
    const commission = await tx.commission.findUnique({ where: { id: options.commissionId } });
    if (!commission) throw new Error('Commission not found.');
    const adjustment = await tx.commissionAdjustment.create({ data: options });
    await tx.affiliate.update({
      where: { id: commission.affiliateId },
      data: { balanceCents: { increment: options.amountCents } },
    });
    return { created: true as const, adjustment };
  });
}
