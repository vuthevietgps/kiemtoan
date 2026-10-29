-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "created_by_id" UUID;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
