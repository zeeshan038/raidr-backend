#!/bin/sh
# Dev stack only — run from ~/raidr-backend (same VPS as prod).
# NEVER use plain `docker compose up` here: base compose uses project raidr-backend-prod
# and prod container names — that hijacks production Postgres/API.
set -e
cd "$(dirname "$0")/.."

if [ ! -f docker-compose.dev.yml ]; then
  echo "ERROR: docker-compose.dev.yml missing — refusing deploy." >&2
  exit 1
fi

if docker compose -f docker-compose.yml -f docker-compose.dev.yml config 2>/dev/null \
  | grep -q 'container_name: raidr_api_dev'; then
  :
else
  echo "ERROR: merged compose is not the dev stack (expected raidr_api_dev)." >&2
  exit 1
fi

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.dev.yml)

# Compose sometimes leaves *_{container_name} orphans after a failed recreate — remove them.
for orphan in $("${COMPOSE[@]}" ps -a --format '{{.Names}}' 2>/dev/null); do
  case "$orphan" in
    *_raidr_api_dev|*_raidr_postgres_dev|*_raidr_redis_dev)
      docker rm -f "$orphan" 2>/dev/null || true
      ;;
  esac
done

exec "${COMPOSE[@]}" up -d --build --remove-orphans --force-recreate "$@"
