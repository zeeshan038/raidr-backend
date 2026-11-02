#!/bin/sh
# Production stack only — run from ~/raidr-backend-prod
set -e
cd "$(dirname "$0")/.."

if grep -q 'name: raidr-dev' docker-compose.yml 2>/dev/null; then
  echo "ERROR: docker-compose.yml is the DEV stack (raidr-dev)."
  echo "git pull origin main and ensure prod compose (name: raidr-prod) is present."
  exit 1
fi

exec docker compose up -d --build "$@"
