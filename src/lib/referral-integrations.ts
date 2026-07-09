import { prisma } from '@/lib/prisma';
import { triggerWebhook, type WebhookEventType } from '@/lib/webhooks';
import {
  buildReferralSubmittedEventData,
  buildReferralPartnerEventData,
  buildPayoutEventData,
  PAYOUT_EVENT_INCLUDE,
  REFERRAL_EVENT_INCLUDE,
  REFERRAL_PARTNER_EVENT_INCLUDE,
} from '@/lib/referral-event-payload';
import { sendPayoutToTwenty, sendReferralPartnerToTwenty, sendReferralToTwenty } from '@/lib/twenty-referrals';

function toTwentyPartnerEvent(eventType: WebhookEventType) {
  return eventType.replace('affiliate.', 'referral_partner.');
}

export async function notifyReferralChanged(
  referralId: string,
  eventType: WebhookEventType = 'referral.updated'
) {
  const referral = await prisma.referral.findUnique({
    where: { id: referralId },
    include: REFERRAL_EVENT_INCLUDE,
  });

  if (!referral) {
    return null;
  }

  const eventData = buildReferralSubmittedEventData(referral, eventType);
  const [webhookResult, twentyResult] = await Promise.allSettled([
    triggerWebhook(eventType, eventData),
    sendReferralToTwenty(referral, eventType),
  ]);

  if (webhookResult.status === 'rejected') {
    console.error(`Failed to trigger ${eventType} webhooks:`, webhookResult.reason);
  }

  if (twentyResult.status === 'rejected') {
    console.error('Failed to send referral to TwentyCRM:', twentyResult.reason);
  }

  return {
    referralId,
    webhooks: webhookResult.status === 'fulfilled' ? webhookResult.value : null,
    twenty: twentyResult.status === 'fulfilled' ? twentyResult.value : null,
  };
}

export async function notifyReferralSubmitted(referralId: string) {
  return notifyReferralChanged(referralId, 'referral.submitted');
}

export async function notifyReferralPartnerChanged(
  affiliateId: string,
  eventType: WebhookEventType = 'affiliate.updated'
) {
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    include: REFERRAL_PARTNER_EVENT_INCLUDE,
  });

  if (!affiliate) {
    return null;
  }

  const eventData = buildReferralPartnerEventData(affiliate, eventType);
  const [webhookResult, twentyResult] = await Promise.allSettled([
    triggerWebhook(eventType, eventData),
    sendReferralPartnerToTwenty(affiliate, toTwentyPartnerEvent(eventType)),
  ]);

  if (webhookResult.status === 'rejected') {
    console.error(`Failed to trigger ${eventType} webhooks:`, webhookResult.reason);
  }

  if (twentyResult.status === 'rejected') {
    console.error('Failed to send referral partner to TwentyCRM:', twentyResult.reason);
  }

  return {
    affiliateId,
    webhooks: webhookResult.status === 'fulfilled' ? webhookResult.value : null,
    twenty: twentyResult.status === 'fulfilled' ? twentyResult.value : null,
  };
}

export async function notifyPayoutChanged(
  payoutId: string,
  eventType: WebhookEventType = 'payout.updated'
) {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: PAYOUT_EVENT_INCLUDE,
  });

  if (!payout) {
    return null;
  }

  const eventData = buildPayoutEventData(payout, eventType);
  const [webhookResult, twentyResult] = await Promise.allSettled([
    triggerWebhook(eventType, eventData),
    sendPayoutToTwenty(payout, eventType),
  ]);

  if (webhookResult.status === 'rejected') {
    console.error(`Failed to trigger ${eventType} webhooks:`, webhookResult.reason);
  }

  if (twentyResult.status === 'rejected') {
    console.error('Failed to send payout to TwentyCRM:', twentyResult.reason);
  }

  return {
    payoutId,
    webhooks: webhookResult.status === 'fulfilled' ? webhookResult.value : null,
    twenty: twentyResult.status === 'fulfilled' ? twentyResult.value : null,
  };
}
