ALTER TABLE "LiveEvent" ADD COLUMN IF NOT EXISTS "displayMode" TEXT NOT NULL DEFAULT 'LIVE_MULTIPLAYER';
ALTER TABLE "LiveEvent" ADD COLUMN IF NOT EXISTS "collectionMethod" TEXT NOT NULL DEFAULT 'GPS_INSTANT';
ALTER TABLE "LiveEvent" ADD COLUMN IF NOT EXISTS "collectRadiusM" INTEGER NOT NULL DEFAULT 20;

UPDATE "LiveEvent" SET "displayMode" = 'LIVE_MULTIPLAYER' WHERE "displayMode" IS NULL OR "displayMode" = '';
UPDATE "LiveEvent" SET "collectionMethod" = 'GPS_INSTANT' WHERE "collectionMethod" IS NULL OR "collectionMethod" = '';
UPDATE "LiveEvent" SET "collectRadiusM" = 20 WHERE "collectRadiusM" IS NULL;

CREATE INDEX IF NOT EXISTS "LiveEvent_displayMode_idx" ON "LiveEvent"("displayMode");
