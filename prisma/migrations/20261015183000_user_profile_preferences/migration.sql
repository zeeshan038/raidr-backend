-- User onboarding profile preferences (admin-managed options + user selections)

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferencesCompleted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "ProfilePreferenceOption" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "subtitle" TEXT,
    "iconKey" TEXT,
    "accentColor" TEXT,
    "slug" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfilePreferenceOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProfilePreferenceOption_type_slug_key"
  ON "ProfilePreferenceOption"("type", "slug");
CREATE INDEX IF NOT EXISTS "ProfilePreferenceOption_type_isActive_sortOrder_idx"
  ON "ProfilePreferenceOption"("type", "isActive", "sortOrder");

CREATE TABLE IF NOT EXISTS "UserProfilePreference" (
    "userId" TEXT NOT NULL,
    "homeAddress" TEXT,
    "homeCityLabel" TEXT,
    "homeLatitude" DOUBLE PRECISION,
    "homeLongitude" DOUBLE PRECISION,
    "genderOptionId" TEXT,
    "ageRangeOptionId" TEXT,
    "raidCityOptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interestOptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProfilePreference_pkey" PRIMARY KEY ("userId")
);

DO $$ BEGIN
  ALTER TABLE "UserProfilePreference"
    ADD CONSTRAINT "UserProfilePreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
