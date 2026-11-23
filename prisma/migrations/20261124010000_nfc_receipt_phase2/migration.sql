-- NFC receipt photo (Phase 2) — purchase attribution after visit tap
CREATE TABLE IF NOT EXISTS "NfcReceipt" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageSha256" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "amountIls" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "receiptDatedAt" TIMESTAMP(3) NOT NULL,
    "captureSource" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "rejectReason" TEXT,
    "coinsAwarded" INTEGER NOT NULL DEFAULT 0,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "aiConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NfcReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NfcReceipt_visitId_key" ON "NfcReceipt"("visitId");
CREATE UNIQUE INDEX IF NOT EXISTS "NfcReceipt_imageSha256_key" ON "NfcReceipt"("imageSha256");
CREATE UNIQUE INDEX IF NOT EXISTS "NfcReceipt_userId_fingerprint_key" ON "NfcReceipt"("userId", "fingerprint");
CREATE INDEX IF NOT EXISTS "NfcReceipt_merchantId_createdAt_idx" ON "NfcReceipt"("merchantId", "createdAt");
CREATE INDEX IF NOT EXISTS "NfcReceipt_userId_createdAt_idx" ON "NfcReceipt"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "NfcReceipt_imageSha256_idx" ON "NfcReceipt"("imageSha256");

DO $$ BEGIN
  ALTER TABLE "NfcReceipt"
    ADD CONSTRAINT "NfcReceipt_visitId_fkey"
    FOREIGN KEY ("visitId") REFERENCES "NfcVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NfcReceipt"
    ADD CONSTRAINT "NfcReceipt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NfcReceipt"
    ADD CONSTRAINT "NfcReceipt_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
