# TwentyCRM integration

Refferq uses a transactional outbox and the authenticated Twenty API for production synchronization. Twenty sends selected operational milestones back through its signed outbound webhooks. The old workflow-trigger delivery remains available only as `TWENTY_SYNC_MODE=workflow` rollback compatibility.

The versioned ownership, object, status, dedupe, and security contract is in [connectpath-twenty-data-contract.md](./connectpath-twenty-data-contract.md). The executable schema source is `src/lib/integrations/twenty/schema-manifest.ts`.

## Configure

```env
TWENTY_API_BASE_URL="https://api.twenty.com"
TWENTY_API_KEY="tk_..."
TWENTY_WORKSPACE_ID="expected-workspace-id"
TWENTY_SYNC_MODE="api"
TWENTY_OUTBOUND_WEBHOOK_SECRET="secret-copied-from-twenty"
CRON_SECRET="long-random-value"
```

Create a Twenty API key assigned to a least-privilege role with read/write access only to People, Companies, Opportunities, and the ConnectPath custom objects. Payout mirrors must be restricted to the appropriate CRM roles. Never place bank details, identity documents, tax identifiers, or credentials in Twenty.

## Inventory and prepare the workspace

Inventory is read-only and redacts secret-shaped fields:

```bash
npm run twenty:inventory
```

Offline/connected dry-run:

```bash
npm run twenty:prepare -- --dry-run --json
```

Apply requires an explicit workspace confirmation and never deletes metadata:

```bash
npm run twenty:prepare -- --apply --confirm-workspace "$TWENTY_WORKSPACE_ID" --json
npm run twenty:prepare -- --verify --confirm-workspace "$TWENTY_WORKSPACE_ID" --json
```

An incompatible existing field type is blocking drift. The command exits nonzero and recommends a separately reviewed field migration. A second apply should report zero changes.

## Outbound delivery

Referral, partner, and payout mutations enqueue immutable events. `/api/cron/twenty-integration` leases a bounded batch, upserts records in dependency order, records remote IDs, and writes an immutable delivery attempt. 429/5xx/timeouts retry with exponential backoff and jitter. Exhausted events move to `DEAD_LETTER`.

Configure the Vercel cron with `Authorization: Bearer $CRON_SECRET`. Business mutations remain successful while Twenty is unavailable; the queue drains after recovery.

Temporary rollback mode:

```env
TWENTY_SYNC_MODE="workflow"
TWENTY_WEBHOOK_URL="https://..."
TWENTY_WORKFLOW_SIGNING_SECRET=""
```

`TWENTY_WORKFLOW_SIGNING_SECRET` only signs Refferq's legacy request. Twenty workflow-trigger ingress does not currently enforce that signature, so the workflow URL remains a credential. Do not describe this as authenticated transport.

## Inbound delivery

Create a Twenty outbound webhook targeting:

```text
POST https://your-refferq-host/api/integrations/twenty/webhook
```

Copy its signing secret to `TWENTY_OUTBOUND_WEBHOOK_SECRET`. Refferq verifies the raw body using `X-Twenty-Webhook-Signature` and `X-Twenty-Webhook-Timestamp`, applies a short replay window, and inserts one inbox row per event before returning `202`.

Supported milestones:

| Twenty evidence | Refferq result |
| --- | --- |
| Order confirmed / ConnectPath stage `ORDER` | `SOLD` |
| `activationVerified=true` | `COMPLETED` and one commission/balance increment |
| ConnectPath stage `CLOSED_LOST` plus reason | `REJECTED` |
| Activation reversed / chargeback | Append-only commission adjustment |

Generic CRM edits cannot overwrite balances, payouts, portal identity, or program assignments. Echo records with `syncOrigin=refferq` are ignored.

## Reconciliation and operations

Admins use **Admin → Integration Health** to inspect queue depth, last success, inbox failures, dead letters, and reconciliation jobs. Dead letters can be replayed without database access after the cause is fixed.

Reconciliation modes: `dry-run`, `missing-only`, `changed-since`, `full`, `entity-specific`, and `verify-only`. Jobs use keyset pagination and checkpoints; more than 500 records continue across cron runs. Counts distinguish created, updated, unchanged, ambiguous, failed, skipped, and retried.

Manual referral, partner, and payout resend endpoints now enqueue durable events and return `202`; they do not call Twenty inline.

## Rollout and recovery

1. Back up Refferq and export Twenty metadata/records.
2. Apply the additive database upgrade with `npm run db:upgrade:connectpath`, verify the data backfill, and baseline it as described in `deployment.md`.
3. Apply and verify schema in a non-production Twenty workspace.
4. Run contract tests with `npm test`.
5. Run reconciliation in `dry-run`, then `missing-only`/shadow mode.
6. Resolve ambiguous matches and count differences.
7. Enable signed inbound status writes.
8. Observe one full operating cycle before retiring workflow mode.

To pause delivery without losing events, set `TWENTY_SYNC_MODE=off`. To rotate the API key, pause, replace the least-privilege key, verify inventory, restore `api` mode, and let the worker drain. To roll back application code, preserve the integration tables; do not drop outbox, inbox, maps, attempts, adjustments, or reconciliation jobs. The additive database migration leaves legacy referral metadata intact.
