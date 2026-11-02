# Dev Docker on the same server as production

Production lives in **`~/raidr-backend-prod`** (containers: `raidr_api`, `raidr_redis`, `raidr_postgres`, port **5001**).

Development lives in **`~/raidr-backend`** with a separate Compose project **`raidr-dev`**:

| Service  | Dev container name      | Host port → container |
|----------|-------------------------|------------------------|
| API      | `raidr_api_dev`         | **5002** → 5001        |
| WebSocket| (same api container)    | **3002** → 3001        |
| Postgres | `raidr_postgres_dev`    | **5433** → 5432        |
| Redis    | `raidr_redis_dev`       | **6380** → 6379        |

Prod is **not** modified. Dev has its **own DB volume** (empty on first `up`; run migrations via entrypoint).

## Deploy dev on the server

```bash
cd ~/raidr-backend
git pull origin zeeshan-dev   # or your dev branch

docker compose down
docker compose up -d --build
docker compose ps
docker compose logs api --tail 80
```

## Test dev API

```bash
curl -s http://127.0.0.1:5002/check-server
# Postman base URL: http://188.245.72.1:5002/api
```

## Optional: backfill invite codes (dev DB)

```bash
docker compose exec api npm run backfill:invite-codes
```

## If you still see name conflicts

Old containers from before this split:

```bash
docker ps -a | grep raidr
# Remove only *_dev* orphans, never prod names without confirming:
# docker rm -f raidr_api_dev raidr_redis_dev raidr_postgres_dev
```
