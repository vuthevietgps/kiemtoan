-- CreateEnum
CREATE TYPE "InstallmentDueRule" AS ENUM ('FIXED_DATE', 'AFTER_REPORT_ISSUE');

-- AlterTable
ALTER TABLE "payment_installments" ADD COLUMN     "due_offset_days" INTEGER,
ADD COLUMN     "due_rule" "InstallmentDueRule" NOT NULL DEFAULT 'FIXED_DATE',
ADD COLUMN     "milestone_date" DATE;

