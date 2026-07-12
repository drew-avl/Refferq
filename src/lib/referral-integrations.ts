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
import { enqueueIntegrationEvent } from '@/lib/integrations/outbox';

function toTwentyPartnerEvent(eventType: WebhookEventType) {
  return eventType.replace('affiliate.', 'referral_partner.');
}

export async function notifyReferralChanged(
  referralId: string,
  eventType: WebhookEventType = 'referral.updated'
) {
  await prisma.referral.update({
    where: { id: referralId },
    data: { sourceVersion: { increment: 1 }, lastIntegrationEvent: eventType, syncOrigin: 'refferq' },
  });
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
    enqueueIntegrationEvent(prisma, {
      eventType,
      entityType: 'referral',
      entityId: referral.id,
      sourceVersion: referral.sourceVersion,
      occurredAt: referral.updatedAt,
      data: eventData,
    }),
  ]);

  if (webhookResult.status === 'rejected') {
    console.error(`Failed to trigger ${eventType} webhooks:`, webhookResult.reason);
  }

  if (twentyResult.status === 'rejected') {
    console.error('Failed to enqueue referral for TwentyCRM:', twentyResult.reason);
  }

  return {
    referralId,
    webhooks: webhookResult.status === 'fulfilled' ? webhookResult.value : null,
    twenty: twentyResult.status === 'fulfilled' ? { status: 'queued', eventId: twentyResult.value.eventId } : null,
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
    enqueueIntegrationEvent(prisma, {
      eventType: toTwentyPartnerEvent(eventType),
      entityType: 'referral_partner',
      entityId: affiliate.id,
      sourceVersion: Math.max(1, Math.floor(affiliate.updatedAt.getTime() / 1000)),
      occurredAt: affiliate.updatedAt,
      data: eventData,
    }),
  ]);

  if (webhookResult.status === 'rejected') {
    console.error(`Failed to trigger ${eventType} webhooks:`, webhookResult.reason);
  }

  if (twentyResult.status === 'rejected') {
    console.error('Failed to enqueue referral partner for TwentyCRM:', twentyResult.reason);
  }

  return {
    affiliateId,
    webhooks: webhookResult.status === 'fulfilled' ? webhookResult.value : null,
    twenty: twentyResult.status === 'fulfilled' ? { status: 'queued', eventId: twentyResult.value.eventId } : null,
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
    enqueueIntegrationEvent(prisma, {
      eventType,
      entityType: 'payout',
      entityId: payout.id,
      sourceVersion: Math.max(1, Math.floor(payout.updatedAt.getTime() / 1000)),
      occurredAt: payout.updatedAt,
      data: eventData,
    }),
  ]);

  if (webhookResult.status === 'rejected') {
    console.error(`Failed to trigger ${eventType} webhooks:`, webhookResult.reason);
  }

  if (twentyResult.status === 'rejected') {
    console.error('Failed to enqueue payout for TwentyCRM:', twentyResult.reason);
  }

  return {
    payoutId,
    webhooks: webhookResult.status === 'fulfilled' ? webhookResult.value : null,
    twenty: twentyResult.status === 'fulfilled' ? { status: 'queued', eventId: twentyResult.value.eventId } : null,
  };
}
