# ConnectPath / Twenty data contract

Contract version: `1`  
Schema manifest: `src/lib/integrations/twenty/schema-manifest.ts`

This document is the human-readable companion to the executable manifest. API names must be changed in the manifest first; bootstrap, sync, reconciliation, and contract tests consume that file.

## Ownership

| Data | Authority | Mirror behavior |
| --- | --- | --- |
| Portal login, partner status, program assignments | Refferq | Read-only operational mirror in Twenty. |
| Original referral and partner-visible ID | Refferq | Immutable external key in Twenty. |
| Commission, balance, payout, and clawback ledger | Refferq | Read-only reporting mirror; no sensitive payout credentials. |
| People and Companies | Twenty | Refferq supplies source contact data; Twenty owns canonical CRM relations. |
| Properties and Service Locations | Twenty | A Refferq Program maps by explicit ID, never by display name. |
| Provider and address-level availability | Twenty | Refferq may send requested provider but never owns qualification. |
| Visits and follow-up work | Twenty | Mirrored only when a visit creates a Refferq referral. |
| Opportunity lifecycle | Twenty | Approved milestones map into Refferq's coarse partner-facing status. |

## Objects

Built-in Twenty objects are extended: `person`, `company`, and `opportunity`.

Custom objects:

- `connectPathProperty`
- `connectPathServiceLocation`
- `connectPathProviderAvailability`
- `connectPathPartnerAssignment`
- `connectPathVisit`
- `referConnectReferralPartner`
- `referConnectReferral`
- `referConnectPayout`

The manifest contains every field, stable select value, unique index, relation, and recommended view name. Existing `referConnect*` names are preserved to avoid orphaning records made by the legacy workflow proof of concept.

## Referral contract

All outbound integration events use this envelope:

```json
{
  "contractVersion": 1,
  "eventId": "immutable-event-id",
  "event": "referral.updated",
  "source": "refferq",
  "sourceVersion": 3,
  "occurredAt": "2026-07-11T12:00:00.000Z",
  "entity": "referral",
  "entityId": "refferq-id",
  "data": {}
}
```

`eventId` is the delivery/idempotency key. `sourceVersion` increases when an integration-owned entity changes. Consumers must ignore an older version after a newer version was applied.

Residential referrals require a customer name, one safe contact method, and a service address. Company is optional. Move-in date is optional; desired-install date may be used instead.

Business referrals require a business name, contact name, one safe contact method, a service address, desired-install date when known, and requested services. A business referral is never forced through a residential move-in label.

The original submission is retained in `Referral.submittedSnapshot`; normalized typed fields may change without erasing that evidence.

## Status synchronization

| Twenty milestone | Refferq target | Required evidence |
| --- | --- | --- |
| Order confirmed | `SOLD` | Opportunity/referral mapping, order confirmation, fresh signed event. |
| Activation verified | `COMPLETED` | Activation flag/date and mapped referral. |
| Closed lost | `REJECTED` | Rejection reason. |
| Activation reversal / chargeback | No destructive rollback | Append a `CommissionAdjustment` and expose the exception for review. |

Only valid forward transitions are applied. An inbound event cannot edit a partner balance, payout, commission amount, portal identity, or program assignment. Echo events with `syncOrigin=refferq` or the same `lastEventId` are ignored.

## Dedupe

| Entity | Match order |
| --- | --- |
| Referral | Exact Refferq `referralId`. |
| Referral Partner | Exact Refferq `referralPartnerId`. |
| Partner Person | Stored mapping / `refferqAffiliateId`, then normalized email. |
| Customer Person | Stored mapping, normalized email, then normalized phone. Ambiguity requires review. |
| Company | Stored mapping, domain, then exact normalized name plus postal code. Ambiguity requires review. |
| Service Location | Normalized structured address including unit/suite. |
| Property | Stored Program mapping or stable property key; never Program name. |
| Opportunity | Unique Refferq referral ID. |
| Provider | Stable provider slug from the provider registry. |
| Provider Availability | Service Location + Provider + service-type key. |
| Payout | Exact Refferq `payoutId`. |

## Delivery contract

Business mutations enqueue `IntegrationOutboxEvent` rows. The worker leases bounded batches, records an immutable `IntegrationDeliveryAttempt`, applies exponential backoff with jitter, and dead-letters exhausted events. Delivery can use `TWENTY_SYNC_MODE=api` or the temporary `workflow` fallback.

Twenty outbound webhooks are accepted only after raw-body HMAC verification using `X-Twenty-Webhook-Signature` and `X-Twenty-Webhook-Timestamp`. The timestamp must fall inside the configured replay window. `(provider,eventId)` is unique in the inbox; duplicate deliveries are acknowledged without reapplying state.

## Reconciliation

Reconciliation is an asynchronous, cursor-based job. Supported modes are `dry-run`, `missing-only`, `changed-since`, `full`, `entity-specific`, and `verify-only`. Reports count scanned, created, updated, unchanged, ambiguous, failed, skipped, and retried independently; failed or skipped items are never reported as successful.

## Security and operations

- Use a Twenty API key assigned to a least-privilege role.
- Do not persist API keys, webhook secrets, bank details, tax identifiers, or credentials in event payloads or reports.
- Rotate `TWENTY_API_KEY` and `TWENTY_OUTBOUND_WEBHOOK_SECRET` independently.
- Confirm the intended workspace with `--confirm-workspace` before schema apply.
- Inventory, dry-run, and verify modes never mutate Twenty.
- Bootstrap never deletes an object or field. Incompatible drift is blocking and produces a migration recommendation.

