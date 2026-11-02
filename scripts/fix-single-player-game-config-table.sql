-- Idempotent: create SinglePlayerGameConfig singleton (referral / economy APIs need this).
-- Safe when SinglePlayerZone and other SP tables were never created on this DB.

CREATE TABLE IF NOT EXISTS "SinglePlayerGameConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "baseCaptureTimeSec" INTEGER NOT NULL DEFAULT 30,
    "shieldDurationMin" INTEGER NOT NULL DEFAULT 60,
    "ownershipDefenseSecPerDay" INTEGER NOT NULL DEFAULT 10,
    "secondsPerGuard" INTEGER NOT NULL DEFAULT 30,
    "maxGuardsPerZone" INTEGER NOT NULL DEFAULT 5,
    "guardPurchaseCoinPrice" INTEGER NOT NULL DEFAULT 100,
    "guardEliminationCoinPrice" INTEGER NOT NULL DEFAULT 50,
    "empireVipMinOwnedZones" INTEGER NOT NULL DEFAULT 5,
    "vipRewardMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.25,
    "rivalryMilestoneHours" JSONB NOT NULL DEFAULT '[24, 48]',
    "allowedHoldDurationHours" JSONB NOT NULL DEFAULT '[24, 48, 72]',
    "shieldWarningMinutesBefore" INTEGER NOT NULL DEFAULT 15,
    "maxOwnedZonesPerPlayer" INTEGER DEFAULT 5,
    "dailyDropXpNormal" INTEGER NOT NULL DEFAULT 50,
    "dailyDropXpRare" INTEGER NOT NULL DEFAULT 150,
    "dailyDropCoinsNormal" INTEGER NOT NULL DEFAULT 10,
    "rareDropBonusCoins" INTEGER NOT NULL DEFAULT 25,
    "coinRushCheckpointXpMin" INTEGER NOT NULL DEFAULT 50,
    "coinRushCheckpointXpMax" INTEGER NOT NULL DEFAULT 100,
    "coinRushCheckpointCoins" INTEGER NOT NULL DEFAULT 1,
    "liveEventXpReward" INTEGER NOT NULL DEFAULT 200,
    "liveEventRedeemCoins" INTEGER NOT NULL DEFAULT 10,
    "brandMonthActionCoins" INTEGER NOT NULL DEFAULT 10,
    "b2bHoldCompleteXp" INTEGER NOT NULL DEFAULT 100,
    "b2bHoldCompleteCoins" INTEGER NOT NULL DEFAULT 20,
    "merchantAdInteractionXp" INTEGER NOT NULL DEFAULT 25,
    "referralRewardXp" INTEGER NOT NULL DEFAULT 100,
    "referralRewardCoins" INTEGER NOT NULL DEFAULT 25,
    "defaultZoneCoinsPerHour" INTEGER NOT NULL DEFAULT 10,
    "passiveCoinsDailyCapPerUser" INTEGER NOT NULL DEFAULT 240,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SinglePlayerGameConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SinglePlayerGameConfig" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Backfill columns if table existed from an older partial migration
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "empireVipMinOwnedZones" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "vipRewardMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.25;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "rivalryMilestoneHours" JSONB NOT NULL DEFAULT '[24, 48]';
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "allowedHoldDurationHours" JSONB NOT NULL DEFAULT '[24, 48, 72]';
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "shieldWarningMinutesBefore" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "maxOwnedZonesPerPlayer" INTEGER DEFAULT 5;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "dailyDropXpNormal" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "dailyDropXpRare" INTEGER NOT NULL DEFAULT 150;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "dailyDropCoinsNormal" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "rareDropBonusCoins" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "coinRushCheckpointXpMin" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "coinRushCheckpointXpMax" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "coinRushCheckpointCoins" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "liveEventXpReward" INTEGER NOT NULL DEFAULT 200;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "liveEventRedeemCoins" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "brandMonthActionCoins" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "b2bHoldCompleteXp" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "b2bHoldCompleteCoins" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "merchantAdInteractionXp" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "referralRewardXp" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "referralRewardCoins" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "defaultZoneCoinsPerHour" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN IF NOT EXISTS "passiveCoinsDailyCapPerUser" INTEGER NOT NULL DEFAULT 240;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passiveCoinsAccruedToday" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passiveCoinsAccrualDay" TEXT;
