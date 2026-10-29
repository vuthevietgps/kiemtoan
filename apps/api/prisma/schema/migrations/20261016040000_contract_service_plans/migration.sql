-- CreateEnum
CREATE TYPE "ContractPlanStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "plan_step_id" UUID;

-- CreateTable
CREATE TABLE "contract_service_plans" (
    "id" UUID NOT NULL,
    "contract_service_id" UUID NOT NULL,
    "workflow_version_id" UUID,
    "workflow_code" TEXT,
    "workflow_version_no" INTEGER,
    "schedule_mode" "WorkflowScheduleMode" NOT NULL DEFAULT 'PERIODIC',
    "start_date" DATE NOT NULL,
    "period" TEXT NOT NULL,
    "status" "ContractPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "confirmed_by_id" UUID,
    "confirmed_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contract_service_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_plan_steps" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "step_key" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "phase" TEXT,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "duration_days" INTEGER,
    "due_offset_days" INTEGER,
    "depends_on" TEXT[],
    "planned_start" DATE,
    "due_date" DATE NOT NULL,
    "requires_evidence" BOOLEAN NOT NULL DEFAULT true,
    "review_levels" INTEGER NOT NULL DEFAULT 0,
    "reviewer_role" "Role",
    "assignee_id" UUID,
    "reviewer_id" UUID,
    "source_step_id" UUID,

    CONSTRAINT "contract_plan_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_plan_requirements" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "category" "DocumentCategory" NOT NULL DEFAULT 'SERVICE',
    "per_period" BOOLEAN NOT NULL DEFAULT false,
    "step_key" TEXT,

    CONSTRAINT "contract_plan_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_service_plans_contract_service_id_key" ON "contract_service_plans"("contract_service_id");

-- CreateIndex
CREATE INDEX "contract_service_plans_status_idx" ON "contract_service_plans"("status");

-- CreateIndex
CREATE UNIQUE INDEX "contract_plan_steps_plan_id_step_key_key" ON "contract_plan_steps"("plan_id", "step_key");

-- CreateIndex
CREATE UNIQUE INDEX "contract_plan_steps_plan_id_sort_order_key" ON "contract_plan_steps"("plan_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "contract_plan_requirements_plan_id_sort_order_key" ON "contract_plan_requirements"("plan_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_plan_step_id_key" ON "tasks"("plan_step_id");

-- AddForeignKey
ALTER TABLE "contract_service_plans" ADD CONSTRAINT "contract_service_plans_contract_service_id_fkey" FOREIGN KEY ("contract_service_id") REFERENCES "contract_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_plan_steps" ADD CONSTRAINT "contract_plan_steps_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "contract_service_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_plan_requirements" ADD CONSTRAINT "contract_plan_requirements_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "contract_service_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_plan_step_id_fkey" FOREIGN KEY ("plan_step_id") REFERENCES "contract_plan_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Dòng dịch vụ đã có việc từ trước 04-B: tạo kế hoạch "đã xác nhận (chuyển đổi)" theo phiên bản đang
-- hiệu lực của quy trình mặc định (nếu có), không chụp bước và không sinh thêm việc; việc cũ giữ nguyên,
-- không gắn plan_step_id. Dòng chưa có việc để người có quyền lập kế hoạch trên giao diện.
INSERT INTO "contract_service_plans" ("id", "contract_service_id", "workflow_version_id", "workflow_code", "workflow_version_no",
  "schedule_mode", "start_date", "period", "status", "note", "confirmed_at", "created_at", "updated_at")
SELECT gen_random_uuid(), cs."id", v."id", w."code", v."version_no", COALESCE(v."schedule_mode", 'PERIODIC'),
  c."start_date", COALESCE(cs."period", to_char(c."start_date", 'YYYY-MM')), 'CONFIRMED',
  'Chuyển đổi trước 04-B: việc đã sinh từ trước', now(), now(), now()
FROM "contract_services" cs
JOIN "contracts" c ON c."id" = cs."contract_id"
LEFT JOIN "workflow_templates" w ON w."service_type_id" = cs."service_type_id" AND w."is_default" = true AND w."deleted_at" IS NULL
LEFT JOIN "workflow_template_versions" v ON v."template_id" = w."id" AND v."status" = 'PUBLISHED' AND v."deleted_at" IS NULL
WHERE EXISTS (SELECT 1 FROM "tasks" t WHERE t."contract_service_id" = cs."id");
