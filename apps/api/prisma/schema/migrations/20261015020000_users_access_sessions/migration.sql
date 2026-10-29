-- AlterTable
ALTER TABLE "users" ADD COLUMN     "access_role_id" UUID,
ADD COLUMN     "activated_at" TIMESTAMPTZ,
ADD COLUMN     "auth_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failed_login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "financial_access" BOOLEAN,
ADD COLUMN     "left_at" TIMESTAMPTZ,
ADD COLUMN     "locked_until" TIMESTAMPTZ,
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "secret_access" BOOLEAN;

-- CreateTable
CREATE TABLE "access_roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "base_role" "Role" NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'OWN',
    "permissions" TEXT[],
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "access_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_hash" TEXT NOT NULL,
    "auth_version" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "secret_verified_at" TIMESTAMPTZ,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_action_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_action_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "reviewed_by_id" UUID,
    "proposal" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_roles_name_key" ON "access_roles"("name");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_action_tokens_token_hash_key" ON "user_action_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "user_action_tokens_user_id_purpose_idx" ON "user_action_tokens"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "access_requests_status_created_at_idx" ON "access_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "users_access_role_id_idx" ON "users"("access_role_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_access_role_id_fkey" FOREIGN KEY ("access_role_id") REFERENCES "access_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_action_tokens" ADD CONSTRAINT "user_action_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Audit records are append-only, including for application credentials.
CREATE FUNCTION prevent_audit_log_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_changes();

