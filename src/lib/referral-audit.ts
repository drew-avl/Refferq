import type { Prisma, ReferralStatus } from '@prisma/client';

export const REFERRAL_AUDIT_OBJECT_TYPE = 'REFERRAL';
export const REFERRAL_STATUS_CHANGED_ACTION = 'REFERRAL_STATUS_CHANGED';

export function buildReferralStatusAuditPayload({
  fromStatus,
  toStatus,
  reviewNotes,
  source,
}: {
  fromStatus: ReferralStatus | string;
  toStatus: ReferralStatus | string;
  reviewNotes?: string | null;
  source: 'single' | 'batch' | 'direct' | 'twenty-webhook';
}) {
  return {
    fromStatus,
    toStatus,
    reviewNotes: reviewNotes || null,
    source,
  };
}

export async function recordReferralStatusChange({
  tx,
  actorId,
  referralId,
  fromStatus,
  toStatus,
  reviewNotes,
  source,
}: {
  tx: Prisma.TransactionClient;
  actorId: string;
  referralId: string;
  fromStatus: ReferralStatus | string;
  toStatus: ReferralStatus | string;
  reviewNotes?: string | null;
  source: 'single' | 'batch' | 'direct' | 'twenty-webhook';
}) {
  await tx.auditLog.create({
    data: {
      actorId,
      action: REFERRAL_STATUS_CHANGED_ACTION,
      objectType: REFERRAL_AUDIT_OBJECT_TYPE,
      objectId: referralId,
      payload: buildReferralStatusAuditPayload({
        fromStatus,
        toStatus,
        reviewNotes,
        source,
      }),
    },
  });
}
