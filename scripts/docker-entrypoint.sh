#!/bin/sh
cd /app

echo "[entrypoint] User model columns (login-safe)..."
npx prisma db execute --file scripts/fix-user-model-columns.sql --schema prisma/schema.prisma || true

echo "[entrypoint] Referral tables/columns (if missing)..."
npx prisma db execute --file prisma/migrations/20261102140000_referral_invite_module/migration.sql --schema prisma/schema.prisma || true

echo "[entrypoint] Profile preferences tables (login/onboarding)..."
npx prisma db execute --file scripts/fix-profile-preferences-schema.sql --schema prisma/schema.prisma || true

echo "[entrypoint] Idempotent Single Player schema SQL..."
npx prisma db execute --file scripts/apply-single-player-schema.sql --schema prisma/schema.prisma || true

echo "[entrypoint] Silent map drop columns (idempotent)..."
npx prisma db execute --file prisma/migrations/20261113120000_live_event_silent_drop/migration.sql --schema prisma/schema.prisma || true
npx prisma db execute --file prisma/migrations/20261114123000_live_event_coin_reward/migration.sql --schema prisma/schema.prisma || true
npx prisma db execute --file prisma/migrations/20261114130000_live_event_optional_merchant/migration.sql --schema prisma/schema.prisma || true
npx prisma db execute --file prisma/migrations/20261114140000_live_event_silent_coupon/migration.sql --schema prisma/schema.prisma || true

echo "[entrypoint] Prisma migrate deploy..."
if npx prisma migrate deploy; then
  echo "[entrypoint] Migrations up to date."
else
  echo "[entrypoint] WARN: migrate deploy failed (legacy DB P3005?)."
  echo "[entrypoint] After first boot, run: docker compose exec api sh scripts/baseline-prod-db.sh"
fi

echo "[entrypoint] Starting API..."
exec npm start
