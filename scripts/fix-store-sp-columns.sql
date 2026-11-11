-- Fix: Prisma Store.spCaptureTimeSec / spShieldDurationMin missing on legacy DBs
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "spCaptureTimeSec" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "spShieldDurationMin" INTEGER NOT NULL DEFAULT 60;
