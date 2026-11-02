# Production folder (`~/raidr-backend-prod`)

This directory serves **https://backend.raidr-app.com** (port **5001**).

## Correct `docker-compose.yml` (must look like this)

```yaml
name: raidr-prod
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
name: raidr-prod
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

You must see **`raidr_api`** on **`0.0.0.0:5001->5001`**, image/project **`raidr-prod`**.

Do **not** run:

```bash
docker compose -f docker-compose.dev.yml ...
```

Dev overlay is only for **`~/raidr-backend`**.

## `.env` database

Prod Postgres database name is **`raidr_db`** (created by compose).  
There is **no** `raidr_prod` DB unless you create it manually.

```env
DATABASE_URL="postgresql://raidr_user:raidr_password@188.245.72.1:5432/raidr_db?schema=public"
```

Inside the API container, compose sets `DATABASE_URL=...@postgres:5432/raidr_db` (same DB, via Docker network).

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
