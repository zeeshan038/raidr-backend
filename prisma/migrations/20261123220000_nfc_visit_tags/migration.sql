-- NFC partner visit verification (Phase 1)
CREATE TABLE IF NOT EXISTS "MerchantNfcTag" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Counter',
    "chipUid" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MerchantNfcTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantNfcTag_token_key" ON "MerchantNfcTag"("token");
CREATE INDEX IF NOT EXISTS "MerchantNfcTag_merchantId_idx" ON "MerchantNfcTag"("merchantId");
CREATE INDEX IF NOT EXISTS "MerchantNfcTag_isActive_idx" ON "MerchantNfcTag"("isActive");

CREATE TABLE IF NOT EXISTS "NfcVisit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "missionCompleted" BOOLEAN NOT NULL DEFAULT false,
    "coinsAwarded" INTEGER NOT NULL DEFAULT 0,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NfcVisit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NfcVisit_userId_merchantId_createdAt_idx" ON "NfcVisit"("userId", "merchantId", "createdAt");
CREATE INDEX IF NOT EXISTS "NfcVisit_merchantId_createdAt_idx" ON "NfcVisit"("merchantId", "createdAt");
CREATE INDEX IF NOT EXISTS "NfcVisit_tagId_createdAt_idx" ON "NfcVisit"("tagId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "MerchantNfcTag"
    ADD CONSTRAINT "MerchantNfcTag_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NfcVisit"
    ADD CONSTRAINT "NfcVisit_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NfcVisit"
    ADD CONSTRAINT "NfcVisit_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NfcVisit"
    ADD CONSTRAINT "NfcVisit_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "MerchantNfcTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
