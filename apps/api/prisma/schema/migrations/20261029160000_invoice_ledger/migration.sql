-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('ORIGINAL', 'ADJUSTMENT', 'REPLACEMENT');

-- AlterEnum
ALTER TYPE "DocumentCategory" ADD VALUE 'INVOICE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InvoiceStatus" ADD VALUE 'ADJUSTED';
ALTER TYPE "InvoiceStatus" ADD VALUE 'REPLACED';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "buyer_address" TEXT,
ADD COLUMN     "buyer_email" TEXT,
ADD COLUMN     "buyer_name" TEXT,
ADD COLUMN     "buyer_tax_code" TEXT,
ADD COLUMN     "issued_at" TIMESTAMPTZ,
ADD COLUMN     "issued_by_id" UUID,
ADD COLUMN     "kind" "InvoiceKind" NOT NULL DEFAULT 'ORIGINAL',
ADD COLUMN     "lookup_code" TEXT,
ADD COLUMN     "migrated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "related_id" UUID,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "tax_authority_code" TEXT,
ADD COLUMN     "template_code" TEXT;

-- CreateTable
CREATE TABLE "invoice_installments" (
    "invoice_id" UUID NOT NULL,
    "installment_id" UUID NOT NULL,

    CONSTRAINT "invoice_installments_pkey" PRIMARY KEY ("invoice_id","installment_id")
);

-- CreateTable
CREATE TABLE "invoice_documents" (
    "invoice_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,

    CONSTRAINT "invoice_documents_pkey" PRIMARY KEY ("invoice_id","document_id")
);

-- CreateTable
CREATE TABLE "invoice_events" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "from_status" "InvoiceStatus",
    "to_status" "InvoiceStatus" NOT NULL,
    "note" TEXT,
    "actor_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_installments_installment_id_idx" ON "invoice_installments"("installment_id");

-- CreateIndex
CREATE INDEX "invoice_events_invoice_id_idx" ON "invoice_events"("invoice_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_template_code_symbol_number_key" ON "invoices"("template_code", "symbol", "number");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_related_id_fkey" FOREIGN KEY ("related_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_installments" ADD CONSTRAINT "invoice_installments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_installments" ADD CONSTRAINT "invoice_installments_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "payment_installments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_documents" ADD CONSTRAINT "invoice_documents_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_documents" ADD CONSTRAINT "invoice_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_events" ADD CONSTRAINT "invoice_events_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 08 K10: hoá đơn demo cũ là dữ liệu chuyển đổi (không có file, không bịa lịch sử). Trạng thái giữ nguyên
-- ý nghĩa: Đề nghị → Chờ xuất, Đã phát hành → Đã xuất, Huỷ → Huỷ đề nghị. Người mua lấy từ khách hàng (K7).
UPDATE "invoices" AS i
SET "migrated" = true,
    "buyer_name" = c."name",
    "buyer_tax_code" = c."tax_code",
    "buyer_address" = c."address",
    "buyer_email" = c."contact_email"
FROM "contracts" AS ct
JOIN "customers" AS c ON c."id" = ct."customer_id"
WHERE ct."id" = i."contract_id";
