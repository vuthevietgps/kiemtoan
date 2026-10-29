-- CreateEnum
CREATE TYPE "DocumentTemplateType" AS ENUM ('QUOTATION', 'CONTRACT', 'APPENDIX', 'ACCEPTANCE', 'LIQUIDATION', 'PAYMENT_REQUEST');

-- CreateEnum
CREATE TYPE "ContractDocumentSource" AS ENUM ('GENERATED', 'SIGNED');

-- CreateTable
CREATE TABLE "document_templates" (
    "id" UUID NOT NULL,
    "type" "DocumentTemplateType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "file_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "fields" TEXT[],
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_template_versions" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "fields" TEXT[],
    "note" TEXT,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_documents" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "type" "DocumentTemplateType" NOT NULL,
    "source" "ContractDocumentSource" NOT NULL,
    "template_id" UUID,
    "template_version" INTEGER,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contract_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_templates_type_is_active_idx" ON "document_templates"("type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "document_template_versions_template_id_version_key" ON "document_template_versions"("template_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "contract_documents_document_id_key" ON "contract_documents"("document_id");

-- CreateIndex
CREATE INDEX "contract_documents_contract_id_type_idx" ON "contract_documents"("contract_id", "type");

-- AddForeignKey
ALTER TABLE "document_template_versions" ADD CONSTRAINT "document_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_documents" ADD CONSTRAINT "contract_documents_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_documents" ADD CONSTRAINT "contract_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_documents" ADD CONSTRAINT "contract_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

