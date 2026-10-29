-- CreateEnum
CREATE TYPE "AuditStage" AS ENUM ('NOT_STARTED', 'FIELDWORK', 'REVIEW', 'AWAITING_ISSUE', 'ISSUED');

-- CreateEnum
CREATE TYPE "AuditRole" AS ENUM ('MANAGER', 'LEAD', 'SIGNER1', 'SIGNER2', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "ClientDeliveryStatus" AS ENUM ('NOT_SENT', 'SOFT_COPY', 'SIGNED_SCAN', 'HARD_COPY', 'HARD_AND_SOFT');

-- CreateEnum
CREATE TYPE "OriginalFilingStatus" AS ENUM ('NOT_FILED', 'AWAITING_SIGNATURE', 'FILED');

-- CreateEnum
CREATE TYPE "AcceptanceStatus" AS ENUM ('NONE', 'AWAITING_SIGNATURE', 'SIGNED');

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "acceptance_document_id" UUID,
ADD COLUMN     "acceptance_signed_at" DATE,
ADD COLUMN     "acceptance_status" "AcceptanceStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "client_delivered_at" DATE,
ADD COLUMN     "client_delivery_status" "ClientDeliveryStatus" NOT NULL DEFAULT 'NOT_SENT',
ADD COLUMN     "dossier_revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "original_filed_at" DATE,
ADD COLUMN     "original_filing_note" TEXT,
ADD COLUMN     "original_filing_status" "OriginalFilingStatus" NOT NULL DEFAULT 'NOT_FILED';

-- AlterTable
ALTER TABLE "service_types" ADD COLUMN     "issues_audit_report" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "audit_engagements" (
    "id" UUID NOT NULL,
    "contract_service_id" UUID NOT NULL,
    "stage" "AuditStage" NOT NULL DEFAULT 'NOT_STARTED',
    "manager_id" UUID,
    "lead_id" UUID,
    "signer1_id" UUID,
    "signer2_id" UUID,
    "report_number" TEXT,
    "report_number_key" TEXT,
    "report_date" DATE,
    "report_document_id" UUID,
    "issued_by_id" UUID,
    "issued_at" TIMESTAMPTZ,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "audit_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_engagement_members" (
    "id" UUID NOT NULL,
    "engagement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "audit_engagement_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_engagement_role_history" (
    "id" UUID NOT NULL,
    "engagement_id" UUID NOT NULL,
    "role" "AuditRole" NOT NULL,
    "user_id" UUID NOT NULL,
    "from_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "to_at" TIMESTAMPTZ,

    CONSTRAINT "audit_engagement_role_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_engagement_stage_events" (
    "id" UUID NOT NULL,
    "engagement_id" UUID NOT NULL,
    "from_stage" "AuditStage" NOT NULL,
    "to_stage" "AuditStage" NOT NULL,
    "reason" TEXT,
    "actor_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_engagement_stage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_engagements_contract_service_id_key" ON "audit_engagements"("contract_service_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_engagements_report_number_key_key" ON "audit_engagements"("report_number_key");

-- CreateIndex
CREATE INDEX "audit_engagements_stage_idx" ON "audit_engagements"("stage");

-- CreateIndex
CREATE INDEX "audit_engagements_manager_id_idx" ON "audit_engagements"("manager_id");

-- CreateIndex
CREATE INDEX "audit_engagements_lead_id_idx" ON "audit_engagements"("lead_id");

-- CreateIndex
CREATE INDEX "audit_engagement_members_user_id_idx" ON "audit_engagement_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_engagement_members_engagement_id_user_id_key" ON "audit_engagement_members"("engagement_id", "user_id");

-- CreateIndex
CREATE INDEX "audit_engagement_role_history_engagement_id_role_idx" ON "audit_engagement_role_history"("engagement_id", "role");

-- CreateIndex
CREATE INDEX "audit_engagement_role_history_user_id_idx" ON "audit_engagement_role_history"("user_id");

-- CreateIndex
CREATE INDEX "audit_engagement_stage_events_engagement_id_occurred_at_idx" ON "audit_engagement_stage_events"("engagement_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "audit_engagements" ADD CONSTRAINT "audit_engagements_contract_service_id_fkey" FOREIGN KEY ("contract_service_id") REFERENCES "contract_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_engagement_members" ADD CONSTRAINT "audit_engagement_members_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "audit_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_engagement_role_history" ADD CONSTRAINT "audit_engagement_role_history_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "audit_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_engagement_stage_events" ADD CONSTRAINT "audit_engagement_stage_events_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "audit_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_acceptance_document_id_fkey" FOREIGN KEY ("acceptance_document_id") REFERENCES "contract_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

