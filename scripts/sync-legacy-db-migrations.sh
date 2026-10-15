#!/bin/sh
# Legacy production DB: tables exist but Prisma migrate history was never baselined (P3005).
# Run from repo root when DATABASE_URL points at that DB (local Mac or server):
#   sh scripts/sync-legacy-db-migrations.sh
set -e
cd "$(dirname "$0")/.."

echo "==> Applying idempotent schema SQL (Single Player + Brand Month + profile preferences)..."
npx prisma db execute --file scripts/apply-single-player-schema.sql --schema prisma/schema.prisma
npx prisma db execute --file scripts/fix-profile-preferences-schema.sql --schema prisma/schema.prisma

echo "==> Marking existing migrations as applied..."
sh scripts/baseline-prod-db.sh

echo "==> All migrations should now be in sync."
