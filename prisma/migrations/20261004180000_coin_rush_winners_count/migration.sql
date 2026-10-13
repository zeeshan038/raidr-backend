-- Align CoinRushEvent with schema (multi-winner via winnersCount + CoinRushClaim)
ALTER TABLE "CoinRushEvent" ADD COLUMN IF NOT EXISTS "winnersCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CoinRushEvent" DROP COLUMN IF EXISTS "winnerId";
