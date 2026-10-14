#!/bin/sh
# One-shot fix for legacy prod DB (P3005) + missing Single Player columns.
# Run on server from repo root:
#   docker compose run --rm --no-deps --entrypoint sh api scripts/emergency-prod-db-fix.sh
set -e
cd "$(dirname "$0")/.."

echo "==> DATABASE_URL=${DATABASE_URL:-not set}"

echo "==> Applying idempotent schema SQL..."
npx prisma db execute --file scripts/apply-single-player-schema.sql --schema prisma/schema.prisma || true

echo "==> Baselining migration history..."
for name in \
  0_init \
  20260826150459_init \
  20261004180000_coin_rush_winners_count \
  20261010120000_single_player_phase2_ownership \
  20261010140000_sp_guards_b2b_config \
  20261010180000_sp_phase2_complete \
  20261010200000_store_guard_products \
  20261012120000_sp_max_owned_zones \
  20261014100000_user_sp_boost_columns \
  20261014220000_brand_month_xp \
  20261015010000_drop_brand_month_milestones \
  20261015020000_brand_month_milestones_compat
do
  npx prisma migrate resolve --applied "$name" 2>/dev/null || true
done

echo "==> migrate deploy..."
npx prisma migrate deploy || true

echo "==> Done. Restart API: docker compose up -d api"
