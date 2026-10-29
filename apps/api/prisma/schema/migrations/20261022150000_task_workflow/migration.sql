-- 05-B: 8 trạng thái việc, soát xét nhiều cấp, lịch sử, cờ hạn pháp lý/giao nộp, nhóm dòng dịch vụ kế toán (H8).
-- Chuyển đổi dữ liệu 3 trạng thái cũ theo H9 (đặc tả 05): không mất việc, không bịa lịch sử duyệt.

-- CreateEnum
CREATE TYPE "ServiceTeamRole" AS ENUM ('MANAGER', 'LEAD', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskReviewDecision" AS ENUM ('ACCEPT', 'RETURN');

-- Mã việc CV-YYYY-NNNNN (năm theo giờ Việt Nam).
CREATE SEQUENCE "task_code_seq";

-- AlterTable: cờ trên bước quy trình và bước kế hoạch
ALTER TABLE "workflow_steps" ADD COLUMN     "is_statutory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_delivery" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "contract_plan_steps" ADD COLUMN     "approver_id" UUID,
ADD COLUMN     "is_statutory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_delivery" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: cột mới của việc; code và original_due_date thêm rỗng trước, điền rồi mới NOT NULL.
ALTER TABLE "tasks" ADD COLUMN     "accepted_at" TIMESTAMPTZ,
ADD COLUMN     "approver_id" UUID,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "first_submitted_at" TIMESTAMPTZ,
ADD COLUMN     "is_statutory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legacy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "original_due_date" DATE,
ADD COLUMN     "planned_start_date" DATE,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reopen_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requires_delivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "result_note" TEXT,
ADD COLUMN     "return_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "review_level" INTEGER,
ADD COLUMN     "review_levels" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewer_id" UUID;

-- H9: số cấp soát xét và người kiểm tra lấy từ bước kế hoạch đã sinh ra việc.
UPDATE "tasks" t
SET "review_levels" = s."review_levels",
    "reviewer_id" = s."reviewer_id",
    "planned_start_date" = s."planned_start"
FROM "contract_plan_steps" s
WHERE t."plan_step_id" = s."id";

-- H9: hạn gốc = hạn hiện tại; mốc nộp đầu = completedAt nếu có; mọi bản ghi gắn nhãn chuyển đổi.
UPDATE "tasks"
SET "original_due_date" = "due_date",
    "first_submitted_at" = CASE WHEN "status" = 'DONE' THEN "completed_at" END,
    "accepted_at" = CASE WHEN "status" = 'DONE' THEN "approved_at" END,
    "review_level" = CASE
      WHEN "status" = 'DONE' AND "approved_at" IS NULL AND "review_levels" >= 1 THEN 1
    END,
    "progress" = CASE WHEN "status" = 'DONE' AND ("approved_at" IS NOT NULL OR "review_levels" = 0) THEN 100 ELSE 0 END,
    -- Việc về lại Chờ kiểm tra chưa hoàn thành: ngày "đã làm" cũ chỉ giữ ở mốc nộp đầu.
    "completed_at" = CASE
      WHEN "status" = 'DONE' AND "approved_at" IS NULL AND "review_levels" >= 1 THEN NULL
      ELSE "completed_at"
    END,
    "legacy" = true;

-- Mã việc cho dữ liệu cũ theo thứ tự tạo, rồi đặt sequence tiếp sau.
WITH ordered AS (
  SELECT "id", "created_at", row_number() OVER (ORDER BY "created_at", "id") AS rn FROM "tasks"
)
UPDATE "tasks" t
SET "code" = 'CV-' || to_char(timezone('Asia/Ho_Chi_Minh', o."created_at"), 'YYYY') || '-' || lpad(o.rn::text, 5, '0')
FROM ordered o
WHERE t."id" = o."id";

SELECT setval('task_code_seq', (SELECT count(*) FROM "tasks") + 1, false);

ALTER TABLE "tasks" ALTER COLUMN "code" SET NOT NULL,
ALTER COLUMN "code" SET DEFAULT ('CV-'::text || to_char(timezone('Asia/Ho_Chi_Minh'::text, now()), 'YYYY'::text) || '-'::text || lpad((nextval('task_code_seq'::regclass))::text, 5, '0'::text)),
ALTER COLUMN "original_due_date" SET NOT NULL;

-- AlterEnum theo H9: Chưa làm → Chưa bắt đầu; Đang làm → Đang thực hiện; Đã làm đã duyệt → Hoàn thành;
-- Đã làm chưa duyệt: bước cần soát xét → Chờ kiểm tra (cấp 1), không cần → Hoàn thành.
ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'WAITING_CLIENT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'COMPLETED', 'ON_HOLD');
ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tasks" ALTER COLUMN "status" TYPE "TaskStatus" USING (
  CASE "status"::text
    WHEN 'TODO' THEN 'NOT_STARTED'
    WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'
    ELSE CASE WHEN "review_level" = 1 THEN 'IN_REVIEW' ELSE 'COMPLETED' END
  END
)::"TaskStatus";
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';
DROP TYPE "TaskStatus_old";

