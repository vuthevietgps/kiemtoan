-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('GENERAL', 'DUE_REMINDER', 'OVERDUE', 'ESCALATION', 'REVIEW_SLA', 'REVIEW_SLA_ESCALATION', 'DIGEST');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'DANGER');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "kind" "NotificationKind" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
ADD COLUMN     "subject_id" UUID,
ADD COLUMN     "subject_type" TEXT;

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" UUID NOT NULL,
    "milestone" TEXT NOT NULL,
    "due_key" DATE NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "sent_at" TIMESTAMPTZ,
    "notification_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "digest_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "reminder_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "thresholds" INTEGER[],
    "send_time" TEXT NOT NULL,
    "escalation_working_days" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reminder_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_urgency_thresholds" (
    "service_type_id" UUID NOT NULL,
    "thresholds" INTEGER[],
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_urgency_thresholds_pkey" PRIMARY KEY ("service_type_id")
);

-- CreateTable
CREATE TABLE "scheduler_leases" (
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "locked_until" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "scheduler_leases_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "notification_deliveries_status_next_attempt_at_idx" ON "notification_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_created_at_idx" ON "notification_deliveries"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_subject_type_subject_id_milestone_d_key" ON "notification_deliveries"("subject_type", "subject_id", "milestone", "due_key", "channel", "user_id");

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_urgency_thresholds" ADD CONSTRAINT "service_urgency_thresholds_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cấu hình nhắc mặc định (I9/I11, PL1 IV.2): mốc 7/3/1 ngày, gửi 07:30, leo thang sau 3 ngày làm việc.
INSERT INTO "reminder_settings" ("id", "thresholds", "send_time", "escalation_working_days", "updated_at")
VALUES (1, ARRAY[7, 3, 1], '07:30', 3, now())
ON CONFLICT ("id") DO NOTHING;
ALTER TABLE "reminder_settings" ADD CONSTRAINT "reminder_settings_single_row" CHECK ("id" = 1);
