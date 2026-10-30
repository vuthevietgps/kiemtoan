-- CreateEnum
CREATE TYPE "TokenProvider" AS ENUM ('VNPT_CA', 'VIETTEL_CA', 'FPT_CA', 'BKAV_CA', 'MISA_CA', 'EASY_CA', 'OTHER');

-- CreateEnum
CREATE TYPE "TokenCustody" AS ENUM ('OFFICE', 'CUSTOMER', 'LOANED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CredentialEventType" AS ENUM ('CREATED', 'UPDATED', 'SECRET_CHANGED', 'STATUS_REPORTED', 'STATUS_CHANGED', 'SECRET_VIEWED', 'SECRET_COPIED', 'BORROWED', 'RETURNED', 'HANDED_OVER', 'RECEIVED_FROM_CUSTOMER', 'RETURNED_TO_CUSTOMER', 'LOCATION_CHANGED', 'DELETED');

-- AlterTable
ALTER TABLE "client_credentials" ADD COLUMN     "custody" "TokenCustody",
ADD COLUMN     "holder_id" UUID,
ADD COLUMN     "loan_due_at" DATE,
ADD COLUMN     "loan_purpose" TEXT,
ADD COLUMN     "loaned_at" TIMESTAMPTZ,
ADD COLUMN     "provider" "TokenProvider",
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "secret_changed_at" TIMESTAMPTZ,
ADD COLUMN     "secret_changed_by_id" UUID,
ADD COLUMN     "serial_number" TEXT,
ADD COLUMN     "status_note" TEXT,
ADD COLUMN     "storage_location" TEXT,
ALTER COLUMN "username" DROP NOT NULL,
ALTER COLUMN "password_enc" DROP NOT NULL;

-- CreateTable
CREATE TABLE "credential_events" (
    "id" UUID NOT NULL,
    "credential_id" UUID NOT NULL,
    "type" "CredentialEventType" NOT NULL,
    "actor_id" UUID,
    "note" TEXT,
    "detail" JSONB,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credential_events_credential_id_occurred_at_idx" ON "credential_events"("credential_id", "occurred_at");

-- CreateIndex
CREATE INDEX "client_credentials_holder_id_idx" ON "client_credentials"("holder_id");

-- AddForeignKey
ALTER TABLE "credential_events" ADD CONSTRAINT "credential_events_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "client_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 09 (L2, L3): token cũ lưu serial ở tên đăng nhập → chuyển sang số serial (chuẩn hoá chữ hoa, bỏ khoảng
-- trắng hai đầu); nhà cung cấp suy từ nhãn/serial, không đoán được → "Khác"; nơi giữ → "Chưa xác định".
-- Mã PIN (password_enc) giữ nguyên, không giải mã lại.
UPDATE "client_credentials"
SET "serial_number" = NULLIF(UPPER(BTRIM("username")), ''),
    "username" = NULL,
    "custody" = 'UNKNOWN',
    "provider" = CASE
      WHEN CONCAT("label", ' ', "username") ILIKE '%VNPT%' THEN 'VNPT_CA'::"TokenProvider"
      WHEN CONCAT("label", ' ', "username") ILIKE '%VIETTEL%' THEN 'VIETTEL_CA'::"TokenProvider"
      WHEN CONCAT("label", ' ', "username") ILIKE '%FPT%' THEN 'FPT_CA'::"TokenProvider"
      WHEN CONCAT("label", ' ', "username") ILIKE '%BKAV%' THEN 'BKAV_CA'::"TokenProvider"
      WHEN CONCAT("label", ' ', "username") ILIKE '%MISA%' THEN 'MISA_CA'::"TokenProvider"
      WHEN CONCAT("label", ' ', "username") ILIKE '%EASY%' THEN 'EASY_CA'::"TokenProvider"
      ELSE 'OTHER'::"TokenProvider"
    END
WHERE "type" = 'DIGITAL_SIGNATURE';

-- Không bịa lịch sử: mỗi tài khoản có đúng một sự kiện "Tạo" đánh dấu dữ liệu chuyển đổi, không có người làm.
INSERT INTO "credential_events" ("id", "credential_id", "type", "actor_id", "detail", "occurred_at")
SELECT gen_random_uuid(), "id", 'CREATED', NULL, '{"migrated": true}'::jsonb, "created_at"
FROM "client_credentials";

-- L2: chặn trùng serial (cùng nhà cung cấp) giữa các token chưa xoá.
CREATE UNIQUE INDEX "client_credentials_token_serial_key" ON "client_credentials"("provider", "serial_number")
WHERE "deleted_at" IS NULL AND "serial_number" IS NOT NULL;
