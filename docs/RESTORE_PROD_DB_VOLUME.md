# Restore prod data (wrong Docker Postgres volume)

## Symptom

- Super Admin / `admin.raidr-app.com`: **0 merchants**, **~3 users**
- `docker exec raidr_postgres psql ... raidr_db`: **133 users**, **10 merchants**
- Postgres volume was switched to **`raidr-backend_postgres_data`** but API still uses `.env` → `raidr_prod` or `@188.245.72.1:5432`

## One command (on VPS)

```bash
cd ~/raidr-backend-prod
git fetch origin zeeshan-dev
git show origin/zeeshan-dev:scripts/prod-point-api-at-restored-db.sh > /tmp/fix.sh
chmod +x /tmp/fix.sh
/tmp/fix.sh
```

Or after pull:

```bash
cd ~/raidr-backend-prod
chmod +x scripts/prod-point-api-at-restored-db.sh
./scripts/prod-point-api-at-restored-db.sh
```

## Manual

1. `docker-compose.yml` — external volume + API env:

   ```yaml
   environment:
     - DATABASE_URL=postgresql://raidr_user:raidr_password@postgres:5432/raidr_db?schema=public
   volumes:
     postgres_data:
       external: true
       name: raidr-backend_postgres_data
   ```

2. `.env` — same `DATABASE_URL` (use `@postgres`, not `@188.245.72.1` inside Docker).

3. `docker compose up -d api --force-recreate`

4. Verify:

   ```bash
   curl -s http://127.0.0.1:5001/api/admin/dashboard/metrics -H "Authorization: Bearer TOKEN"
   ```

Backup tarball (already done): `/root/raidr-backend_postgres_data_*.tar.gz`
