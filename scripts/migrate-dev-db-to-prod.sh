#!/usr/bin/env bash
# Copy PostgreSQL data from dev DB (raidr_db) to prod DB (raidr_prod) on the same server.
#
# Usage (from repo root, with pg_dump/pg_restore installed):
#   export SOURCE_DATABASE_URL="postgresql://USER:PASS@HOST:5432/raidr_db?schema=public"
#   export TARGET_DATABASE_URL="postgresql://USER:PASS@HOST:5432/raidr_prod?schema=public"
#   ./scripts/migrate-dev-db-to-prod.sh
#
# WARNING: Default mode REPLACES all data in the target DB. Backups are created first.

set -euo pipefail

SOURCE_URL="${SOURCE_DATABASE_URL:-}"
TARGET_URL="${TARGET_DATABASE_URL:-}"

if [[ -z "$SOURCE_URL" || -z "$TARGET_URL" ]]; then
  echo "Set SOURCE_DATABASE_URL (dev) and TARGET_DATABASE_URL (prod)." >&2
  exit 1
fi

if [[ "$SOURCE_URL" == "$TARGET_URL" ]]; then
  echo "Source and target URLs must differ." >&2
  exit 1
fi

# psql/pg_dump/pg_restore do not accept Prisma's ?schema=public query param
strip_prisma_query() {
  echo "$1" | sed 's/[?]schema=public//'
}

PG_SOURCE_URL="$(strip_prisma_query "$SOURCE_URL")"
PG_TARGET_URL="$(strip_prisma_query "$TARGET_URL")"

STAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./db-backups}"
mkdir -p "$BACKUP_DIR"

SOURCE_DUMP="$BACKUP_DIR/source_${STAMP}.dump"
TARGET_DUMP="$BACKUP_DIR/target_before_${STAMP}.dump"

echo "==> Backing up SOURCE (dev) to $SOURCE_DUMP"
pg_dump "$PG_SOURCE_URL" -Fc -f "$SOURCE_DUMP"

echo "==> Backing up TARGET (prod) before overwrite to $TARGET_DUMP"
pg_dump "$PG_TARGET_URL" -Fc -f "$TARGET_DUMP" || echo "(target backup skipped if DB empty/missing)"

echo "==> Applying Prisma migrations on TARGET"
DATABASE_URL="$TARGET_URL" npx prisma migrate deploy

echo "==> Restoring SOURCE data into TARGET (clean replace)"
pg_restore -d "$PG_TARGET_URL" --clean --if-exists --no-owner --no-acl "$SOURCE_DUMP"

echo "==> Done. Verify counts on prod, then point prod API DATABASE_URL to TARGET."
echo "    Example: SELECT count(*) FROM \"User\";"
