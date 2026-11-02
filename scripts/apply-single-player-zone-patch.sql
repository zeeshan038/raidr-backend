-- Optional: column patches for legacy DBs that already have SinglePlayerZone.
-- Skipped automatically when the table does not exist (minimal / referral-only DBs).

DO $patch$
BEGIN
  IF to_regclass('public."SinglePlayerZone"') IS NULL THEN
    RAISE NOTICE 'SinglePlayerZone not present — skipping zone column patches';
    RETURN;
  END IF;

  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "ownedAt" TIMESTAMP(3);
  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "guardCount" INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "zoneType" TEXT NOT NULL DEFAULT 'NORMAL';
  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "merchantId" TEXT;
  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT;
  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "holdDurationHours" INTEGER;
  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "b2bRewardType" TEXT;
  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "b2bRewardTitle" TEXT;
  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "b2bRewardDescription" TEXT;
  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "b2bRewardImageUrl" TEXT;
  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "holdStartedAt" TIMESTAMP(3);
  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "b2bRewardRedemptionCode" TEXT;
  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "brandLogoUrl" TEXT;
  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "eligibilityNote" TEXT;
  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "minOwnedZonesRequired" INTEGER;
  ALTER TABLE "SinglePlayerZone" ADD COLUMN IF NOT EXISTS "shieldWarningSentAt" TIMESTAMP(3);
END $patch$;
