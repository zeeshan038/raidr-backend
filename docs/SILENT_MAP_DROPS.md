# Silent map drops (Single Player)

Reuses **`LiveEvent`** + **`LiveEventClaim`** with `displayMode: SILENT_MAP_DROP`. Multiplayer live events are unchanged (`LIVE_MULTIPLAYER` default).

## Admin / merchant

| Role | Routes |
|------|--------|
| Super Admin | `GET/POST /api/admin/single-player/silent-drops`, `PUT/DELETE .../:id` |
| Merchant | `GET/POST /api/merchant/single-player/silent-drops`, `PUT .../:id` |

**Collection methods**

- `GPS_INSTANT` — player within `collectRadiusM`, then `POST .../collect`
- `BUSINESS_QR` — `POST .../proximity` (GPS gate), open scanner, `POST .../collect-qr` with `qrCodeData` (matches `LiveEvent.qrCode` — print from admin/merchant UI)

## Mobile (Single Player map)

**Auth:** `Authorization: Bearer <user_jwt>` on all routes below.

**Do not use** multiplayer live-event APIs for these pins:

- `GET /api/events` — only `displayMode: LIVE_MULTIPLAYER`
- `POST /api/trip/live-event/claim/:eventId` — returns 400 for silent drops
- Use **only** `/api/single-player/silent-drops/*` for collect

### 1) Map discovery

`GET /api/single-player/dashboard?latitude={lat}&longitude={lng}&radiusKm={optional}`

Response includes `data.silentDrops[]` (same shape as drop detail). Only drops that are:

- `displayMode: SILENT_MAP_DROP`
- `startTime <= now`, `endTime > now`, `remainingQty > 0`
- Within discovery radius (default **50 km**, or `radiusKm` query)

### 2) My claim history

`GET /api/single-player/silent-drops/my-claims` — list of this user's silent drop claims (code, dates, drop title/reward).

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

```json
{
  "status": true,
  "msg": "success",
  "data": {
    "claimId": "…",
    "code": "A1B2C3D4",
    "xpEarned": 0,
    "coinsAwarded": 0,
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

### Client object shape (`silentDrops[]` / detail `data`)

`id`, `title`, `description`, `address`, `latitude`, `longitude`, `imageUrl`, `mapIconUrl`, `reward`, `remainingQty`, `rewardQuantity`, `startTime`, `endTime`, `status`, `displayMode`, `collectionMethod` (`GPS_INSTANT` \| `BUSINESS_QR`), `collectRadiusM`, `xpReward`, `distanceMeters`, `isClaimed`, `hasClaimed`, `claimId`.

## DB migration

```bash
# from raidr-backend
npx prisma migrate deploy
# or apply prisma/migrations/20261113120000_live_event_silent_drop/migration.sql on prod
```
