-- CreateTable
CREATE TABLE "customer_import_batches" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_import_batches_user_id_expires_at_idx" ON "customer_import_batches"("user_id", "expires_at");
