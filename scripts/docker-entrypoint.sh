#!/bin/sh
set -e
cd /app
echo "[entrypoint] Applying Prisma migrations..."
npx prisma migrate deploy
echo "[entrypoint] Starting API..."
exec npm start
