import { prisma } from '@/lib/prisma';
import { getCurrencySettings } from '@/lib/currency';
import { getReferralMetadataDetails } from '@/lib/referrals';

export async function createCompletedReferralCommission(referralId: string, approvedBy: string) {
  const referral = await prisma.referral.findUnique({
    where: { id: referralId },
    include: {
      affiliate: true,
      program: true,
    },
  });

  if (!referral || referral.status !== 'COMPLETED') {
    return { created: false, reason: 'not-completed' };
  }

  const existingCommission = await prisma.commission.findFirst({
    where: {
      affiliateId: referral.affiliateId,
      conversion: {
        referralId: referral.id,
      },
    },
  });

  if (existingCommission) {
    return { created: false, reason: 'already-created', commission: existingCommission };
  }

  const fallbackProgram = referral.program
    ? null
    : await prisma.program.findFirst({
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });

  const payoutCents = referral.program?.referralPayoutCents ?? fallbackProgram?.referralPayoutCents ?? 0;

  if (payoutCents <= 0) {
    return { created: false, reason: 'missing-payout' };
  }

  const metadata = getReferralMetadataDetails(referral.metadata);
  const estimatedValueCents = Math.max(0, Math.round(metadata.estimatedValue * 100));
  const { currency } = await getCurrencySettings();

  const conversion = await prisma.conversion.create({
    data: {
      affiliateId: referral.affiliateId,
      referralId: referral.id,
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

  const commission = await prisma.commission.create({
    data: {
      affiliateId: referral.affiliateId,
      conversionId: conversion.id,
      userId: referral.affiliate.userId,
      rate: 0,
      amountCents: payoutCents,
      status: 'APPROVED',
      approvedBy,
      approvedAt: new Date(),
    },
  });

  await prisma.affiliate.update({
    where: { id: referral.affiliateId },
    data: {
      balanceCents: {
        increment: payoutCents,
      },
    },
  });

  return { created: true, commission, conversion };
}
