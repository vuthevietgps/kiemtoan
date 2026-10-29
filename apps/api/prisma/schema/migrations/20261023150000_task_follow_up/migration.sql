-- 05-D: hồ sơ yêu cầu của khách (6 trạng thái), khoảng chờ khách, đề nghị/duyệt gia hạn việc.

-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'UPLOADED', 'IN_REVIEW', 'NEEDS_SUPPLEMENT', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "DueChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "customer_document_requests" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "contract_id" UUID,
    "contract_service_id" UUID,
    "plan_requirement_id" UUID,
    "task_id" UUID,
    "period" TEXT,
    "per_period" BOOLEAN NOT NULL DEFAULT true,
    "step_key" TEXT,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "category" "DocumentCategory" NOT NULL DEFAULT 'SERVICE',
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "requested_at" DATE,
    "request_method" TEXT,
    "client_due_date" DATE,
    "supplement_note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customer_document_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_document_request_events" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "from_status" "DocumentRequestStatus",
    "to_status" "DocumentRequestStatus" NOT NULL,
    "actor_id" UUID,
    "note" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_document_request_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_document_request_files" (
    "request_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_document_request_files_pkey" PRIMARY KEY ("request_id","document_id")
);

-- CreateTable
CREATE TABLE "task_client_waits" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "automatic" BOOLEAN NOT NULL DEFAULT true,
    "from_status" "TaskStatus" NOT NULL,
    "request_id" UUID,
    "note" TEXT,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,
    "confirmed_by_id" UUID,
    "confirmed_at" TIMESTAMPTZ,

    CONSTRAINT "task_client_waits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_due_changes" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "old_due" DATE NOT NULL,
    "new_due" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "documented" BOOLEAN NOT NULL DEFAULT false,
    "status" "DueChangeStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ,
    "decision_note" TEXT,

    CONSTRAINT "task_due_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_document_requests_contract_service_id_period_idx" ON "customer_document_requests"("contract_service_id", "period");

-- CreateIndex
CREATE INDEX "customer_document_requests_customer_id_status_idx" ON "customer_document_requests"("customer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_document_requests_plan_requirement_id_period_key" ON "customer_document_requests"("plan_requirement_id", "period");

-- CreateIndex
CREATE INDEX "customer_document_request_events_request_id_occurred_at_idx" ON "customer_document_request_events"("request_id", "occurred_at");

-- CreateIndex
CREATE INDEX "task_client_waits_task_id_started_at_idx" ON "task_client_waits"("task_id", "started_at");

-- CreateIndex
CREATE INDEX "task_due_changes_task_id_requested_at_idx" ON "task_due_changes"("task_id", "requested_at");

-- CreateIndex
CREATE INDEX "task_due_changes_status_idx" ON "task_due_changes"("status");

-- AddForeignKey
ALTER TABLE "customer_document_request_events" ADD CONSTRAINT "customer_document_request_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "customer_document_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_document_request_files" ADD CONSTRAINT "customer_document_request_files_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "customer_document_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_client_waits" ADD CONSTRAINT "task_client_waits_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_due_changes" ADD CONSTRAINT "task_due_changes_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

