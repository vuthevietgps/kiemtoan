-- CreateEnum
CREATE TYPE "AuditDeadlineKind" AS ENUM ('FIELDWORK_END', 'REVIEW_END', 'REPORT_ISSUE');

-- AlterTable
ALTER TABLE "audit_engagements" ADD COLUMN     "deadlines_locked_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "audit_engagement_deadlines" (
    "id" UUID NOT NULL,
    "engagement_id" UUID NOT NULL,
    "kind" "AuditDeadlineKind" NOT NULL,
    "original_due" DATE NOT NULL,
    "current_due" DATE NOT NULL,
    "achieved_at" TIMESTAMPTZ,

    CONSTRAINT "audit_engagement_deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_engagement_deadline_changes" (
    "id" UUID NOT NULL,
    "deadline_id" UUID NOT NULL,
    "old_due" DATE,
    "new_due" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_engagement_deadline_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_engagement_deadlines_current_due_idx" ON "audit_engagement_deadlines"("current_due");

-- CreateIndex
CREATE UNIQUE INDEX "audit_engagement_deadlines_engagement_id_kind_key" ON "audit_engagement_deadlines"("engagement_id", "kind");

-- CreateIndex
CREATE INDEX "audit_engagement_deadline_changes_deadline_id_changed_at_idx" ON "audit_engagement_deadline_changes"("deadline_id", "changed_at");

-- AddForeignKey
ALTER TABLE "audit_engagement_deadlines" ADD CONSTRAINT "audit_engagement_deadlines_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "audit_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_engagement_deadline_changes" ADD CONSTRAINT "audit_engagement_deadline_changes_deadline_id_fkey" FOREIGN KEY ("deadline_id") REFERENCES "audit_engagement_deadlines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

