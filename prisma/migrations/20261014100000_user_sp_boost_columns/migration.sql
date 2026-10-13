-- User columns for Single Player (safe if an earlier migration was skipped on prod)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "spGuardInventory" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coinBoostMultiplier" DOUBLE PRECISION DEFAULT 1.0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coinBoostExpiresAt" TIMESTAMP(3);
