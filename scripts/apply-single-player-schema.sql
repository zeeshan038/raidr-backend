-- Idempotent Single Player + related patches for legacy prod DBs (safe to re-run).
-- Used when prisma migrate deploy hits P3005 (DB existed before migration history).

-- User (fixes login / Prisma User model)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "spGuardInventory" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coinBoostMultiplier" DOUBLE PRECISION DEFAULT 1.0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coinBoostExpiresAt" TIMESTAMP(3);

-- Coin rush
ALTER TABLE "CoinRushEvent" ADD COLUMN IF NOT EXISTS "winnersCount" INTEGER NOT NULL DEFAULT 1;

-- Single player zone ownership / guards
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

-- Store guards
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "itemType" TEXT NOT NULL DEFAULT 'AVATAR';
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "guardsPerPurchase" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "isStoreActive" BOOLEAN NOT NULL DEFAULT true;

-- Game config singleton
CREATE TABLE IF NOT EXISTS "SinglePlayerGameConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "baseCaptureTimeSec" INTEGER NOT NULL DEFAULT 30,
    "shieldDurationMin" INTEGER NOT NULL DEFAULT 60,
    "ownershipDefenseSecPerDay" INTEGER NOT NULL DEFAULT 10,
    "secondsPerGuard" INTEGER NOT NULL DEFAULT 30,
    "maxGuardsPerZone" INTEGER NOT NULL DEFAULT 5,
    "guardPurchaseCoinPrice" INTEGER NOT NULL DEFAULT 100,
    "guardEliminationCoinPrice" INTEGER NOT NULL DEFAULT 50,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SinglePlayerGameConfig_pkey" PRIMARY KEY ("id")
);
INSERT INTO "SinglePlayerGameConfig" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "empireVipMinOwnedZones" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "vipRewardMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "rivalryMilestoneHours" JSONB NOT NULL DEFAULT '[24, 48]';
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "allowedHoldDurationHours" JSONB NOT NULL DEFAULT '[24, 48, 72]';
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "shieldWarningMinutesBefore" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "maxOwnedZonesPerPlayer" INTEGER DEFAULT 5;

-- Notification prefs
CREATE TABLE IF NOT EXISTS "UserNotificationPreference" (
    "userId" TEXT NOT NULL,
    "masterEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyDropReminders" BOOLEAN NOT NULL DEFAULT true,
    "rareDropAlerts" BOOLEAN NOT NULL DEFAULT true,
    "raidZoneShield" BOOLEAN NOT NULL DEFAULT true,
    "zoneAttackSnatch" BOOLEAN NOT NULL DEFAULT true,
    "b2bRivalryNearby" BOOLEAN NOT NULL DEFAULT true,
    "rewardsVoucher" BOOLEAN NOT NULL DEFAULT true,
    "eventsCoinRush" BOOLEAN NOT NULL DEFAULT true,
    "promotionalSponsored" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- B2B claims
CREATE TABLE IF NOT EXISTS "SinglePlayerB2bClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "holdStartedAt" TIMESTAMP(3) NOT NULL,
    "rewardType" TEXT NOT NULL,
    "rewardTitle" TEXT NOT NULL,
    "rewardDescription" TEXT,
    "claimCode" TEXT,
    "isRedeemed" BOOLEAN NOT NULL DEFAULT false,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SinglePlayerB2bClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SinglePlayerRivalryAlert" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "milestoneHours" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SinglePlayerRivalryAlert_pkey" PRIMARY KEY ("id")
);

-- Brand Month / XP progression (20261014220000_brand_month_xp)
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "dailyDropXpNormal" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "dailyDropXpRare" INTEGER NOT NULL DEFAULT 150;

CREATE TABLE IF NOT EXISTS "BrandMonthCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brandLogoUrl" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "xpTarget" INTEGER NOT NULL,
    "inventoryTotal" INTEGER NOT NULL,
    "inventoryRemaining" INTEGER NOT NULL,
    "rewardType" TEXT NOT NULL DEFAULT 'INLINE',
    "commercialVoucherId" TEXT,
    "rewardTitle" TEXT,
    "rewardSponsorName" TEXT,
    "rewardDescription" TEXT,
    "rewardImageUrl" TEXT,
    "rewardRedemptionCode" TEXT,
    "sponsoredThemeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrandMonthCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BrandMonthProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignXp" INTEGER NOT NULL DEFAULT 0,
    "prizeStatus" TEXT NOT NULL DEFAULT 'NONE',
    "claimedAt" TIMESTAMP(3),
    "userVoucherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrandMonthProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BrandMonthProgress_userId_campaignId_key" ON "BrandMonthProgress"("userId", "campaignId");
CREATE UNIQUE INDEX IF NOT EXISTS "BrandMonthProgress_userVoucherId_key" ON "BrandMonthProgress"("userVoucherId");
CREATE INDEX IF NOT EXISTS "BrandMonthProgress_campaignId_campaignXp_idx" ON "BrandMonthProgress"("campaignId", "campaignXp");
CREATE INDEX IF NOT EXISTS "BrandMonthCampaign_isActive_startDate_endDate_idx" ON "BrandMonthCampaign"("isActive", "startDate", "endDate");

DO $$ BEGIN
    ALTER TABLE "BrandMonthCampaign" ADD CONSTRAINT "BrandMonthCampaign_commercialVoucherId_fkey" FOREIGN KEY ("commercialVoucherId") REFERENCES "CommercialVoucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BrandMonthCampaign" ADD CONSTRAINT "BrandMonthCampaign_sponsoredThemeId_fkey" FOREIGN KEY ("sponsoredThemeId") REFERENCES "SponsoredTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BrandMonthProgress" ADD CONSTRAINT "BrandMonthProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BrandMonthProgress" ADD CONSTRAINT "BrandMonthProgress_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "BrandMonthCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BrandMonthProgress" ADD CONSTRAINT "BrandMonthProgress_userVoucherId_fkey" FOREIGN KEY ("userVoucherId") REFERENCES "UserVoucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "BrandMonthCampaign" ADD COLUMN IF NOT EXISTS "milestones" JSONB NOT NULL DEFAULT '[]';
