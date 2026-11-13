ALTER TABLE "LiveEvent" ADD COLUMN IF NOT EXISTS "coinReward" INTEGER;

UPDATE "LiveEvent"
SET "coinReward" = NULL
WHERE "displayMode" = 'LIVE_MULTIPLAYER';
