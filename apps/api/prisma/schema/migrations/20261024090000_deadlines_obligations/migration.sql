-- CreateEnum
CREATE TYPE "VatMethod" AS ENUM ('DEDUCTION', 'DIRECT', 'NONE');

-- CreateEnum
CREATE TYPE "PitPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'NONE');

-- CreateEnum
CREATE TYPE "AccountingRegime" AS ENUM ('TT200', 'TT133', 'OTHER');

-- CreateEnum
CREATE TYPE "CalendarYearStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "CalendarDayKind" AS ENUM ('DAY_OFF', 'WORKDAY');

-- CreateEnum
CREATE TYPE "ObligationGroup" AS ENUM ('TAX', 'FINANCIAL_STATEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ObligationCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ObligationDueRule" AS ENUM ('MONTH_AFTER_END', 'FIXED_IN_YEAR');

-- CreateEnum
CREATE TYPE "HolidayShift" AS ENUM ('NEXT', 'PREVIOUS');

-- CreateEnum
CREATE TYPE "ObligationVersionStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "ObligationStatus" AS ENUM ('NOT_DUE', 'PREPARING', 'FILED', 'NOT_APPLICABLE');

-- AlterTable
ALTER TABLE "contract_plan_steps" ADD COLUMN     "obligation_type_id" UUID;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "accounting_regime" "AccountingRegime",
ADD COLUMN     "fiscal_year_end_month" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "pit_period" "PitPeriod",
ADD COLUMN     "tax_authority" TEXT,
ADD COLUMN     "vat_method" "VatMethod";

-- AlterTable
ALTER TABLE "task_due_changes" ADD COLUMN     "calendar_adjusted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "obligation_id" UUID;

-- AlterTable
ALTER TABLE "workflow_steps" ADD COLUMN     "obligation_type_id" UUID;

-- CreateTable
CREATE TABLE "business_calendar_years" (
    "year" INTEGER NOT NULL,
    "status" "CalendarYearStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "confirmed_by_id" UUID,
    "confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "business_calendar_years_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "business_calendar_days" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "kind" "CalendarDayKind" NOT NULL,
    "name" TEXT NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_calendar_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" "ObligationGroup" NOT NULL DEFAULT 'TAX',
    "family" TEXT NOT NULL,
    "cycle" "ObligationCycle" NOT NULL,
    "retired_at" TIMESTAMPTZ,
    "retired_by_id" UUID,
    "retire_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "obligation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_type_versions" (
    "id" UUID NOT NULL,
    "type_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "status" "ObligationVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "effective_from" DATE NOT NULL,
    "due_rule" "ObligationDueRule" NOT NULL,
    "months_after" INTEGER,
    "due_month" INTEGER,
    "due_day" INTEGER NOT NULL,
    "use_fiscal_year" BOOLEAN NOT NULL DEFAULT true,
    "holiday_shift" "HolidayShift" NOT NULL DEFAULT 'NEXT',
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "legal_basis" TEXT,
    "note" TEXT,
    "created_by_id" UUID,
    "confirmed_by_id" UUID,
    "confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "obligation_type_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_obligation_types" (
    "service_type_id" UUID NOT NULL,
    "obligation_type_id" UUID NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_obligation_types_pkey" PRIMARY KEY ("service_type_id","obligation_type_id")
);

-- CreateTable
CREATE TABLE "customer_obligation_settings" (
    "customer_id" UUID NOT NULL,
    "obligation_type_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customer_obligation_settings_pkey" PRIMARY KEY ("customer_id","obligation_type_id")
);

-- CreateTable
CREATE TABLE "customer_obligations" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "obligation_type_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "period_end" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "original_due_date" DATE NOT NULL,
    "status" "ObligationStatus" NOT NULL DEFAULT 'NOT_DUE',
    "manually_excluded" BOOLEAN NOT NULL DEFAULT false,
    "filed_at" DATE,
    "filed_late" BOOLEAN NOT NULL DEFAULT false,
    "filed_by_id" UUID,
    "receipt_document_id" UUID,
    "note" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customer_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_obligation_events" (
    "id" UUID NOT NULL,
    "obligation_id" UUID NOT NULL,
    "from_status" "ObligationStatus",
    "to_status" "ObligationStatus" NOT NULL,
    "old_due" DATE,
    "new_due" DATE,
    "note" TEXT,
    "actor_id" UUID,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_obligation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_calendar_days_date_key" ON "business_calendar_days"("date");

-- CreateIndex
CREATE INDEX "business_calendar_days_year_idx" ON "business_calendar_days"("year");

-- CreateIndex
CREATE UNIQUE INDEX "obligation_types_code_key" ON "obligation_types"("code");

-- CreateIndex
CREATE INDEX "obligation_types_family_idx" ON "obligation_types"("family");

-- CreateIndex
CREATE UNIQUE INDEX "obligation_type_versions_type_id_version_no_key" ON "obligation_type_versions"("type_id", "version_no");

-- CreateIndex
CREATE INDEX "service_obligation_types_obligation_type_id_idx" ON "service_obligation_types"("obligation_type_id");

-- CreateIndex
CREATE INDEX "customer_obligations_due_date_idx" ON "customer_obligations"("due_date");

-- CreateIndex
CREATE INDEX "customer_obligations_status_due_date_idx" ON "customer_obligations"("status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "customer_obligations_customer_id_obligation_type_id_period_key" ON "customer_obligations"("customer_id", "obligation_type_id", "period");

-- CreateIndex
CREATE INDEX "customer_obligation_events_obligation_id_occurred_at_idx" ON "customer_obligation_events"("obligation_id", "occurred_at");

-- CreateIndex
CREATE INDEX "tasks_obligation_id_idx" ON "tasks"("obligation_id");

-- AddForeignKey
ALTER TABLE "contract_plan_steps" ADD CONSTRAINT "contract_plan_steps_obligation_type_id_fkey" FOREIGN KEY ("obligation_type_id") REFERENCES "obligation_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_calendar_days" ADD CONSTRAINT "business_calendar_days_year_fkey" FOREIGN KEY ("year") REFERENCES "business_calendar_years"("year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_type_versions" ADD CONSTRAINT "obligation_type_versions_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "obligation_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_obligation_types" ADD CONSTRAINT "service_obligation_types_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_obligation_types" ADD CONSTRAINT "service_obligation_types_obligation_type_id_fkey" FOREIGN KEY ("obligation_type_id") REFERENCES "obligation_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_obligation_settings" ADD CONSTRAINT "customer_obligation_settings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_obligation_settings" ADD CONSTRAINT "customer_obligation_settings_obligation_type_id_fkey" FOREIGN KEY ("obligation_type_id") REFERENCES "obligation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_obligations" ADD CONSTRAINT "customer_obligations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_obligations" ADD CONSTRAINT "customer_obligations_obligation_type_id_fkey" FOREIGN KEY ("obligation_type_id") REFERENCES "obligation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_obligations" ADD CONSTRAINT "customer_obligations_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "obligation_type_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_obligations" ADD CONSTRAINT "customer_obligations_receipt_document_id_fkey" FOREIGN KEY ("receipt_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_obligation_events" ADD CONSTRAINT "customer_obligation_events_obligation_id_fkey" FOREIGN KEY ("obligation_id") REFERENCES "customer_obligations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_obligation_type_id_fkey" FOREIGN KEY ("obligation_type_id") REFERENCES "obligation_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_obligation_id_fkey" FOREIGN KEY ("obligation_id") REFERENCES "customer_obligations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mỗi loại nghĩa vụ tối đa một bản nháp (I1); tạo nháp đồng thời chỉ một lần thành công.
CREATE UNIQUE INDEX "obligation_type_versions_one_draft" ON "obligation_type_versions"("type_id") WHERE "status" = 'DRAFT';

-- Tháng kết thúc năm tài chính 1–12 (I5).
ALTER TABLE "customers" ADD CONSTRAINT "customers_fiscal_year_end_month_check" CHECK ("fiscal_year_end_month" BETWEEN 1 AND 12);
