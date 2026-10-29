-- CreateTable
CREATE TABLE "customer_contacts" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "note" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_assignments" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_by_id" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "customer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_contacts_customer_id_deleted_at_idx" ON "customer_contacts"("customer_id", "deleted_at");

-- CreateIndex
CREATE INDEX "customer_assignments_user_id_deleted_at_idx" ON "customer_assignments"("user_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_assignments_customer_id_user_id_key" ON "customer_assignments"("customer_id", "user_id");

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_assignments" ADD CONSTRAINT "customer_assignments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_assignments" ADD CONSTRAINT "customer_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Exactly one live primary contact per customer, including concurrent writes.
CREATE UNIQUE INDEX "customer_contacts_one_primary" ON "customer_contacts" ("customer_id")
WHERE "is_primary" = true AND "deleted_at" IS NULL;

-- Preserve existing contact details without modifying source customer fields.
INSERT INTO "customer_contacts" ("id", "customer_id", "full_name", "phone", "email", "is_primary", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", COALESCE(NULLIF("contact_name", ''), "name"), "contact_phone", "contact_email", true, "created_at", "updated_at"
FROM "customers"
WHERE COALESCE("contact_name", '') <> '' OR COALESCE("contact_phone", '') <> '' OR COALESCE("contact_email", '') <> '';
