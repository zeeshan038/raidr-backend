-- Guard inventory, game config, B2B zone fields
ALTER TABLE "User" ADD COLUMN "spGuardInventory" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "SinglePlayerGameConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "baseCaptureTimeSec" INTEGER NOT NULL DEFAULT 30,
    "shieldDurationMin" INTEGER NOT NULL DEFAULT 60,
    "ownershipDefenseSecPerDay" INTEGER NOT NULL DEFAULT 10,
    "secondsPerGuard" INTEGER NOT NULL DEFAULT 30,
    "maxGuardsPerZone" INTEGER NOT NULL DEFAULT 5,
    "guardPurchaseCoinPrice" INTEGER NOT NULL DEFAULT 100,
    "guardEliminationCoinPrice" INTEGER NOT NULL DEFAULT 50,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SinglePlayerGameConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SinglePlayerGameConfig" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "SinglePlayerZone" ADD COLUMN "zoneType" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "SinglePlayerZone" ADD COLUMN "merchantId" TEXT;
ALTER TABLE "SinglePlayerZone" ADD COLUMN "approvalStatus" TEXT;
ALTER TABLE "SinglePlayerZone" ADD COLUMN "holdDurationHours" INTEGER;
ALTER TABLE "SinglePlayerZone" ADD COLUMN "b2bRewardType" TEXT;
ALTER TABLE "SinglePlayerZone" ADD COLUMN "b2bRewardTitle" TEXT;
ALTER TABLE "SinglePlayerZone" ADD COLUMN "b2bRewardDescription" TEXT;
ALTER TABLE "SinglePlayerZone" ADD COLUMN "b2bRewardImageUrl" TEXT;
ALTER TABLE "SinglePlayerZone" ADD COLUMN "holdStartedAt" TIMESTAMP(3);

CREATE INDEX "SinglePlayerZone_merchantId_idx" ON "SinglePlayerZone"("merchantId");
CREATE INDEX "SinglePlayerZone_approvalStatus_idx" ON "SinglePlayerZone"("approvalStatus");
CREATE INDEX "SinglePlayerZone_zoneType_idx" ON "SinglePlayerZone"("zoneType");

ALTER TABLE "SinglePlayerZone" ADD CONSTRAINT "SinglePlayerZone_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
