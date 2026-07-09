import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminActor, isFullAdmin } from '@/lib/admin-access';
import {
  PAYOUT_EVENT_INCLUDE,
  REFERRAL_EVENT_INCLUDE,
  REFERRAL_PARTNER_EVENT_INCLUDE,
} from '@/lib/referral-event-payload';
import { sendPayoutToTwenty, sendReferralPartnerToTwenty, sendReferralToTwenty } from '@/lib/twenty-referrals';

type SyncView = 'referral_list' | 'referral_partners' | 'payouts';

const DEFAULT_VIEWS: SyncView[] = ['referral_list', 'referral_partners', 'payouts'];

function normalizeViews(value: unknown): SyncView[] {
  if (!Array.isArray(value)) return DEFAULT_VIEWS;

  const views = value.filter((view): view is SyncView => DEFAULT_VIEWS.includes(view as SyncView));
  return views.length > 0 ? Array.from(new Set(views)) : DEFAULT_VIEWS;
}

function normalizeLimit(value: unknown) {
  const limit = Number(value || 100);
  if (!Number.isFinite(limit)) return 100;
  return Math.min(Math.max(Math.floor(limit), 1), 500);
}

function summarizeResults(results: PromiseSettledResult<unknown>[]) {
  return results.reduce(
    (summary, result) => {
      if (result.status === 'fulfilled') {
        summary.fulfilled += 1;
      } else {
        summary.rejected += 1;
      }
      return summary;
    },
    { fulfilled: 0, rejected: 0 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAdminActor(request);

    if (!isFullAdmin(user)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const views = normalizeViews(body.views);
    const limit = normalizeLimit(body.limit);
    const results: Record<string, { attempted: number; fulfilled: number; rejected: number }> = {};

    if (views.includes('referral_list')) {
      const referrals = await prisma.referral.findMany({
        include: REFERRAL_EVENT_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        take: limit,
      });
      const syncResults = await Promise.allSettled(
        referrals.map((referral) => sendReferralToTwenty(referral, 'referral.updated'))
      );
      results.referral_list = { attempted: referrals.length, ...summarizeResults(syncResults) };
    }

    if (views.includes('referral_partners')) {
      const affiliates = await prisma.affiliate.findMany({
        include: REFERRAL_PARTNER_EVENT_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        take: limit,
      });
      const syncResults = await Promise.allSettled(
        affiliates.map((affiliate) => sendReferralPartnerToTwenty(affiliate, 'referral_partner.updated'))
      );
      results.referral_partners = { attempted: affiliates.length, ...summarizeResults(syncResults) };
    }

    if (views.includes('payouts')) {
      const payouts = await prisma.payout.findMany({
        include: PAYOUT_EVENT_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        take: limit,
      });
      const syncResults = await Promise.allSettled(
        payouts.map((payout) => sendPayoutToTwenty(payout, 'payout.updated'))
      );
      results.payouts = { attempted: payouts.length, ...summarizeResults(syncResults) };
    }

    return NextResponse.json({
      success: true,
      views,
      limit,
      results,
    });
  } catch (error) {
    console.error('TwentyCRM sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync TwentyCRM views' },
      { status: 500 }
    );
  }
}
