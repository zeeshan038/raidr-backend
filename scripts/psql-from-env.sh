#!/bin/sh
# Run SQL against DATABASE_URL from .env (Prisma cannot run files that reference missing models).
set -e
cd "$(dirname "$0")/.."
if [ -z "$1" ]; then
  echo "Usage: sh scripts/psql-from-env.sh path/to/file.sql" >&2
  exit 1
fi
if [ ! -f "$1" ]; then
  echo "File not found: $1" >&2
  exit 1
fi
DATABASE_URL=$(node --import dotenv/config -e 'const u=process.env.DATABASE_URL; if(!u){process.exit(1)} process.stdout.write(u)')
URL="${DATABASE_URL%%\?*}"
exec psql "$URL" -v ON_ERROR_STOP=1 -f "$1"
