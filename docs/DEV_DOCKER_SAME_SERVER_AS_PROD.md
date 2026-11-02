# Dev Docker on the same server as production

| Folder | Compose command | API URL |
|--------|-----------------|--------|
| **`~/raidr-backend-prod`** | `docker compose up -d --build` | `https://backend.raidr-app.com` → **5001** |
| **`~/raidr-backend`** (dev) | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build` | **5002** |

**Do not** use the dev overlay in `raidr-backend-prod`. Prod uses root `docker-compose.yml` only.

## Dev containers & ports

| Service  | Container           | Host port |
|----------|---------------------|-----------|
| API      | `raidr_api_dev`     | **5002**  |
| WebSocket| (same)              | **3002**  |
| Postgres | `raidr_postgres_dev`| **5433**  |
| Redis    | `raidr_redis_dev`   | **6380**  |

Prod keeps: `raidr_api`, `raidr_postgres`, `raidr_redis` on **5001 / 5432 / 6379**.

## Deploy dev

```bash
cd ~/raidr-backend
git pull origin main

docker compose -f docker-compose.yml -f docker-compose.dev.yml down
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps
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

## Dev DB migration stuck (P3009)

If logs show a **failed** migration on **dev** DB:

```bash
cd ~/raidr-backend
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api sh scripts/emergency-prod-db-fix.sh
```

## Postman dev base URL

`http://188.245.72.1:5002/api`
