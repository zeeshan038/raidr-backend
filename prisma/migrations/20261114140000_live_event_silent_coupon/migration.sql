ALTER TABLE "LiveEvent" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "LiveEvent_couponCode_key"
  ON "LiveEvent" ("couponCode")
  WHERE "couponCode" IS NOT NULL;
