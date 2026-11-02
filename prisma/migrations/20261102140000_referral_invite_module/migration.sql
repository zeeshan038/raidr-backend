-- Referral / invite friends module

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredByUserId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_inviteCode_key" ON "User"("inviteCode");
CREATE INDEX IF NOT EXISTS "User_referredByUserId_idx" ON "User"("referredByUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_referredByUserId_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_referredByUserId_fkey"
      FOREIGN KEY ("referredByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ReferralReward" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "rewardCoins" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralReward_invitedUserId_key" ON "ReferralReward"("invitedUserId");
CREATE INDEX IF NOT EXISTS "ReferralReward_inviterId_idx" ON "ReferralReward"("inviterId");
CREATE INDEX IF NOT EXISTS "ReferralReward_createdAt_idx" ON "ReferralReward"("createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReferralReward_inviterId_fkey'
  ) THEN
    ALTER TABLE "ReferralReward"
      ADD CONSTRAINT "ReferralReward_inviterId_fkey"
      FOREIGN KEY ("inviterId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReferralReward_invitedUserId_fkey'
  ) THEN
    ALTER TABLE "ReferralReward"
      ADD CONSTRAINT "ReferralReward_invitedUserId_fkey"
      FOREIGN KEY ("invitedUserId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CoinTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "linkedReferralId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CoinTransaction_userId_idx" ON "CoinTransaction"("userId");
CREATE INDEX IF NOT EXISTS "CoinTransaction_source_idx" ON "CoinTransaction"("source");
CREATE INDEX IF NOT EXISTS "CoinTransaction_createdAt_idx" ON "CoinTransaction"("createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CoinTransaction_userId_fkey'
  ) THEN
    ALTER TABLE "CoinTransaction"
      ADD CONSTRAINT "CoinTransaction_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CoinTransaction_linkedReferralId_fkey'
  ) THEN
    ALTER TABLE "CoinTransaction"
      ADD CONSTRAINT "CoinTransaction_linkedReferralId_fkey"
      FOREIGN KEY ("linkedReferralId") REFERENCES "ReferralReward"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
