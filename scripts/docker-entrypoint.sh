#!/bin/sh
cd /app

echo "[entrypoint] Idempotent Single Player schema SQL..."
if npx prisma db execute --file scripts/apply-single-player-schema.sql --schema prisma/schema.prisma \
  && npx prisma db execute --file scripts/fix-profile-preferences-schema.sql --schema prisma/schema.prisma; then
  echo "[entrypoint] Schema SQL applied."
else
  echo "[entrypoint] WARN: schema SQL had errors (may be partial); continuing."
fi

echo "[entrypoint] Prisma migrate deploy..."
if npx prisma migrate deploy; then
  echo "[entrypoint] Migrations up to date."
else
  echo "[entrypoint] WARN: migrate deploy failed (legacy DB P3005?)."
  echo "[entrypoint] After first boot, run: docker compose exec api sh scripts/baseline-prod-db.sh"
fi

echo "[entrypoint] Starting API..."
exec npm start
