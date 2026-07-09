import type { Prisma } from '@prisma/client';
import { getReferralMetadataDetails } from '@/lib/referrals';

const USER_SYNC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const PROGRAM_SYNC_SELECT = {
  id: true,
  name: true,
  slug: true,
  isActive: true,
  isDefault: true,
  referralPayoutCents: true,
  commissionRate: true,
  commissionType: true,
  currency: true,
  minPayoutCents: true,
  payoutFrequency: true,
} satisfies Prisma.ProgramSelect;

export const REFERRAL_EVENT_INCLUDE = {
  program: {
    select: PROGRAM_SYNC_SELECT,
  },
  affiliate: {
    include: {
      user: {
        select: USER_SYNC_SELECT,
      },
      partnerGroup: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  },
} satisfies Prisma.ReferralInclude;

export const REFERRAL_PARTNER_EVENT_INCLUDE = {
  user: {
    select: USER_SYNC_SELECT,
  },
  partnerGroup: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
  programAssignments: {
    include: {
      program: {
        select: PROGRAM_SYNC_SELECT,
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  staffAssignments: {
    include: {
      staffUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  _count: {
    select: {
      referrals: true,
      commissions: true,
      payouts: true,
    },
  },
} satisfies Prisma.AffiliateInclude;

export const PAYOUT_EVENT_INCLUDE = {
  user: {
    select: USER_SYNC_SELECT,
  },
  affiliate: {
    include: REFERRAL_PARTNER_EVENT_INCLUDE,
  },
  commissions: {
    include: {
      conversion: {
        include: {
          referral: {
            select: {
              id: true,
              leadName: true,
              leadEmail: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.PayoutInclude;

export type ReferralWithEventRelations = Prisma.ReferralGetPayload<{
  include: typeof REFERRAL_EVENT_INCLUDE;
}>;

export type ReferralPartnerWithEventRelations = Prisma.AffiliateGetPayload<{
  include: typeof REFERRAL_PARTNER_EVENT_INCLUDE;
}>;

export type PayoutWithEventRelations = Prisma.PayoutGetPayload<{
  include: typeof PAYOUT_EVENT_INCLUDE;
}>;

function toPlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

function toStringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

function buildProgramPayload(program: ReferralWithEventRelations['program'] | ReferralPartnerWithEventRelations['programAssignments'][number]['program']) {
  return program
    ? {
        id: program.id,
        name: program.name,
        slug: program.slug,
        isActive: program.isActive,
        isDefault: program.isDefault,
        currency: program.currency,
        referralPayoutCents: program.referralPayoutCents,
        commissionType: program.commissionType,
        commissionRate: program.commissionRate,
        minPayoutCents: program.minPayoutCents,
        payoutFrequency: program.payoutFrequency,
      }
    : null;
}

export function buildReferralSubmittedEventData(
  referral: ReferralWithEventRelations,
  event = 'referral.submitted'
) {
  const metadata = getReferralMetadataDetails(referral.metadata);
  const rawMetadata = toPlainObject(referral.metadata);
  const notes = referral.notes || metadata.notes;

  return {
    source: 'referconnect',
    event,
    referral: {
      id: referral.id,
      leadName: referral.leadName,
      leadEmail: referral.leadEmail,
      leadPhone: referral.leadPhone || '',
      status: referral.status,
      notes: notes || '',
      company: metadata.company,
      address: metadata.address,
      unitOrApartment: metadata.address2,
      moveInDate: metadata.moveInDate,
      estimatedValue: metadata.estimatedValue,
      source: typeof rawMetadata.source === 'string' ? rawMetadata.source : 'manual',
      createdAt: toIsoString(referral.createdAt),
      updatedAt: toIsoString(referral.updatedAt),
    },
    partner: {
      id: referral.affiliate.id,
      name: referral.affiliate.user.name,
      email: referral.affiliate.user.email,
      partnerGroup: referral.affiliate.partnerGroup
        ? {
            id: referral.affiliate.partnerGroup.id,
            name: referral.affiliate.partnerGroup.name,
          }
        : null,
    },
    program: buildProgramPayload(referral.program),
  };
}

export function buildReferralPartnerEventData(
  affiliate: ReferralPartnerWithEventRelations,
  event = 'affiliate.updated'
) {
  const payoutDetails = toPlainObject(affiliate.payoutDetails);
  const programs = affiliate.programAssignments.map((assignment) => buildProgramPayload(assignment.program));

  return {
    source: 'referconnect',
    event,
    referralPartner: {
      id: affiliate.id,
      userId: affiliate.userId,
      name: affiliate.user.name,
      email: affiliate.user.email,
      status: affiliate.user.status,
      company: toStringValue(payoutDetails.company),
      payoutMethod: toStringValue(payoutDetails.paymentMethod),
      payoutEmail: toStringValue(payoutDetails.paymentEmail),
      balanceCents: affiliate.balanceCents,
      referralCount: affiliate._count.referrals,
      commissionCount: affiliate._count.commissions,
      payoutCount: affiliate._count.payouts,
      createdAt: toIsoString(affiliate.createdAt),
      updatedAt: toIsoString(affiliate.updatedAt),
    },
    partnerGroup: affiliate.partnerGroup
      ? {
          id: affiliate.partnerGroup.id,
          name: affiliate.partnerGroup.name,
          description: affiliate.partnerGroup.description || '',
        }
      : null,
    programs,
    assignedStaff: affiliate.staffAssignments.map((assignment) => ({
      id: assignment.staffUser.id,
      name: assignment.staffUser.name,
      email: assignment.staffUser.email,
    })),
  };
}

export function buildPayoutEventData(
  payout: PayoutWithEventRelations,
  event = 'payout.updated'
) {
  const partnerData = buildReferralPartnerEventData(payout.affiliate, 'affiliate.snapshot');
  const currency = payout.affiliate.programAssignments[0]?.program.currency || 'USD';

  return {
    source: 'referconnect',
    event,
    payout: {
      id: payout.id,
      affiliateId: payout.affiliateId,
      userId: payout.userId,
      affiliateName: payout.affiliate.user.name,
      affiliateEmail: payout.affiliate.user.email,
      amountCents: payout.amountCents,
      amount: payout.amountCents / 100,
      currency,
      commissionCount: payout.commissionCount || payout.commissions.length,
      status: payout.status,
      method: payout.method || '',
      notes: payout.notes || '',
      createdBy: payout.createdBy,
      createdAt: toIsoString(payout.createdAt),
      updatedAt: toIsoString(payout.updatedAt),
      processedAt: toIsoString(payout.processedAt),
    },
    partner: partnerData.referralPartner,
    commissions: payout.commissions.map((commission) => ({
      id: commission.id,
      amountCents: commission.amountCents,
      rate: commission.rate,
      status: commission.status,
      approvedAt: toIsoString(commission.approvedAt),
      paidAt: toIsoString(commission.paidAt),
      referralId: commission.conversion.referral?.id || commission.conversion.referralId || null,
      referralLeadName: commission.conversion.referral?.leadName || '',
      referralLeadEmail: commission.conversion.referral?.leadEmail || '',
      referralStatus: commission.conversion.referral?.status || '',
    })),
  };
}

export function buildTwentyReferralWebhookPayload(
  referral: ReferralWithEventRelations,
  event = 'referral.submitted'
) {
  const eventData = buildReferralSubmittedEventData(referral, event);

  return {
    event: eventData.event,
    source: eventData.source,
    view: 'referral_list',
    entity: 'referral',
    sentAt: new Date().toISOString(),
    referralId: eventData.referral.id,
    leadName: eventData.referral.leadName,
    leadEmail: eventData.referral.leadEmail,
    leadPhone: eventData.referral.leadPhone,
    leadCompany: eventData.referral.company,
    leadAddress: eventData.referral.address,
    unitOrApartment: eventData.referral.unitOrApartment,
    moveInDate: eventData.referral.moveInDate,
    notes: eventData.referral.notes,
    status: eventData.referral.status,
    partnerName: eventData.partner.name,
    partnerEmail: eventData.partner.email,
    programName: eventData.program?.name || '',
    referral: eventData.referral,
    partner: eventData.partner,
    program: eventData.program,
  };
}

export function buildTwentyReferralPartnerWebhookPayload(
  affiliate: ReferralPartnerWithEventRelations,
  event = 'referral_partner.updated'
) {
  const eventData = buildReferralPartnerEventData(affiliate, event);

  return {
    event: eventData.event,
    source: eventData.source,
    view: 'referral_partners',
    entity: 'referral_partner',
    sentAt: new Date().toISOString(),
    referralPartnerId: eventData.referralPartner.id,
    name: eventData.referralPartner.name,
    email: eventData.referralPartner.email,
    status: eventData.referralPartner.status,
    company: eventData.referralPartner.company,
    payoutMethod: eventData.referralPartner.payoutMethod,
    payoutEmail: eventData.referralPartner.payoutEmail,
    balanceCents: eventData.referralPartner.balanceCents,
    referralCount: eventData.referralPartner.referralCount,
    partnerGroupName: eventData.partnerGroup?.name || '',
    programNames: eventData.programs.map((program) => program?.name).filter(Boolean).join(', '),
    referralPartner: eventData.referralPartner,
    partnerGroup: eventData.partnerGroup,
    programs: eventData.programs,
    assignedStaff: eventData.assignedStaff,
  };
}

export function buildTwentyPayoutWebhookPayload(
  payout: PayoutWithEventRelations,
  event = 'payout.updated'
) {
  const eventData = buildPayoutEventData(payout, event);

  return {
    event: eventData.event,
    source: eventData.source,
    view: 'payouts',
    entity: 'payout',
    sentAt: new Date().toISOString(),
    payoutId: eventData.payout.id,
    referralPartnerId: eventData.payout.affiliateId,
    affiliateName: eventData.payout.affiliateName,
    affiliateEmail: eventData.payout.affiliateEmail,
    amountCents: eventData.payout.amountCents,
    amount: eventData.payout.amount,
    currency: eventData.payout.currency,
    commissionCount: eventData.payout.commissionCount,
    status: eventData.payout.status,
    method: eventData.payout.method,
    processedAt: eventData.payout.processedAt,
    payout: eventData.payout,
    partner: eventData.partner,
    commissions: eventData.commissions,
  };
}
