# Dev Docker on the same server as production

| Folder | Compose command | API URL |
|--------|-----------------|--------|
| **`~/raidr-backend-prod`** | `docker compose up -d --build` | `https://backend.raidr-app.com` → **5001** |
| **`~/raidr-backend`** (dev) | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build` | **`http://188.245.72.1:5002/api`** (not `backend.raidr-app.com`) |

**Do not** use the dev overlay in `raidr-backend-prod`. Prod uses root `docker-compose.yml` only.

## URLs (not interchangeable)

| | Public API | DB (inside Docker) |
|--|------------|---------------------|
| **Prod** | `https://backend.raidr-app.com/api` | `@postgres:5432/raidr_prod` (set in prod `docker-compose.yml`) |
| **Dev** | `http://188.245.72.1:5002/api` | `@postgres:5432/raidr_db` in **`~/raidr-backend/.env`** |

Never point dev at `188.245.72.1:5432` in `.env` — that is **prod Postgres on the host**, not the dev container on **5433**.

**Same database name ≠ same database:** `raidr_db` on `@postgres` (dev container) is a **different volume** than `raidr_db` at `188.245.72.1:5432`. Local `npm` often uses host `:5432`; Docker dev must use `@postgres:5432/raidr_db` in `~/raidr-backend/.env`.

## Dev containers & ports

| Service  | Container           | Host port |
|----------|---------------------|-----------|
| API      | `raidr_api_dev`     | **5002**  |
| WebSocket| (same)              | **3012** (host; 3002 often used by other stacks locally) |
| Postgres | `raidr_postgres_dev`| **internal only** (`docker exec … psql`; no host **5433** in dev overlay) |
| Redis    | `raidr_redis_dev`   | **internal only** (no host port; `docker exec raidr_redis_dev redis-cli`) |

Prod keeps: `raidr_api`, `raidr_postgres`, `raidr_redis` on **5001 / 5432 / 6379**.

## Port conflicts (`Bind for 0.0.0.0:3001` / `5432 failed`)

Compose **merges** `ports` from `docker-compose.yml` + dev overlay unless dev uses `ports: !override`.  
Symptom: dev API tries **5001, 3001** (prod) **and** 5002, 3002 → clash with `raidr_api` / host Postgres.

After pull, confirm merged config shows **only** dev ports for `api`:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml config | grep -A8 'container_name: raidr_api_dev' -A6
```

## Deploy dev

```bash
cd ~/raidr-backend
git pull origin zeeshan-dev   # or main after merge

sh scripts/compose-dev-up.sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps
curl -s http://127.0.0.1:5002/check-server
```

### Container name conflict (`…_raidr_api_dev` already in use)

After a failed recreate, Docker may leave an orphan like `43e49ccaf595_raidr_api_dev`. On the server:

```bash
cd ~/raidr-backend
docker rm -f 43e49ccaf595_raidr_api_dev 2>/dev/null || true
docker rm -f raidr_api_dev 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.dev.yml down --remove-orphans
sh scripts/compose-dev-up.sh
curl -s http://127.0.0.1:5002/check-server
```

## View logs (correct container)

```bash
# Dev
docker logs raidr_api_dev --tail 80
# or
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs api --tail 80

# Prod (from prod folder)
cd ~/raidr-backend-prod
docker logs raidr_api --tail 80
docker compose logs api --tail 80
```

## Missing tables on **dev** only (e.g. `ProfilePreferenceOption`)

Work only in **`~/raidr-backend`**. Use **`raidr_postgres_dev`** + database **`raidr_db`** — not `raidr_postgres` / `raidr_prod`.

```bash
cd ~/raidr-backend
git pull origin main

# Confirm dev API + DB (must NOT be raidr_api / raidr_prod)
docker exec raidr_api_dev printenv DATABASE_URL
# expect: ...@postgres:5432/raidr_db...

docker exec -i raidr_postgres_dev psql -U raidr_user -d raidr_db \
  < scripts/fix-profile-preferences-schema.sql

docker exec raidr_api_dev npx prisma db execute \
  --file scripts/seed-profile-preference-options.sql --schema prisma/schema.prisma

docker exec raidr_postgres_dev psql -U raidr_user -d raidr_db -c \
  'SELECT COUNT(*) FROM "ProfilePreferenceOption";'
```

Test: `curl -s http://127.0.0.1:5002/check-server` and hit  
`http://188.245.72.1:5002/api/user/profile-preferences` (with auth), **not** `backend.raidr-app.com`.

After pull, rebuild dev API so entrypoint runs the same SQL on boot:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --no-deps --build api
```

## Dev DB migration stuck (P3009)

If logs show a **failed** migration on **dev** DB:

```bash
cd ~/raidr-backend
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api npm run fix:db-sp-config
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api sh scripts/baseline-prod-db.sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api npm run fix:db-sp-zone
```

`\dt "SinglePlayerZone"` on **`raidr_postgres_dev`** should list the table. If other models are still missing (Brand Month, vouchers), run once on dev:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api npx prisma db push
```

Or: `docker compose … exec api sh scripts/emergency-prod-db-fix.sh` then `npm run fix:db-sp-zone`.

## Postman dev base URL

`http://188.245.72.1:5002/api`
