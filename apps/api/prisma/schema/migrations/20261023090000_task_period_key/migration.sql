-- 05-C (H12): một bước kế hoạch sinh việc cho nhiều kỳ; khoá chống trùng đổi từ bước sang (bước, kỳ).

-- DropIndex
DROP INDEX "tasks_plan_step_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "tasks_plan_step_id_period_key" ON "tasks"("plan_step_id", "period");
