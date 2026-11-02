# Production folder (`~/raidr-backend-prod`)

This directory serves **https://backend.raidr-app.com** (port **5001**).

## Correct `docker-compose.yml` (must look like this)

```yaml
name: raidr-backend-prod
# container_name: raidr_api, raidr_postgres, raidr_redis
# ports: 5001, 5432, 6379
```

**Wrong for prod** (dev-only — never use in this folder):

```yaml
name: raidr-dev
container_name: raidr_api_dev
```

After `git pull`, verify:

```bash
cd ~/raidr-backend-prod
grep -E "^name:|container_name" docker-compose.yml | head -5
```

Expected:

```text
name: raidr-backend-prod
    container_name: raidr_api
    container_name: raidr_postgres
    container_name: raidr_redis
```

## Deploy / restart prod

```bash
cd ~/raidr-backend-prod
git pull origin main

docker compose up -d --build
docker ps --filter name=raidr_api
```

You must see **`raidr_api`** on **`0.0.0.0:5001->5001`**.

## `raidr_redis` already in use (name conflict)

This happens when **`raidr_redis` / `raidr_postgres` are already running** and Compose tries to create them again (often after renaming the compose project).

**Do not** `docker rm raidr_redis` if prod is live. Rebuild **API only**:

```bash
cd ~/raidr-backend-prod
docker compose build api
docker compose up -d --no-deps --build api
docker ps --filter name=raidr_api
```

Or use `sh scripts/compose-prod-up.sh` (detects existing redis/postgres).

Ensure compose project name is **`raidr-backend-prod`** (same as before), not `raidr-prod` or `raidr-dev`.

Do **not** run:

```bash
docker compose -f docker-compose.dev.yml ...
```

Dev overlay is only for **`~/raidr-backend`**.

## `.env` database (must match what exists in Postgres)

The API reads **`DATABASE_URL` from `.env`**. Compose no longer overrides it.

Recommended for Docker on the same server (prod API container → prod Postgres container):

```env
DATABASE_URL="postgresql://raidr_user:raidr_password@postgres:5432/raidr_prod?schema=public"
```

Using `@188.245.72.1:5432` also works from inside the container (host port **5432** → `raidr_postgres`).

**Create the database if missing:**

```bash
docker exec raidr_postgres psql -U raidr_user -d postgres -c "CREATE DATABASE raidr_prod OWNER raidr_user;"
```

Then apply User column fixes on **`raidr_prod`**, not only `raidr_db`:

```bash
docker exec raidr_postgres psql -U raidr_user -d raidr_prod -c \
'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coinBoostMultiplier" DOUBLE PRECISION DEFAULT 1.0;
 ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coinBoostExpiresAt" TIMESTAMP(3);
 ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "spGuardInventory" INTEGER NOT NULL DEFAULT 0;
 ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferencesCompleted" BOOLEAN NOT NULL DEFAULT false;'
```

After changing `.env` or compose, recreate API:

```bash
docker compose up -d --no-deps --force-recreate api
docker exec raidr_api printenv DATABASE_URL
```

## If prod folder still had dev compose (one-time cleanup)

If you accidentally ran dev compose from prod and have both stacks:

```bash
# Prod only — from ~/raidr-backend-prod after fixing docker-compose.yml
docker compose up -d --build

# Dev — only from ~/raidr-backend
cd ~/raidr-backend
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Never `docker compose down -v` on prod (deletes DB volume).

## Login / schema fixes

See [DEPLOY_SERVER_DB_FIX.md](./DEPLOY_SERVER_DB_FIX.md).
