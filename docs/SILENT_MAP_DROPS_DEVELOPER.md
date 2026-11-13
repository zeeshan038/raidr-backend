# Silent map drops — developer handoff

**Share this file with mobile / Flutter engineers.**

| | |
|--|--|
| **Dev API** | `http://188.245.72.1:5002/api` |
| **Prod API** | `https://backend-prod.raidr-app.com/api` (confirm before release) |
| **Auth** | `Authorization: Bearer <user_jwt>` |
| **OpenAPI** | `raidr-backend/swagger.json` (run `npm run swagger:merge-silent-drops` after pulls) |
| **Long guide** | [`SILENT_MAP_DROPS_MOBILE_DEV_GUIDE.md`](./SILENT_MAP_DROPS_MOBILE_DEV_GUIDE.md) — flows, mermaid, errors, checklist |
| **Single-player context** | [`FLUTTER_SINGLE_PLAYER_INTEGRATION.md`](./FLUTTER_SINGLE_PLAYER_INTEGRATION.md) §4.11 history |

---

## What you are building

Single-player **map pins** (not multiplayer raids). Data is `LiveEvent` + `LiveEventClaim` with `displayMode: SILENT_MAP_DROP`.

| Method | `collectionMethod` | Player UX | Payout |
|--------|-------------------|-----------|--------|
| **1 — Street coins** | `GPS_INSTANT` | Tap pin → in radius → collect | `payoutType: COINS_ONLY`, `coinsAwarded` |
| **2 — Restaurant QR** | `BUSINESS_QR` | Tap → GPS verify → scan printed QR | `payoutType: PARTNER_REWARD`, show `code` at counter |

**Do not use:** `GET /events`, `POST /trip/live-event/claim/:eventId` for these pins.

---

## Endpoints (all under `{BASE_URL}`)

| Method | Path | Use |
|--------|------|-----|
| `GET` | `/single-player/dashboard?latitude=&longitude=&radiusKm=` | Live map pins → `data.silentDrops[]` |
| `GET` | `/single-player/silent-drops/:id?latitude=&longitude=` | Pin detail after tap |
| `GET` | `/single-player/history` | Bundle: `dailyDrops`, `rareDrops`, `raidZones`, **`silentDrops`** |
| `GET` | `/single-player/history?type=silentDrops` | Claim history only |
| `GET` | `/single-player/silent-drops/my-claims` | Same as `?type=silentDrops` (legacy) |
| `POST` | `/single-player/silent-drops/:id/collect` | **GPS only** — body `{ latitude, longitude }` |
| `POST` | `/single-player/silent-drops/:id/proximity` | **QR step 1** — arms scanner 20 min |
| `POST` | `/single-player/silent-drops/:id/collect-qr` | **QR step 2** — `{ qrCodeData, latitude?, longitude? }` |

---

## Three response shapes (do not mix them)

### A) Dashboard pin — `data.silentDrops[]` (`SilentMapDropMapPin`)

Slim pin for the map layer. **Not** full detail.

```json
{
  "type": "SILENT_DROP_GPS",
  "id": "uuid",
  "title": "Park coins",
  "latitude": 33.566,
  "longitude": 73.153,
  "mapIconUrl": "https://…",
  "distanceMeters": 80,
  "hasClaimed": false,
  "coinReward": 50
}
```

`type` is `SILENT_DROP_GPS` or `SILENT_DROP_QR`. `coinReward` only on GPS pins.

**Also on same dashboard call:** `dailyDrop` (`DAILY_DROP` \| `DAILY_DROP_RARE`), `zones[]` with top-level `type` `NORMAL` \| `B2B`.

### B) Detail — `GET /single-player/silent-drops/:id` (`SilentMapDropClient`)

Full fields: `description`, `address`, `reward`, `collectRadiusM`, `collectionMethod`, `payoutType`, `remainingQty`, `hasClaimed`, `claimId`, etc. **No** `qrCode` / `couponCode` on mobile.

Branch UI on `collectionMethod`:

- `GPS_INSTANT` → single **Collect** when inside `collectRadiusM`
- `BUSINESS_QR` → **Verify location** then QR scanner (never call `/collect`)

