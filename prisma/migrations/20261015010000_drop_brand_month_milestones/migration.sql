-- Milestones were not part of approved Brand Month spec (single xpTarget + final reward only).
ALTER TABLE "BrandMonthCampaign" DROP COLUMN IF EXISTS "milestones";
