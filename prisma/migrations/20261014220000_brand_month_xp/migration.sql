-- Brand Month / XP progression + daily drop XP config
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
    "milestones" JSONB NOT NULL DEFAULT '[]',
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
