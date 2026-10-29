-- CreateTable
CREATE TABLE "document_requirements" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "category" "DocumentCategory" NOT NULL DEFAULT 'SERVICE',
    "per_period" BOOLEAN NOT NULL DEFAULT false,
    "step_id" UUID,

    CONSTRAINT "document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_requirements_step_id_idx" ON "document_requirements"("step_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_requirements_version_id_sort_order_key" ON "document_requirements"("version_id", "sort_order");

-- AddForeignKey
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "workflow_template_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_name_check"
CHECK (length(btrim("name")) BETWEEN 2 AND 200);
