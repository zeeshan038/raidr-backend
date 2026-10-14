# Production server — DB P3005 / login `spGuardInventory` fix

## Symptoms
- Flutter login **500**: column `User.spGuardInventory` does not exist
- `docker compose logs api`: **P3005** (database not empty, no migration baseline)
- API container **Restarting** (old entrypoint exited on failed `migrate deploy`)

## Quick fix (SSH on server)

```bash
cd ~/raidr-backend
git pull origin main
docker compose stop api

# Bypass entrypoint (avoids crash loop)
docker compose run --rm --no-deps --entrypoint sh api scripts/emergency-prod-db-fix.sh

docker compose up -d --build
docker compose logs api --tail 30
```

If `emergency-prod-db-fix.sh` is not on the server yet, minimal SQL:

```bash
docker compose exec postgres psql -U raidr_user -d raidr_db -c \
'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "spGuardInventory" INTEGER NOT NULL DEFAULT 0;
 ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coinBoostMultiplier" DOUBLE PRECISION DEFAULT 1.0;
 ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coinBoostExpiresAt" TIMESTAMP(3);'

# Start API without migrate-only entrypoint until you pull latest image:
docker compose run -d --name raidr_api_fix --service-ports --no-deps \
  --entrypoint "node" api index.js
# OR after pull: docker compose up -d --build
```

## Local Mac against remote DB (P3005)

```bash
# Ensure .env DATABASE_URL reaches the server (VPN / firewall open on 5432)
sh scripts/sync-legacy-db-migrations.sh
npm run server
```

## After fix
- `DATABASE_URL` in **docker-compose** should be `@postgres:5432` (not `188.245.72.1` inside containers).
- New images run schema SQL + non-fatal migrate in `docker-entrypoint.sh`.
- Brand Month tables are included in `scripts/apply-single-player-schema.sql`; baseline list includes `20261014220000_brand_month_xp`.
