#!/bin/sh
# Mark existing migrations as applied on a legacy DB (after apply-single-player-schema.sql).
# Run inside API container:
#   docker compose exec api sh scripts/baseline-prod-db.sh
set -e
cd /app

MIGRATIONS="
0_init
20260826150459_init
20261004180000_coin_rush_winners_count
20261010120000_single_player_phase2_ownership
20261010140000_sp_guards_b2b_config
20261010180000_sp_phase2_complete
20261010200000_store_guard_products
20261012120000_sp_max_owned_zones
20261014100000_user_sp_boost_columns
20261014220000_brand_month_xp
20261015010000_drop_brand_month_milestones
20261015020000_brand_month_milestones_compat
"

for name in $MIGRATIONS; do
  echo "resolve --applied $name"
  npx prisma migrate resolve --applied "$name" 2>/dev/null || true
done

echo "Running migrate deploy..."
npx prisma migrate deploy
echo "Done."
