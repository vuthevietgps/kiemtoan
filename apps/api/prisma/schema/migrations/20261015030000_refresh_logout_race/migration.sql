-- Accept the immediately preceding refresh token for logout only, never for renewal.
ALTER TABLE "auth_sessions" ADD COLUMN "previous_refresh_hash" TEXT;
