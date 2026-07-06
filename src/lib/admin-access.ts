import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export type AdminActor = {
  id: string;
  role: string;
  status: string;
};

export function isFullAdmin(user: AdminActor | null | undefined) {
  return user?.role === 'ADMIN';
}

export function isStaff(user: AdminActor | null | undefined) {
  return user?.role === 'STAFF';
}

export function canUseAdminPortal(user: AdminActor | null | undefined) {
  return !!user && user.status === 'ACTIVE' && (user.role === 'ADMIN' || user.role === 'STAFF');
}

export async function getAdminActor(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true },
  });

  return canUseAdminPortal(user) ? user : null;
}

export function scopedAffiliateWhere(user: AdminActor) {
  if (isFullAdmin(user)) return {};

  return {
    staffAssignments: {
      some: {
        staffUserId: user.id,
      },
    },
  };
}

export function scopedReferralWhere(user: AdminActor) {
  if (isFullAdmin(user)) return {};

  return {
    affiliate: {
      staffAssignments: {
        some: {
          staffUserId: user.id,
        },
      },
    },
  };
}

export async function canAccessAffiliate(user: AdminActor, affiliateId: string) {
  if (isFullAdmin(user)) return true;

  const assignment = await prisma.staffAffiliateAssignment.findUnique({
    where: {
      staffUserId_affiliateId: {
        staffUserId: user.id,
        affiliateId,
      },
    },
    select: { id: true },
  });

  return !!assignment;
}

export async function canAccessAllAffiliates(user: AdminActor, affiliateIds: string[]) {
  const uniqueIds = Array.from(new Set(affiliateIds.filter(Boolean)));
  if (uniqueIds.length === 0) return true;
  if (isFullAdmin(user)) return true;

  const count = await prisma.staffAffiliateAssignment.count({
    where: {
      staffUserId: user.id,
      affiliateId: { in: uniqueIds },
    },
  });

  return count === uniqueIds.length;
}

export async function canAccessReferral(user: AdminActor, referralId: string) {
  if (isFullAdmin(user)) return true;

  const referral = await prisma.referral.findFirst({
    where: {
      id: referralId,
      ...scopedReferralWhere(user),
    },
    select: { id: true },
  });

  return !!referral;
}
