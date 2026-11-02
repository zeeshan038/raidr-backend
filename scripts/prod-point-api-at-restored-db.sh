#!/usr/bin/env bash
# Run on VPS in ~/raidr-backend-prod after Postgres uses volume raidr-backend_postgres_data.
# Fixes API reading empty/wrong DB (e.g. .env raidr_prod @ 188.245.72.1 → 3 users, 0 merchants).
set -euo pipefail

ROOT="${1:-$HOME/raidr-backend-prod}"
cd "$ROOT"

DB_URL='postgresql://raidr_user:raidr_password@postgres:5432/raidr_db?schema=public'

echo "==> Postgres mount"
docker inspect raidr_postgres --format '{{range .Mounts}}{{.Name}}{{"\n"}}{{end}}' | head -1

echo "==> Counts in Postgres (raidr_db)"
docker exec raidr_postgres psql -U raidr_user -d raidr_db -t -A -c 'SELECT count(*) FROM "User";'
docker exec raidr_postgres psql -U raidr_user -d raidr_db -t -A -c 'SELECT count(*) FROM "Merchant";'

if [[ -f docker-compose.prod-restored-db.yml ]]; then
  cp docker-compose.prod-restored-db.yml docker-compose.yml
elif [[ -f docker-compose.yml ]]; then
  if ! grep -q 'name: raidr-backend_postgres_data' docker-compose.yml; then
    echo "WARN: docker-compose.yml may not use external volume raidr-backend_postgres_data"
  fi
fi

# Ensure compose overrides DATABASE_URL (wins over .env)
if ! grep -q 'DATABASE_URL=postgresql://raidr_user' docker-compose.yml 2>/dev/null; then
  echo "Add DATABASE_URL under api.environment in docker-compose.yml (see docker-compose.prod-restored-db.yml)"
fi

if [[ -f .env ]]; then
  if grep -q '^DATABASE_URL=' .env; then
    sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=\"$DB_URL\"|" .env
  else
    echo "DATABASE_URL=\"$DB_URL\"" >> .env
  fi
fi

echo "==> Recreate API"
docker compose up -d api --force-recreate

sleep 3
echo "==> API DATABASE_URL"
docker exec raidr_api printenv DATABASE_URL

echo "==> API metrics (login required — counts via psql above are source of truth)"
curl -sf http://127.0.0.1:5001/check-server && echo " check-server OK"

echo "Done. Refresh admin.raidr-app.com — expect merchants/users from psql counts."
