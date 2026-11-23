-- Coin Rush: lock raid when prizes filled + localized Q&A answers
ALTER TABLE "CoinRushEvent"
ADD COLUMN IF NOT EXISTS "lockRaidOnWinner" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CoinRushCheckpoint"
ADD COLUMN IF NOT EXISTS "answerLocales" JSONB;
