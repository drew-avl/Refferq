-- ConnectPath / Twenty integration foundation.
-- Back up the database before applying. This migration is additive and does not
-- delete legacy JSON metadata; typed Referral columns are backfilled from it.

CREATE TYPE "ReferralCustomerType" AS ENUM ('RESIDENTIAL', 'BUSINESS');
CREATE TYPE "IntegrationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'RETRY', 'DELIVERED', 'DEAD_LETTER');
CREATE TYPE "IntegrationAttemptStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');
CREATE TYPE "InboundIntegrationStatus" AS ENUM ('ACCEPTED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');
CREATE TYPE "ReconciliationJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "CommissionAdjustmentType" AS ENUM ('CLAWBACK', 'REVERSAL', 'CORRECTION');

ALTER TABLE "referrals"
  ADD COLUMN "customer_type" "ReferralCustomerType" NOT NULL DEFAULT 'RESIDENTIAL',
  ADD COLUMN "business_name" TEXT,
  ADD COLUMN "address_line_1" TEXT,
  ADD COLUMN "address_line_2" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "postal_code" TEXT,
  ADD COLUMN "country_code" TEXT DEFAULT 'US',
  ADD COLUMN "move_in_date" DATE,
  ADD COLUMN "desired_install_date" DATE,
  ADD COLUMN "requested_services" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "order_consent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "marketing_sms_consent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "consent_captured_at" TIMESTAMP(3),
  ADD COLUMN "consent_source" TEXT,
  ADD COLUMN "submitted_snapshot" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "source_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "sync_origin" TEXT,
  ADD COLUMN "last_integration_event" TEXT;

UPDATE "referrals"
SET
  "business_name" = NULLIF("metadata"->>'company', ''),
  "address_line_1" = NULLIF("metadata"->>'address', ''),
  "address_line_2" = NULLIF(COALESCE("metadata"->>'address2', "metadata"->>'address_2'), ''),
  "move_in_date" = CASE
    WHEN COALESCE("metadata"->>'move_in_date', "metadata"->>'moveInDate') ~ '^\d{4}-\d{2}-\d{2}$'
    THEN COALESCE("metadata"->>'move_in_date', "metadata"->>'moveInDate')::date
    ELSE NULL
  END,
  "submitted_snapshot" = jsonb_build_object(
    'leadName', "lead_name",
    'leadEmail', "lead_email",
    'leadPhone', "lead_phone",
    'programId', "program_id",
    'notes', "notes",
    'metadata', "metadata",
    'submittedAt', "created_at"
  )
WHERE "submitted_snapshot" = '{}'::jsonb;

ALTER TABLE "conversions" ADD COLUMN "completion_key" TEXT;
ALTER TABLE "commissions" ADD COLUMN "completion_key" TEXT;
CREATE UNIQUE INDEX "conversions_completion_key_key" ON "conversions"("completion_key");
CREATE UNIQUE INDEX "commissions_completion_key_key" ON "commissions"("completion_key");

CREATE TABLE "integration_outbox_events" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'twenty',
  "event_type" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "source_version" INTEGER NOT NULL DEFAULT 1,
  "status" "IntegrationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "cycle_attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "locked_by" TEXT,
  "delivered_at" TIMESTAMP(3),
  "dead_lettered_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integration_outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_delivery_attempts" (
  "id" TEXT NOT NULL,
  "outbox_id" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL,
  "status" "IntegrationAttemptStatus" NOT NULL,
  "status_code" INTEGER,
  "request_id" TEXT,
  "response" TEXT,
  "error" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "integration_delivery_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_object_maps" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'twenty',
  "local_entity_type" TEXT NOT NULL,
  "local_entity_id" TEXT NOT NULL,
  "remote_object" TEXT NOT NULL,
  "remote_id" TEXT NOT NULL,
  "source_version" INTEGER NOT NULL DEFAULT 1,
  "last_event_id" TEXT,
  "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integration_object_maps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inbound_integration_events" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'twenty',
  "event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "remote_object" TEXT,
  "remote_id" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "status" "InboundIntegrationStatus" NOT NULL DEFAULT 'ACCEPTED',
  "processed_at" TIMESTAMP(3),
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inbound_integration_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_reconciliation_jobs" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'twenty',
  "mode" TEXT NOT NULL,
  "entity_type" TEXT,
  "status" "ReconciliationJobStatus" NOT NULL DEFAULT 'PENDING',
  "cursor" TEXT,
  "checkpoint" JSONB NOT NULL DEFAULT '{}',
  "counts" JSONB NOT NULL DEFAULT '{}',
  "report" JSONB NOT NULL DEFAULT '{}',
  "requested_by" TEXT NOT NULL,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integration_reconciliation_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commission_adjustments" (
  "id" TEXT NOT NULL,
  "commission_id" TEXT NOT NULL,
  "type" "CommissionAdjustmentType" NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "external_event_id" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commission_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_outbox_events_event_id_key" ON "integration_outbox_events"("event_id");
CREATE INDEX "integration_outbox_events_provider_status_available_at_idx" ON "integration_outbox_events"("provider", "status", "available_at");
CREATE INDEX "integration_outbox_events_entity_type_entity_id_created_at_idx" ON "integration_outbox_events"("entity_type", "entity_id", "created_at");
CREATE UNIQUE INDEX "integration_delivery_attempts_outbox_id_attempt_key" ON "integration_delivery_attempts"("outbox_id", "attempt");
CREATE INDEX "integration_delivery_attempts_status_started_at_idx" ON "integration_delivery_attempts"("status", "started_at");
CREATE UNIQUE INDEX "integration_object_maps_provider_local_entity_type_local_entity_id_remote_object_key" ON "integration_object_maps"("provider", "local_entity_type", "local_entity_id", "remote_object");
CREATE UNIQUE INDEX "integration_object_maps_provider_remote_object_remote_id_key" ON "integration_object_maps"("provider", "remote_object", "remote_id");
CREATE INDEX "integration_object_maps_local_entity_type_local_entity_id_idx" ON "integration_object_maps"("local_entity_type", "local_entity_id");
CREATE UNIQUE INDEX "inbound_integration_events_provider_event_id_key" ON "inbound_integration_events"("provider", "event_id");
CREATE INDEX "inbound_integration_events_provider_status_created_at_idx" ON "inbound_integration_events"("provider", "status", "created_at");
CREATE INDEX "integration_reconciliation_jobs_provider_status_created_at_idx" ON "integration_reconciliation_jobs"("provider", "status", "created_at");
CREATE UNIQUE INDEX "commission_adjustments_external_event_id_key" ON "commission_adjustments"("external_event_id");
CREATE INDEX "commission_adjustments_commission_id_created_at_idx" ON "commission_adjustments"("commission_id", "created_at");

ALTER TABLE "integration_delivery_attempts"
  ADD CONSTRAINT "integration_delivery_attempts_outbox_id_fkey"
  FOREIGN KEY ("outbox_id") REFERENCES "integration_outbox_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commission_adjustments"
  ADD CONSTRAINT "commission_adjustments_commission_id_fkey"
  FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
