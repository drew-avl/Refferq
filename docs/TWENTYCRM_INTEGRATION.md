# TwentyCRM Sync

ReferConnect can push the three operational datasets needed for Twenty views:

- Referral List
- Referral Partners
- Payouts

The integration is webhook-first because Twenty workspaces can have custom object and field names. Create the objects/views in Twenty, then use Twenty workflow webhook triggers to upsert incoming records into those objects.

## Twenty Objects and Views

Create one custom object and default list view for each dataset:

| Twenty view | Suggested object | Stable external key |
| --- | --- | --- |
| Referral List | `referConnectReferral` | `referralId` |
| Referral Partners | `referConnectReferralPartner` | `referralPartnerId` |
| Payouts | `referConnectPayout` | `payoutId` |

At minimum, add the fields listed in the payload sections below. Twenty custom objects automatically receive system fields such as `id`, `name`, `createdAt`, and `updatedAt`; add only the ReferConnect-specific fields you need for filtering and reporting.

## Prepare Twenty Schema

You can bootstrap the schema directly through Twenty metadata APIs before you configure webhooks:

```env
TWENTY_API_BASE_URL="https://api.twenty.com"
TWENTY_API_KEY="tk_..."
```

Run from the Refferq repo:

```bash
npm run twenty:prepare
```

To add relationship fields used for partner-to-person matching, use:

```bash
npm run twenty:prepare -- --with-relations
```

Note: if relation-field creation fails in your tenant, keep `--with-relations` off and implement "match/create Person in workflow" with plain text keys (`partnerEmail` + `referralPartnerId`) first, then re-run relation sync later.

Helpful options:

```bash
npm run twenty:prepare -- --dry-run       # show what would be created
npm run twenty:prepare -- --skip-fields   # create only custom objects
npm run twenty:prepare -- --with-relations # create relation fields too
```

The script reads `.env.local` (or `.env`) and is idempotent: if the object or field already exists, it will not re-create it.

## Configure Twenty

For each view, create a workflow with an external webhook trigger:

1. In Twenty, create a workflow.
2. Use an external webhook trigger.
3. Define the expected POST body fields for the matching payload below.
4. Add an upsert/create action against the matching custom object.
5. Key upserts by `referralId`, `referralPartnerId`, or `payoutId` to avoid duplicates.
6. Copy the workflow webhook URL.

If you created relationship fields, we recommend this workflow branch pattern:
- search `Person` by `email` (use `partnerEmail` from the incoming payload).
- if found, set the relation on `referConnectReferralPartner.person`.
- if not found, create a `Person` first, then set that relation.
- then upsert the `referConnectReferralPartner` record using `referralPartnerId`.

You can use one shared workflow URL and branch on `view`, or use separate workflow URLs per view.

## Configure ReferConnect

Shared webhook setup:

```env
TWENTY_SYNC_ENABLED="true"
TWENTY_WEBHOOK_URL="https://your-shared-twenty-webhook-url"
TWENTY_WEBHOOK_SECRET=""
TWENTY_WEBHOOK_TIMEOUT_MS="12000"
```

Per-view webhook setup:

```env
TWENTY_SYNC_ENABLED="true"
TWENTY_REFERRAL_SYNC_ENABLED="true"
TWENTY_PARTNER_SYNC_ENABLED="true"
TWENTY_PAYOUT_SYNC_ENABLED="true"
TWENTY_REFERRAL_WEBHOOK_URL="https://your-referral-list-workflow-webhook"
TWENTY_PARTNER_WEBHOOK_URL="https://your-referral-partners-workflow-webhook"
TWENTY_PAYOUT_WEBHOOK_URL="https://your-payouts-workflow-webhook"
TWENTY_WEBHOOK_SECRET=""
TWENTY_WEBHOOK_TIMEOUT_MS="12000"
```

`TWENTY_WEBHOOK_URL` is the fallback when a per-view URL is blank. `TWENTY_WEBHOOK_SECRET` is optional. When set, ReferConnect adds `X-ReferConnect-Signature` using HMAC SHA-256 over `{timestamp}:{payload}` and sends the timestamp in `X-ReferConnect-Timestamp`.