ALTER TABLE "tasks" ADD COLUMN "status_before_hold" "TaskStatus";

-- CreateTable
CREATE TABLE "service_teams" (
    "id" UUID NOT NULL,
    "contract_service_id" UUID NOT NULL,
    "manager_id" UUID,
    "lead_id" UUID,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_team_members" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "service_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_team_role_history" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "role" "ServiceTeamRole" NOT NULL,
    "user_id" UUID NOT NULL,
    "from_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "to_at" TIMESTAMPTZ,

    CONSTRAINT "service_team_role_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_status_events" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "from_status" "TaskStatus",
    "to_status" "TaskStatus" NOT NULL,
    "actor_id" UUID,
    "note" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_reviews" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "decision" "TaskReviewDecision" NOT NULL,
    "note" TEXT,
    "entered_at" TIMESTAMPTZ NOT NULL,
    "decided_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reviews_pkey" PRIMARY KEY ("id")
);

-- H9: một dòng lịch sử "chuyển đổi" cho mỗi việc cũ; không tạo lượt soát xét giả.
INSERT INTO "task_status_events" ("id", "task_id", "from_status", "to_status", "actor_id", "note", "occurred_at")
SELECT gen_random_uuid(), "id", NULL, "status", NULL, 'Chuyển đổi từ 3 trạng thái cũ (H9)', CURRENT_TIMESTAMP
FROM "tasks";

-- CreateIndex
CREATE UNIQUE INDEX "service_teams_contract_service_id_key" ON "service_teams"("contract_service_id");

-- CreateIndex
CREATE INDEX "service_teams_manager_id_idx" ON "service_teams"("manager_id");

-- CreateIndex
CREATE INDEX "service_teams_lead_id_idx" ON "service_teams"("lead_id");

-- CreateIndex
CREATE INDEX "service_team_members_user_id_idx" ON "service_team_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_team_members_team_id_user_id_key" ON "service_team_members"("team_id", "user_id");

-- CreateIndex
CREATE INDEX "service_team_role_history_team_id_role_idx" ON "service_team_role_history"("team_id", "role");

-- CreateIndex
CREATE INDEX "service_team_role_history_user_id_idx" ON "service_team_role_history"("user_id");

-- CreateIndex
CREATE INDEX "task_status_events_task_id_occurred_at_idx" ON "task_status_events"("task_id", "occurred_at");

-- CreateIndex
CREATE INDEX "task_reviews_task_id_decided_at_idx" ON "task_reviews"("task_id", "decided_at");

-- CreateIndex
CREATE INDEX "task_reviews_reviewer_id_decided_at_idx" ON "task_reviews"("reviewer_id", "decided_at");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_code_key" ON "tasks"("code");

-- CreateIndex
CREATE INDEX "tasks_reviewer_id_status_idx" ON "tasks"("reviewer_id", "status");

-- CreateIndex
CREATE INDEX "tasks_approver_id_status_idx" ON "tasks"("approver_id", "status");

-- AddForeignKey
ALTER TABLE "service_teams" ADD CONSTRAINT "service_teams_contract_service_id_fkey" FOREIGN KEY ("contract_service_id") REFERENCES "contract_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_team_members" ADD CONSTRAINT "service_team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "service_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_team_role_history" ADD CONSTRAINT "service_team_role_history_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "service_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_events" ADD CONSTRAINT "task_status_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reviews" ADD CONSTRAINT "task_reviews_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
