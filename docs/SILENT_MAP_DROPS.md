# Silent map drops (Single Player)

**Handoff for mobile devs:** [`SILENT_MAP_DROPS_MOBILE_DEV_GUIDE.md`](./SILENT_MAP_DROPS_MOBILE_DEV_GUIDE.md) — endpoints, flows, errors, and env URLs.

Reuses **`LiveEvent`** + **`LiveEventClaim`** with `displayMode: SILENT_MAP_DROP`. Multiplayer live events are unchanged (`LIVE_MULTIPLAYER` default).

## Admin / merchant

| Role | Routes | Collection methods |
|------|--------|-------------------|
| Super Admin | `GET/POST /api/admin/single-player/silent-drops`, `PUT/DELETE .../:id` | **Method 1** — no restaurant (`merchantId` null). **Method 2** — pick restaurant (`merchantId` required). |
| Merchant | `GET/POST /api/merchant/single-player/silent-drops`, `PUT .../:id` | **Method 2 only** (GPS gate + cashier QR) — API forces `BUSINESS_QR` |

**Collection methods** (admin / merchant picks one at create)

| Method | `collectionMethod` | Payout | Mobile flow |
|--------|-------------------|--------|-------------|
| **1 — Street / park** | `GPS_INSTANT` | **Coins only** — admin sets **`coinReward`** → `awardRaidrCoins` → user wallet | Tap pin → in radius → `POST .../collect` |
| **2 — Restaurant partner** | `BUSINESS_QR` | Partner reward + claim code (`PARTNER_REWARD`) | Tap pin → `POST .../proximity` → QR scanner → `POST .../collect-qr` |

Method 2 matches the demo flow: **Tap map icon → verify GPS → open QR scanner → scan to claim.** Printed QR = `LiveEvent.qrCode` (admin/merchant print UI only). Staff-facing **`couponCode`** (e.g. `RDR-A1B2C3D4`) is auto-generated on create for restaurant silent drops only — shown on print/detail, **not** sent on mobile map APIs. Live multiplayer raids do not use `couponCode`.

## Mobile (Single Player map)

**Auth:** `Authorization: Bearer <user_jwt>` on all routes below.

**Do not use** multiplayer live-event APIs for these pins:

- `GET /api/events` — only `displayMode: LIVE_MULTIPLAYER`
- `POST /api/trip/live-event/claim/:eventId` — returns 400 for silent drops
- Use **only** `/api/single-player/silent-drops/*` for collect

### 1) Map discovery

`GET /api/single-player/dashboard?latitude={lat}&longitude={lng}&radiusKm={optional}`

Response includes **`data.silentDrops[]`** — **slim map pins** (`type`, `id`, `title`, coords, `mapIconUrl`, `distanceMeters`, `hasClaimed`, optional `coinReward`). Tap → detail endpoint below. Only drops that are:

- `displayMode: SILENT_MAP_DROP`
- `startTime <= now`, `endTime > now`, `remainingQty > 0`
- Within discovery radius (default **50 km**, or `radiusKm` query)

### 2) My claim history

Use the **same history API** as daily / rare drops and raid zones:

| Call | `data` shape |
|------|----------------|
| `GET /api/single-player/history` | `{ dailyDrops, rareDrops, raidZones, silentDrops }` |
| `GET /api/single-player/history?type=silentDrops` | `SilentDropMyClaimItem[]` only |

Legacy alias: **`GET /api/single-player/silent-drops/my-claims`** — identical items to `type=silentDrops`.

Each history row: `type` (`SILENT_DROP_GPS` \| `SILENT_DROP_QR`), `payoutType`, `claimId`, `claimedAt`, nested `drop` (title, `collectionMethod`, etc.). GPS rows include `coinsAwarded`; QR rows include partner `code`.

### 3) Drop detail

`GET /api/single-player/silent-drops/:id?latitude={lat}&longitude={lng}`

Optional query coords fill `distanceMeters` and help UI show in/out of `collectRadiusM`.

### 4) Collection flows

