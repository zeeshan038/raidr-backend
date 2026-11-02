-- Approved XP & Coin economy (admin-configurable via SinglePlayerGameConfig)

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

ALTER TABLE "SinglePlayerGameConfig" ALTER COLUMN "vipRewardMultiplier" SET DEFAULT 1.25;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passiveCoinsAccruedToday" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passiveCoinsAccrualDay" TEXT;

UPDATE "SinglePlayerGameConfig"
SET
  "vipRewardMultiplier" = 1.25,
  "dailyDropCoinsNormal" = COALESCE("dailyDropCoinsNormal", 10),
  "rareDropBonusCoins" = COALESCE("rareDropBonusCoins", 25),
  "coinRushCheckpointXpMin" = COALESCE("coinRushCheckpointXpMin", 50),
  "coinRushCheckpointXpMax" = COALESCE("coinRushCheckpointXpMax", 100),
  "coinRushCheckpointCoins" = COALESCE("coinRushCheckpointCoins", 1),
  "liveEventXpReward" = COALESCE("liveEventXpReward", 200),
  "liveEventRedeemCoins" = COALESCE("liveEventRedeemCoins", 10),
  "brandMonthActionCoins" = COALESCE("brandMonthActionCoins", 10),
  "b2bHoldCompleteXp" = COALESCE("b2bHoldCompleteXp", 100),
  "b2bHoldCompleteCoins" = COALESCE("b2bHoldCompleteCoins", 20),
  "merchantAdInteractionXp" = COALESCE("merchantAdInteractionXp", 25),
  "referralRewardXp" = COALESCE("referralRewardXp", 100),
  "referralRewardCoins" = COALESCE("referralRewardCoins", 25),
  "defaultZoneCoinsPerHour" = COALESCE("defaultZoneCoinsPerHour", 10),
  "passiveCoinsDailyCapPerUser" = COALESCE("passiveCoinsDailyCapPerUser", 240)
WHERE id = 'default';
