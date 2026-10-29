-- CreateEnum
CREATE TYPE "TaskGenerationStatus" AS ENUM ('PENDING', 'GENERATING', 'DONE', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "contract_services" ADD COLUMN     "task_generation_message" TEXT,
ADD COLUMN     "task_generation_started_at" TIMESTAMPTZ,
ADD COLUMN     "task_generation_status" "TaskGenerationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "tasks_generated_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "returned_at" TIMESTAMPTZ,
ADD COLUMN     "returned_reason" TEXT;


-- Dòng dịch vụ đã có việc trước 04-A coi là đã sinh việc; dòng của HĐ đã duyệt mà chưa có việc
-- giữ "Chưa sinh" để người có quyền bấm sinh lại.
UPDATE "contract_services" cs SET "task_generation_status" = 'DONE', "tasks_generated_at" = now()
WHERE EXISTS (SELECT 1 FROM "tasks" t WHERE t."contract_service_id" = cs."id");
