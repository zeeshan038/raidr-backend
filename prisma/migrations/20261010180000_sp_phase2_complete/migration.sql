-- Phase 2 completion: notifications, empire config, B2B claim, rivalry, branding

ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN "empireVipMinOwnedZones" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN "vipRewardMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN "rivalryMilestoneHours" JSONB NOT NULL DEFAULT '[24, 48]';
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN "allowedHoldDurationHours" JSONB NOT NULL DEFAULT '[24, 48, 72]';
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN "shieldWarningMinutesBefore" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "SinglePlayerZone" ADD COLUMN "b2bRewardRedemptionCode" TEXT;
ALTER TABLE "SinglePlayerZone" ADD COLUMN "brandLogoUrl" TEXT;
ALTER TABLE "SinglePlayerZone" ADD COLUMN "eligibilityNote" TEXT;
ALTER TABLE "SinglePlayerZone" ADD COLUMN "minOwnedZonesRequired" INTEGER;
ALTER TABLE "SinglePlayerZone" ADD COLUMN "shieldWarningSentAt" TIMESTAMP(3);

CREATE TABLE "UserNotificationPreference" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "SinglePlayerB2bClaim" (
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

CREATE TABLE "SinglePlayerRivalryAlert" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "milestoneHours" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SinglePlayerRivalryAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SinglePlayerB2bClaim_zoneId_userId_holdStartedAt_key" ON "SinglePlayerB2bClaim"("zoneId", "userId", "holdStartedAt");
CREATE INDEX "SinglePlayerB2bClaim_userId_idx" ON "SinglePlayerB2bClaim"("userId");
CREATE UNIQUE INDEX "SinglePlayerRivalryAlert_zoneId_milestoneHours_key" ON "SinglePlayerRivalryAlert"("zoneId", "milestoneHours");

ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SinglePlayerB2bClaim" ADD CONSTRAINT "SinglePlayerB2bClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SinglePlayerB2bClaim" ADD CONSTRAINT "SinglePlayerB2bClaim_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "SinglePlayerZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SinglePlayerRivalryAlert" ADD CONSTRAINT "SinglePlayerRivalryAlert_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "SinglePlayerZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
