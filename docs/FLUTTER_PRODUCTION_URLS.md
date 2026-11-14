# Flutter production URLs (fix WS + 504)

**Use these in production builds** — not `backend-prod.raidr-app.com` unless DevOps adds a matching nginx `server_name`.

| Purpose | URL |
|--------|-----|
| REST API | `https://backend.raidr-app.com/api` |
| WebSocket | `wss://backend.raidr-app.com/live-tracking?token={JWT}` |

- Path is **`/live-tracking`** (no `/api` prefix).
- Scheme **`wss://`** for WS, not `https://`.

## Symptoms when wrong host is used

- `All host candidates failed` for `wss://backend-prod.raidr-app.com`
- HTTP **504 Gateway Time-out** (nginx) on API calls — wrong upstream or API hung (often Redis on silent-drop `/proximity`).

## Prod server checks (VPS)

```bash
cd ~/raidr-backend-prod
docker ps --filter name=raidr_api
docker ps --filter name=raidr_redis
docker exec raidr_api printenv REDIS_URL   # must be redis://redis:6379
docker exec raidr_api sh -c 'redis-cli -u "$REDIS_URL" ping'  # PONG (if redis-cli in image)
```

In prod `.env`, do **not** set `REDIS_URL=redis://localhost:6379` for Docker — compose overrides to `redis://redis:6379` in `docker-compose.yml`.

## Nginx for `backend-prod.raidr-app.com`

Full working example: **`docs/NGINX_BACKEND_PROD.conf.example`** (`/live-tracking` → 3001, `/api/` → 5001).

On VPS after a bad edit:

```bash
sudo cp /etc/nginx/sites-enabled/raidr-backend-prod /etc/nginx/sites-enabled/raidr-backend-prod.bak
# paste file from repo example, then:
sudo nginx -t && sudo systemctl reload nginx
```

`unexpected end of file, expecting "}"` = missing `}` — replace whole file; do not leave duplicate `location /` blocks.