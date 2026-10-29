-- CreateEnum
CREATE TYPE "WorkflowVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "WorkflowScheduleMode" AS ENUM ('PERIODIC', 'PROJECT');

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "service_type_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_template_versions" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "status" "WorkflowVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "schedule_mode" "WorkflowScheduleMode" NOT NULL DEFAULT 'PERIODIC',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "cloned_from_id" UUID,
    "published_at" TIMESTAMPTZ,
    "published_by_id" UUID,
    "retired_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "workflow_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "step_key" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "phase" TEXT,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "duration_days" INTEGER,
    "due_offset_days" INTEGER,
    "performer_role" "Role",
    "default_assignee_id" UUID,
    "review_levels" INTEGER NOT NULL DEFAULT 0,
    "reviewer_role" "Role",
    "default_reviewer_id" UUID,
    "default_approver_id" UUID,
    "requires_evidence" BOOLEAN NOT NULL DEFAULT true,
    "evidence_hint" TEXT,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_dependencies" (
    "step_id" UUID NOT NULL,
    "depends_on_step_id" UUID NOT NULL,

    CONSTRAINT "workflow_step_dependencies_pkey" PRIMARY KEY ("step_id","depends_on_step_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_templates_code_key" ON "workflow_templates"("code");

-- CreateIndex
CREATE INDEX "workflow_templates_service_type_id_idx" ON "workflow_templates"("service_type_id");

-- CreateIndex
CREATE INDEX "workflow_template_versions_template_id_status_idx" ON "workflow_template_versions"("template_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_template_versions_template_id_version_no_key" ON "workflow_template_versions"("template_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_steps_version_id_step_key_key" ON "workflow_steps"("version_id", "step_key");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_steps_version_id_sort_order_key" ON "workflow_steps"("version_id", "sort_order");

-- CreateIndex
CREATE INDEX "workflow_step_dependencies_depends_on_step_id_idx" ON "workflow_step_dependencies"("depends_on_step_id");

-- AddForeignKey
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_template_versions" ADD CONSTRAINT "workflow_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workflow_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_template_versions" ADD CONSTRAINT "workflow_template_versions_cloned_from_id_fkey" FOREIGN KEY ("cloned_from_id") REFERENCES "workflow_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "workflow_template_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_dependencies" ADD CONSTRAINT "workflow_step_dependencies_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_dependencies" ADD CONSTRAINT "workflow_step_dependencies_depends_on_step_id_fkey" FOREIGN KEY ("depends_on_step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Ràng buộc nghiệp vụ ở database: mỗi dịch vụ một quy trình mặc định; mỗi quy trình
-- tối đa một bản nháp và một bản đang hiệu lực, kể cả khi thao tác đồng thời.
CREATE UNIQUE INDEX "workflow_templates_one_default" ON "workflow_templates" ("service_type_id")
WHERE "is_default" = true AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "workflow_versions_one_draft" ON "workflow_template_versions" ("template_id")
WHERE "status" = 'DRAFT' AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "workflow_versions_one_published" ON "workflow_template_versions" ("template_id")
WHERE "status" = 'PUBLISHED' AND "deleted_at" IS NULL;

ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_values_check" CHECK (
  "review_levels" BETWEEN 0 AND 2
  AND ("duration_days" IS NULL OR "duration_days" BETWEEN 1 AND 365)
  AND ("due_offset_days" IS NULL OR "due_offset_days" BETWEEN -365 AND 365)
);
ALTER TABLE "workflow_step_dependencies" ADD CONSTRAINT "workflow_step_dependencies_not_self"
CHECK ("step_id" <> "depends_on_step_id");

-- Chuyển việc mẫu cũ thành phiên bản v1 đang hiệu lực, lập lịch theo kỳ, giữ nguyên tên,
-- số ngày lệch và yêu cầu bằng chứng; mỗi bước một cấp soát xét của trưởng nhóm (C13).
-- Không tự tạo phụ thuộc vì dữ liệu cũ không có thứ tự ràng buộc.
INSERT INTO "workflow_templates" ("id", "code", "service_type_id", "name", "is_default", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), 'QT-' || s."code" || '-001', s."id", 'Quy trình ' || s."name", true, true, now(), now()
FROM "service_types" s
WHERE EXISTS (SELECT 1 FROM "task_templates" t WHERE t."service_type_id" = s."id");

INSERT INTO "workflow_template_versions" ("id", "template_id", "version_no", "status", "schedule_mode", "revision", "note", "published_at", "created_at", "updated_at")
SELECT gen_random_uuid(), w."id", 1, 'PUBLISHED', 'PERIODIC', 1, 'Chuyển đổi từ việc mẫu', now(), now(), now()
FROM "workflow_templates" w;

INSERT INTO "workflow_steps" ("id", "version_id", "step_key", "sort_order", "name", "required", "due_offset_days", "review_levels", "reviewer_role", "requires_evidence")
SELECT gen_random_uuid(), v."id",
  'B' || CASE WHEN t.rn < 10 THEN '0' || t.rn::text ELSE t.rn::text END,
  t.rn, t."title", true, t."due_day_offset", 1, 'MANAGER', t."requires_evidence"
FROM (
  SELECT tt.*, row_number() OVER (PARTITION BY tt."service_type_id" ORDER BY tt."sort_order", tt."id") AS rn
  FROM "task_templates" tt
) t
JOIN "workflow_templates" w ON w."service_type_id" = t."service_type_id"
JOIN "workflow_template_versions" v ON v."template_id" = w."id";
