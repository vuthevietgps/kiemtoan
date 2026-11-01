-- CreateEnum
CREATE TYPE "ReportScheduleFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "report_saved_filters" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "report" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "report_saved_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "saved_filter_id" UUID NOT NULL,
    "frequency" "ReportScheduleFrequency" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "active_from" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sent_at" TIMESTAMPTZ,
    "last_result" TEXT,
    "stopped_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_saved_filters_user_id_report_name_key" ON "report_saved_filters"("user_id", "report", "name");

-- CreateIndex
CREATE UNIQUE INDEX "report_schedules_saved_filter_id_key" ON "report_schedules"("saved_filter_id");

-- CreateIndex
CREATE INDEX "report_schedules_enabled_idx" ON "report_schedules"("enabled");

-- CreateIndex
CREATE INDEX "report_schedules_user_id_idx" ON "report_schedules"("user_id");

-- AddForeignKey
ALTER TABLE "report_saved_filters" ADD CONSTRAINT "report_saved_filters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_saved_filter_id_fkey" FOREIGN KEY ("saved_filter_id") REFERENCES "report_saved_filters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

