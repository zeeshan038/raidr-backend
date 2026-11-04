-- NORMAL zone competitive passive ledger (20261103180000_normal_zone_passive_ledger).
-- Idempotent — safe to re-run on dev DBs where migrate history is out of sync.

CREATE TABLE IF NOT EXISTS "SinglePlayerZonePassiveLedger" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coinsEarned" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SinglePlayerZonePassiveLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SinglePlayerZonePassiveLedger_zoneId_userId_key"
  ON "SinglePlayerZonePassiveLedger"("zoneId", "userId");
CREATE INDEX IF NOT EXISTS "SinglePlayerZonePassiveLedger_zoneId_idx"
  ON "SinglePlayerZonePassiveLedger"("zoneId");
CREATE INDEX IF NOT EXISTS "SinglePlayerZonePassiveLedger_userId_idx"
  ON "SinglePlayerZonePassiveLedger"("userId");

DO $$ BEGIN
  ALTER TABLE "SinglePlayerZonePassiveLedger"
    ADD CONSTRAINT "SinglePlayerZonePassiveLedger_zoneId_fkey"
    FOREIGN KEY ("zoneId") REFERENCES "SinglePlayerZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SinglePlayerZonePassiveLedger"
    ADD CONSTRAINT "SinglePlayerZonePassiveLedger_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
