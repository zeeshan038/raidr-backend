-- Single Player map core tables missing on some legacy / dev DBs (never in prisma migrate CREATE).
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "SinglePlayerZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "radius" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "coinsPerHour" INTEGER NOT NULL DEFAULT 60,
    "imageUrl" TEXT,
    "zoneType" TEXT NOT NULL DEFAULT 'NORMAL',
    "merchantId" TEXT,
    "approvalStatus" TEXT,
    "holdDurationHours" INTEGER,
    "b2bRewardType" TEXT,
    "b2bRewardTitle" TEXT,
    "b2bRewardDescription" TEXT,
    "b2bRewardImageUrl" TEXT,
    "b2bRewardRedemptionCode" TEXT,
    "brandLogoUrl" TEXT,
    "eligibilityNote" TEXT,
    "minOwnedZonesRequired" INTEGER,
    "holdStartedAt" TIMESTAMP(3),
    "shieldWarningSentAt" TIMESTAMP(3),
    "currentOwnerId" TEXT,
    "shieldExpiresAt" TIMESTAMP(3),
    "ownedAt" TIMESTAMP(3),
    "guardCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SinglePlayerZone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SinglePlayerZone_isActive_idx" ON "SinglePlayerZone"("isActive");
CREATE INDEX IF NOT EXISTS "SinglePlayerZone_merchantId_idx" ON "SinglePlayerZone"("merchantId");
CREATE INDEX IF NOT EXISTS "SinglePlayerZone_approvalStatus_idx" ON "SinglePlayerZone"("approvalStatus");
CREATE INDEX IF NOT EXISTS "SinglePlayerZone_zoneType_idx" ON "SinglePlayerZone"("zoneType");

DO $$ BEGIN
  ALTER TABLE "SinglePlayerZone"
    ADD CONSTRAINT "SinglePlayerZone_currentOwnerId_fkey"
    FOREIGN KEY ("currentOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SinglePlayerZone"
    ADD CONSTRAINT "SinglePlayerZone_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "DailyDrop" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isCollected" BOOLEAN NOT NULL DEFAULT false,
    "isRare" BOOLEAN NOT NULL DEFAULT false,
    "rewardType" TEXT NOT NULL DEFAULT '100_COINS',
    "rewardAmount" INTEGER,
    "rewardAvatarFrontUrl" TEXT,
    "rewardAvatarBackUrl" TEXT,
    "rewardVoucherTitle" TEXT,
    "rewardVoucherSponsor" TEXT,
    "rewardVoucherCode" TEXT,
    "rewardVoucherImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyDrop_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DailyDrop_userId_createdAt_idx" ON "DailyDrop"("userId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "DailyDrop"
    ADD CONSTRAINT "DailyDrop_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