### C) History — `data.silentDrops[]` or `?type=silentDrops` (`SilentDropMyClaimItem`)

Past claims for profile / activity tab.

**QR row**

```json
{
  "type": "SILENT_DROP_QR",
  "claimId": "uuid",
  "code": "A1B2C3D4",
  "xpEarned": 200,
  "coinsAwarded": null,
  "payoutType": "PARTNER_REWARD",
  "isRedeemed": true,
  "claimedAt": "2026-11-13T12:00:00.000Z",
  "drop": { "title": "KFC", "collectionMethod": "BUSINESS_QR", "reward": "…" }
}
```

**GPS row**

```json
{
  "type": "SILENT_DROP_GPS",
  "claimId": "uuid",
  "code": null,
  "xpEarned": 0,
  "coinsAwarded": 50,
  "payoutType": "COINS_ONLY",
  "claimedAt": "2026-11-12T08:30:00.000Z",
  "drop": { "title": "Park coins", "collectionMethod": "GPS_INSTANT", "coinReward": 50 }
}
```

---

## Client flow (decision tree)

```
Load map → GET /single-player/dashboard (lat/lng)
  → render data.silentDrops[] (separate layer from zones / daily drop)

Tap pin → GET /single-player/silent-drops/:id

If hasClaimed → show history / code; stop

If collectionMethod == GPS_INSTANT
  → user in collectRadiusM → POST …/collect { lat, lng }
  → celebrate coins (coinsAwarded)

If collectionMethod == BUSINESS_QR
  → user in collectRadiusM → POST …/proximity { lat, lng }
  → if openQrScanner → scan printed QR
  → POST …/collect-qr { qrCodeData, lat?, lng? }
  → show code at counter

History tab → GET /single-player/history?type=silentDrops
  (or GET /single-player/history for full bundle)
```

---

## Collect success `data` (typical)

| Field | GPS | QR |
|-------|-----|-----|
| `payoutType` | `COINS_ONLY` | `PARTNER_REWARD` |
| `coinsAwarded` | set | may be 0+ from economy |
| `code` | optional | **show to staff** |
| `xpEarned` | usually `0` | event XP |

---

## Errors to handle (`status: false`)

| `msg` (match) | Action |
|---------------|--------|
| `alreadyClaimed` | Refresh detail / history |
| `soldOut` | Hide or grey pin |
| `Too far from drop` | Show distance vs `collectRadiusM` |
| `This drop requires in-store QR` | Use proximity + collect-qr |
| `Complete GPS verification before scanning` | Call `/proximity` first |
| `Invalid QR Code scanned` | Retry scan |
| `Silent drop not found` | Refresh dashboard |

See full table in [`SILENT_MAP_DROPS_MOBILE_DEV_GUIDE.md`](./SILENT_MAP_DROPS_MOBILE_DEV_GUIDE.md) §7.

---

## Smoke test (curl)

```bash
BASE=http://188.245.72.1:5002/api
AUTH="Authorization: Bearer YOUR_USER_JWT"

# Pins near player
curl -sS -H "$AUTH" "$BASE/single-player/dashboard?latitude=33.68&longitude=73.05" \
  | jq '.data | {silentDrops: .silentDrops|length, dailyDrop: .dailyDrop.type, zones: .zones|length}'

# History
curl -sS -H "$AUTH" "$BASE/single-player/history?type=silentDrops" | jq '.data[0]'
```

---

## Swagger schemas (import into client generators)

| Schema | When |
|--------|------|
| `SilentMapDropMapPin` | Dashboard `silentDrops[]` |
| `SilentMapDropClient` | Detail endpoint |
| `SilentDropMyClaimItem` | History / my-claims |
| `SinglePlayerHistoryBundle` | `GET /single-player/history` without `type` |

Paths tagged **Single Player** in `swagger.json`.

---

## Backend deploy note (for your timeline)

Dev backend on branch `zeeshan-dev` auto-deploys to **`188.245.72.1:5002`**. If pins are empty, confirm admin created live drops in window with `remainingQty > 0` and player is within discovery radius (`radiusKm`, default 50 km).

**Questions:** backend team · internal summary [`SILENT_MAP_DROPS.md`](./SILENT_MAP_DROPS.md)
