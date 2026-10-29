-- CreateEnum
CREATE TYPE "PricingBasis" AS ENUM ('NONE', 'DOCUMENT_COUNT', 'ANNUAL_REVENUE', 'EMPLOYEE_COUNT', 'OTHER');

-- AlterTable
ALTER TABLE "service_types" ADD COLUMN     "pricing_basis" "PricingBasis" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "pricing_unit" TEXT;

-- CreateTable
CREATE TABLE "service_price_lists" (
    "id" UUID NOT NULL,
    "service_type_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "pricing_basis" "PricingBasis" NOT NULL,
    "pricing_unit" TEXT,
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "service_price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_price_tiers" (
    "id" UUID NOT NULL,
    "price_list_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "min_value" DECIMAL(18,2) NOT NULL,
    "max_value" DECIMAL(18,2),
    "unit_price" DECIMAL(18,2) NOT NULL,
    "note" TEXT,

    CONSTRAINT "service_price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_price_lists_service_type_id_effective_from_idx" ON "service_price_lists"("service_type_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "service_price_tiers_price_list_id_sort_order_key" ON "service_price_tiers"("price_list_id", "sort_order");

-- AddForeignKey
ALTER TABLE "service_price_lists" ADD CONSTRAINT "service_price_lists_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_price_tiers" ADD CONSTRAINT "service_price_tiers_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "service_price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Một bảng giá còn hiệu lực cho mỗi dịch vụ và ngày bắt đầu, kể cả khi tạo đồng thời.
CREATE UNIQUE INDEX "service_price_lists_one_per_day" ON "service_price_lists" ("service_type_id", "effective_from")
WHERE "deleted_at" IS NULL;

-- Bậc giá hợp lệ ngay ở database: giá trị không âm, bậc có cận trên thì lớn hơn cận dưới.
ALTER TABLE "service_price_tiers" ADD CONSTRAINT "service_price_tiers_values_check"
CHECK ("min_value" >= 0 AND "unit_price" >= 0 AND ("max_value" IS NULL OR "max_value" > "min_value"));
