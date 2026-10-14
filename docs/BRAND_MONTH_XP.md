# Brand Month / XP progression

## Database (legacy prod / P3005)

If `npx prisma migrate deploy` fails with **P3005** (database not empty), this project’s DB was created before Prisma migration history. Do **not** use `migrate dev` on prod.

From repo root (with working `DATABASE_URL`):

```bash
sh scripts/sync-legacy-db-migrations.sh
```

That applies `scripts/apply-single-player-schema.sql` (includes Brand Month tables), baselines all migrations, then runs `migrate deploy`.

**P1001** (`Can't reach database server at 188.245.72.1:5432`) means the host is unreachable (VPN, firewall, Postgres down). Fix connectivity first, then run the script above.

On Docker prod, see [DEPLOY_SERVER_DB_FIX.md](./DEPLOY_SERVER_DB_FIX.md).

## Overview

- Admin configures a **time-boxed campaign** (e.g. McDonald's Month): `xpTarget`, **voucher inventory** (FCFS), branding, optional `sponsoredThemeId`, and reward (INLINE or linked `CommercialVoucher`).
- Players earn **campaign XP** and **lifetime XP** from the same events (daily/rare drop collect uses config `dailyDropXpNormal` / `dailyDropXpRare`).
- First players to reach `xpTarget` while `inventoryRemaining > 0` auto-claim the prize.

## Admin

Base: `/api/admin/brand-months` (Bearer admin token)

| Method | Path | Body highlights |
|--------|------|-----------------|
| POST | `/` | `name`, `startDate`, `endDate`, `xpTarget`, `inventoryTotal`, `rewardType`, reward fields |
| GET | `/` | List campaigns |
| GET | `/:id` | One campaign |
| PUT | `/:id` | Partial update; `inventoryRemaining` optional |
| DELETE | `/:id` | Delete |

**rewardType**

- `INLINE` — requires `rewardTitle`, `rewardSponsorName`; optional `rewardRedemptionCode`, `rewardImageUrl`.
- `COMMERCIAL_VOUCHER` — requires `commercialVoucherId`; creates `UserVoucher` on claim.

**Game config** (`PUT /api/admin/single-player/config`): `dailyDropXpNormal`, `dailyDropXpRare`.

## Player

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/single-player/brand-month/active` | Progress bar + `inventoryRemaining` / `inventoryTotal` |
| GET | `/api/single-player/brand-month/history` | Past campaigns |
| GET | `/api/single-player/dashboard` | Includes `brandMonth` (same shape as active) |
| POST | `/api/single-player/daily-drop/collect` | Adds `xpAwarded`, `lifetimeXp`, `brandMonth` |

## `brandMonth` response (client)

- `campaignXp`, `xpTarget`, `progressPercent`, `inventoryRemaining`, `inventoryTotal`
- `allVouchersClaimed`, `prizeStatus`: `NONE` | `CLAIMED` | `SOLD_OUT`
- `rewardPreview`, `prize` (when claimed)

No intermediate milestone tiers on the backend — one `xpTarget` and one grand prize per campaign (matches approved product flow).
