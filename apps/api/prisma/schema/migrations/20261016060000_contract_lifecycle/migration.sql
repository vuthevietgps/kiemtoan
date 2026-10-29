-- CreateEnum
CREATE TYPE "AmendmentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AmendmentLineAction" AS ENUM ('ADD', 'UPDATE', 'REMOVE');

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMPTZ,
ADD COLUMN     "cancelled_by_id" UUID,
ADD COLUMN     "referrer_name" TEXT,
ADD COLUMN     "referrer_note" TEXT,
ADD COLUMN     "referrer_phone" TEXT,
ADD COLUMN     "renewed_from_id" UUID,
ADD COLUMN     "sales_owner_id" UUID;

-- CreateTable
CREATE TABLE "contract_amendments" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "effective_date" DATE,
    "status" "AmendmentStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(18,2) NOT NULL,
    "vat_amount" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "installments" JSONB NOT NULL,
    "base_fingerprint" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "returned_reason" TEXT,
    "created_by_id" UUID,
    "submitted_at" TIMESTAMPTZ,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contract_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_amendment_lines" (
    "id" UUID NOT NULL,
    "amendment_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "action" "AmendmentLineAction" NOT NULL,
    "contract_service_id" UUID,
    "service_type_id" UUID,
    "description" TEXT,
    "period" TEXT,
    "quantity" INTEGER,
    "unit_price" DECIMAL(18,2),
    "amount" DECIMAL(18,2),
    "assignee_id" UUID,

    CONSTRAINT "contract_amendment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_amendments_contract_id_status_idx" ON "contract_amendments"("contract_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contract_amendments_contract_id_number_key" ON "contract_amendments"("contract_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "contract_amendment_lines_amendment_id_sort_order_key" ON "contract_amendment_lines"("amendment_id", "sort_order");

-- CreateIndex
CREATE INDEX "contracts_end_date_idx" ON "contracts"("end_date");

-- CreateIndex
CREATE INDEX "contracts_renewed_from_id_idx" ON "contracts"("renewed_from_id");

-- CreateIndex
CREATE INDEX "contracts_sales_owner_id_idx" ON "contracts"("sales_owner_id");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_renewed_from_id_fkey" FOREIGN KEY ("renewed_from_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_amendment_lines" ADD CONSTRAINT "contract_amendment_lines_amendment_id_fkey" FOREIGN KEY ("amendment_id") REFERENCES "contract_amendments"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Mỗi HĐ gốc chỉ có một HĐ tái ký còn hiệu lực (chưa huỷ, chưa xoá), kể cả khi bấm đồng thời.
CREATE UNIQUE INDEX "contracts_one_active_renewal" ON "contracts" ("renewed_from_id")
WHERE "renewed_from_id" IS NOT NULL AND "deleted_at" IS NULL AND "status" <> 'CANCELLED';
