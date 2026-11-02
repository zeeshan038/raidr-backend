-- Idempotent User columns required by prisma/schema.prisma (login, whoami, passive coins).
-- Safe to re-run. Run before app traffic if you see missing-column 500s on /user/login.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "spGuardInventory" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coinBoostMultiplier" DOUBLE PRECISION DEFAULT 1.0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coinBoostExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferencesCompleted" BOOLEAN NOT NULL DEFAULT false;
