-- Cap on how many zones a player may own (null = unlimited; default 5 for Figma map)
ALTER TABLE "SinglePlayerGameConfig" ADD COLUMN "maxOwnedZonesPerPlayer" INTEGER DEFAULT 5;
UPDATE "SinglePlayerGameConfig" SET "maxOwnedZonesPerPlayer" = 5 WHERE "maxOwnedZonesPerPlayer" IS NULL;