## Referral List Payload

Sent on new lead submission and later lead updates.

```json
{
  "event": "referral.submitted",
  "source": "referconnect",
  "view": "referral_list",
  "entity": "referral",
  "referralId": "clx...",
  "leadName": "Jane Smith",
  "leadEmail": "jane@example.com",
  "leadPhone": "555-123-4567",
  "leadCompany": "Acme",
  "leadAddress": "100 Main St",
  "unitOrApartment": "4B",
  "moveInDate": "2026-08-01",
  "notes": "Interested in a tour",
  "status": "NEW",
  "partnerName": "Drew Partner",
  "partnerEmail": "partner@example.com",
  "programName": "Property A",
  "referral": {},
  "partner": {},
  "program": {}
}
```

Recommended columns: `referralId`, `leadName`, `leadEmail`, `leadPhone`, `status`, `programName`, `partnerName`, `moveInDate`, `notes`, `createdAt`.

## Referral Partners Payload

Sent on partner creation, partner profile/status changes, payment detail changes, and batch status/group updates.

```json
{
  "event": "referral_partner.updated",
  "source": "referconnect",
  "view": "referral_partners",
  "entity": "referral_partner",
  "referralPartnerId": "clx...",
  "name": "Drew Partner",
  "email": "partner@example.com",
  "status": "ACTIVE",
  "company": "Partner Co",
  "payoutMethod": "ZELLE",
  "payoutEmail": "partner@example.com",
  "balanceCents": 25000,
  "referralCount": 12,
  "partnerGroupName": "Preferred",
  "programNames": "Property A, Property B",
  "referralPartner": {},
  "partnerGroup": {},
  "programs": [],
  "assignedStaff": []
}
```

Recommended columns: `referralPartnerId`, `name`, `email`, `status`, `company`, `partnerGroupName`, `programNames`, `payoutMethod`, `balanceCents`, `referralCount`.

## Payouts Payload

Sent on payout creation, payout status changes, and manual resync.

```json
{
  "event": "payout.requested",
  "source": "referconnect",
  "view": "payouts",
  "entity": "payout",
  "payoutId": "clx...",
  "referralPartnerId": "clx...",
  "affiliateName": "Drew Partner",
  "affiliateEmail": "partner@example.com",
  "amountCents": 25000,
  "amount": 250,
  "currency": "USD",
  "commissionCount": 3,
  "status": "PENDING",
  "method": "ZELLE",
  "processedAt": null,
  "payout": {},
  "partner": {},
  "commissions": []
}
```

Recommended columns: `payoutId`, `affiliateName`, `affiliateEmail`, `amount`, `currency`, `commissionCount`, `status`, `method`, `createdAt`, `processedAt`.

## Events

ReferConnect sends these events to Twenty:

| View | Events |
| --- | --- |
| Referral List | `referral.submitted`, `referral.updated`, `referral.rejected` |
| Referral Partners | `referral_partner.created`, `referral_partner.updated`, `referral_partner.approved`, `referral_partner.rejected` |
| Payouts | `payout.requested`, `payout.updated`, `payout.completed`, `payout.failed` |

The existing ReferConnect webhook system also exposes matching internal events such as `affiliate.updated`, `referral.updated`, and `payout.updated` for non-Twenty integrations.

## Backfill and Manual Resend

Initial sync for all three Twenty views:

```bash
curl -X POST https://app.example.com/api/admin/twenty/sync \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d "{\"views\":[\"referral_list\",\"referral_partners\",\"payouts\"],\"limit\":500}"
```

Manual resend endpoints:

```bash
curl -X POST https://app.example.com/api/admin/referrals/{referralId}/twenty \
  -H "Cookie: your-session-cookie"

curl -X POST https://app.example.com/api/admin/affiliates/{affiliateId}/twenty \
  -H "Cookie: your-session-cookie"

curl -X POST https://app.example.com/api/admin/payouts/{payoutId}/twenty \
  -H "Cookie: your-session-cookie"
```

The endpoint returns `success: true` when Twenty accepts the webhook with a 2xx response. A missing webhook URL returns a skipped result instead of failing the Refferq workflow.
