
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('DRAFT', 'PENDING', 'RETURNED', 'APPROVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "DocumentCategory" ADD VALUE 'PAYMENT';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "approved_at" TIMESTAMPTZ,
ADD COLUMN     "approved_by_id" UUID,
ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMPTZ,
ADD COLUMN     "cancelled_by_id" UUID,
ADD COLUMN     "document_number" TEXT,
ADD COLUMN     "migrated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "return_reason" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "submitted_at" TIMESTAMPTZ,
ADD COLUMN     "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "from_status" "PaymentStatus",
    "to_status" "PaymentStatus" NOT NULL,
    "note" TEXT,
    "actor_id" UUID,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_documents" (
    "payment_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_documents_pkey" PRIMARY KEY ("payment_id","document_id")
);

-- CreateIndex
CREATE INDEX "payment_events_payment_id_occurred_at_idx" ON "payment_events"("payment_id", "occurred_at");

-- CreateIndex
CREATE INDEX "payment_documents_document_id_idx" ON "payment_documents"("document_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_documents" ADD CONSTRAINT "payment_documents_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_documents" ADD CONSTRAINT "payment_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- 07-C (J15): phiếu thu trước đây đã được tính đã thu → "Đã duyệt — dữ liệu chuyển đổi" (không bịa người
-- duyệt, lúc duyệt hay lịch sử). Phiếu đã xoá mềm → "Đã huỷ" để trạng thái nhất quán (vẫn không tính).
UPDATE "payments" SET "status" = 'APPROVED', "migrated" = true WHERE "deleted_at" IS NULL;
UPDATE "payments" SET "status" = 'CANCELLED', "migrated" = true WHERE "deleted_at" IS NOT NULL;
