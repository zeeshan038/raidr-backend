#!/bin/sh
# Production stack only — run from ~/raidr-backend-prod
set -e
cd "$(dirname "$0")/.."

if grep -q 'name: raidr-dev' docker-compose.yml 2>/dev/null; then
  echo "ERROR: docker-compose.yml is the DEV stack (raidr-dev)."
  echo "git pull origin main and ensure prod compose (name: raidr-backend-prod) is present."
  exit 1
fi

# If redis/postgres already run under this project, avoid name conflicts — rebuild API only.
if docker ps --format '{{.Names}}' | grep -qx raidr_redis \
  && docker ps --format '{{.Names}}' | grep -qx raidr_postgres; then
  echo "Existing prod redis/postgres detected — rebuilding API only..."
  docker compose build api
  exec docker compose up -d --no-deps --build api
fi

exec docker compose up -d --build "$@"
