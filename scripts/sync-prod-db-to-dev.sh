#!/usr/bin/env bash
# Copy prod Postgres DB into dev Postgres (same VPS). Overwrites dev data.
# Run on server as root (or with docker access).
#
# Usage:
#   ./scripts/sync-prod-db-to-dev.sh              # raidr_db -> dev raidr_db
#   ./scripts/sync-prod-db-to-dev.sh raidr_prod   # copy raidr_prod instead
set -euo pipefail

SOURCE_DB="${1:-raidr_db}"
PROD_CONTAINER="${PROD_CONTAINER:-raidr_postgres}"
DEV_CONTAINER="${DEV_CONTAINER:-raidr_postgres_dev}"
TARGET_DB="${TARGET_DB:-raidr_db}"

if [[ "$PROD_CONTAINER" != "$DEV_CONTAINER" ]]; then
  :
else
  echo "Prod and dev container names must differ."
  exit 1
fi

DUMP="/tmp/raidr_sync_${SOURCE_DB}_$(date +%Y%m%d_%H%M%S).sql"

echo "==> Dump $SOURCE_DB from $PROD_CONTAINER"
docker exec "$PROD_CONTAINER" pg_dump -U raidr_user -d "$SOURCE_DB" --no-owner --no-acl >"$DUMP"
echo "    dump size: $(du -h "$DUMP" | cut -f1)"

echo "==> Terminate connections on dev $TARGET_DB"
docker exec "$DEV_CONTAINER" psql -U raidr_user -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();" \
  || true

echo "==> Recreate dev database $TARGET_DB"
docker exec "$DEV_CONTAINER" psql -U raidr_user -d postgres -v ON_ERROR_STOP=1 -c \
  "DROP DATABASE IF EXISTS \"$TARGET_DB\" WITH (FORCE);"
docker exec "$DEV_CONTAINER" psql -U raidr_user -d postgres -v ON_ERROR_STOP=1 -c \
  "CREATE DATABASE \"$TARGET_DB\" OWNER raidr_user;"

echo "==> Restore into dev"
docker exec -i "$DEV_CONTAINER" psql -U raidr_user -d "$TARGET_DB" -v ON_ERROR_STOP=1 <"$DUMP"

echo "==> Counts on dev $TARGET_DB"
docker exec "$DEV_CONTAINER" psql -U raidr_user -d "$TARGET_DB" -c \
  'SELECT (SELECT COUNT(*) FROM "User") AS users, (SELECT COUNT(*) FROM "Merchant") AS merchants;'

rm -f "$DUMP"
echo "==> Done. Restart dev API if needed:"
echo "    cd ~/raidr-backend && docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --no-deps api"
