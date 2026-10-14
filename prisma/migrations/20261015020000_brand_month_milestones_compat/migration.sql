-- Deprecated column: kept for older API containers whose Prisma client still INSERTs milestones.
-- Current schema/API do not use milestones; safe default for new rows.
ALTER TABLE "BrandMonthCampaign" ADD COLUMN IF NOT EXISTS "milestones" JSONB NOT NULL DEFAULT '[]';