| `collectionMethod` | Mobile flow |
|--------------------|-------------|
| `GPS_INSTANT` | When user is within `collectRadiusM` → `POST .../collect` |
| `BUSINESS_QR` | Within radius → `POST .../proximity` (arms **20 min**) → scan merchant QR → `POST .../collect-qr` |

**GPS_INSTANT**

`POST /api/single-player/silent-drops/:id/collect`

```json
{ "latitude": 33.6844, "longitude": 73.0479 }
```

**BUSINESS_QR — step A (GPS gate)**

`POST /api/single-player/silent-drops/:id/proximity` — same body as collect.

Success: `data.armed: true`, `data.expiresAt`, `data.openQrScanner: true`.

**BUSINESS_QR — step B (scan)**

`POST /api/single-player/silent-drops/:id/collect-qr`

```json
{ "qrCodeData": "<scanned payload>", "latitude": 33.68, "longitude": 73.04 }
```

`latitude`/`longitude` optional if proximity was armed within TTL. QR payload must match server `LiveEvent.qrCode` (printed in admin/merchant; **never** sent in list/detail APIs).

### Success response (collect / collect-qr)

**GPS_INSTANT:** `payoutType: "COINS_ONLY"`, `coinsAwarded` set, `xpEarned` typically `0`.

**BUSINESS_QR:** `payoutType: "PARTNER_REWARD"`, show `code` at counter, optional bonus `coinsAwarded` from economy.

```json
{
  "status": true,
  "msg": "success",
  "data": {
    "claimId": "…",
    "code": "A1B2C3D4",
    "xpEarned": 200,
    "coinsAwarded": 0,
    "payoutType": "PARTNER_REWARD",
    "isRedeemed": true
  }
}
```

### Common errors (`status: false`, `msg`)

| msg | Meaning |
|-----|---------|
| `alreadyClaimed` | One claim per user per drop |
| `soldOut` | `remainingQty` is 0 |
| `Too far from drop…` | Outside `collectRadiusM` |
| `This drop requires in-store QR…` | Called `/collect` on `BUSINESS_QR` drop |
| `Complete GPS verification before scanning…` | QR scan without proximity arm |
| `Invalid QR Code scanned for this drop` | Wrong QR |

Claims also appear in `GET /api/rewards/all` under `events` (with `event.displayMode`).

### Client object shapes (OpenAPI: `swagger.json` after `npm run swagger:merge-silent-drops`)

| Surface | Schema | Key fields |
|---------|--------|------------|
| Dashboard `silentDrops[]` | `SilentMapDropMapPin` | `type`, `id`, `title`, lat/lng, `mapIconUrl`, `distanceMeters`, `hasClaimed`, `coinReward?` |
| Detail `GET …/silent-drops/:id` | `SilentMapDropClient` | Above + `description`, `reward`, `collectRadiusM`, `collectionMethod`, `payoutType`, stock, times |
| History `silentDrops[]` | `SilentDropMyClaimItem` | `type`, `payoutType`, `coinsAwarded?`, `code?`, `claimedAt`, nested `drop` |

## DB migration

```bash
# from raidr-backend
npx prisma migrate deploy
# or apply prisma/migrations/20261113120000_live_event_silent_drop/migration.sql on prod
```

**Dev on VPS (`~/raidr-backend`, compose dev stack):** API uses `raidr_postgres_dev`, not host `.env` `DATABASE_URL` at `188.245.72.1:5432`. Apply SQL inside the dev container:

```bash
docker exec -i raidr_postgres_dev psql -U raidr_user -d raidr_db -v ON_ERROR_STOP=1 \
  < prisma/migrations/20261113120000_live_event_silent_drop/migration.sql

docker exec -i raidr_postgres_dev psql -U raidr_user -d raidr_db -v ON_ERROR_STOP=1 \
  < prisma/migrations/20261114123000_live_event_coin_reward/migration.sql

docker exec -i raidr_postgres_dev psql -U raidr_user -d raidr_db -v ON_ERROR_STOP=1 \
  < prisma/migrations/20261114130000_live_event_optional_merchant/migration.sql
```
