-- 04-F4: mức độ hồ sơ kiểm toán và nhật ký báo cáo tình hình (bám bảng LTGroup).

-- AlterTable
ALTER TABLE "audit_engagements" ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "audit_engagement_notes" (
    "id" UUID NOT NULL,
    "engagement_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_engagement_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_engagement_notes_engagement_id_created_at_idx" ON "audit_engagement_notes"("engagement_id", "created_at");

-- AddForeignKey
ALTER TABLE "audit_engagement_notes" ADD CONSTRAINT "audit_engagement_notes_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "audit_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

