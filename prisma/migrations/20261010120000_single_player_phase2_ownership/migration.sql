-- Single Player Phase 2: permanent ownership metadata
ALTER TABLE "SinglePlayerZone" ADD COLUMN "ownedAt" TIMESTAMP(3);
ALTER TABLE "SinglePlayerZone" ADD COLUMN "guardCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "SinglePlayerZone"
SET "ownedAt" = "updatedAt"
WHERE "currentOwnerId" IS NOT NULL AND "ownedAt" IS NULL;
