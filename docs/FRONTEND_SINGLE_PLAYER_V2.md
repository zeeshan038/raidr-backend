# Single Player V2 — Frontend API handover (screens 1–10)

> **Flutter / Cursor:** For the full per-API request/response reference, flows, and integration checklist, use **[FLUTTER_SINGLE_PLAYER_INTEGRATION.md](./FLUTTER_SINGLE_PLAYER_INTEGRATION.md)**.

Base URL: `/api` (Bearer user token unless noted).

## Screen → endpoints0

| # | Screen | Endpoints |
|---|--------|-----------|
| 1 | Main map | `GET /single-player/dashboard?latitude=&longitude=` or `GET /single-player/zones` |
| 2 | Your zone detail | `GET /single-player/zones/:id` (or zone from list) |
| 3 | Manage guards | `GET /single-player/guards/inventory`, `POST .../zones/:id/guards/assign`, `POST .../guards/unassign` |
| 4 | Enemy zone detail | Same zone object (`status: conquered_by_others`) |
| 5 | Snatch / hold capture | `POST .../zones/:id/capture/start`, `ping`, `complete` |
| 6 | AR eliminate guard | `POST .../zones/:id/capture/eliminate-guards` `{ "count": 1 }` |
| 7 | Store guards | `GET /store/all-items?itemType=GUARD`, `POST /store/purchase` |
| 8 | B2B zone detail | Zone + `zoneType: B2B`, `b2b.*`, `meetsEligibility` |
| 9 | B2B owned / hold progress | `b2b.hold`, `POST .../zones/:id/b2b/claim` when `b2b.canClaim` |
| 10 | My raid zones | `GET /single-player/zones?status=available\|conquered_by_me\|conquered_by_others` |

## Map pins (`mapPinType`)

Returned on every formatted zone (list, dashboard, detail):

| Value | Meaning |
|-------|---------|
| `YOUR_ZONE` | You own it |
| `NEUTRAL` | Unclaimed |
| `B2B` | Branded zone (any owner) |
| `VULNERABLE` | Owned by others, shield down (`isAttackable`) |
| `ENEMY_SHIELDED` | Owned by others, shield up |

## Zone detail fields (screens 2, 4, 8, 9)

- **Shield countdown:** `isShieldActive`, `shieldExpiresAt`
- **Held duration:** `ownedAt` (client formats e.g. `2d 7h`)
- **Guards:** `guardCount` / `maxGuardsPerZone`
- **Defense bonus (your zone):** `defenseBonusSec` or sum of `captureTimeBreakdown.ownershipDefenseSec + guardPenaltySec`
- **Est. capture time (enemy):** `captureTimeSec`, `captureTimeBreakdown`
- **Passive income:** `coinsPerHour`; map aggregate: `dashboard.passiveIncomePerHour`
- **Ownership cap (map “2/5”):** `dashboard.ownedZonesCount` and `dashboard.maxOwnedZonesPerPlayer` (null = unlimited until admin sets cap)
- **B2B hold:** `b2b.hold.progressPercent`, `holdRemainingSeconds`, `holdElapsedHours`, `holdDurationHours`, `holdComplete`, `canClaim`

## Capture start (screen 5)

`POST /single-player/zones/:id/capture/start` body: `{ latitude, longitude }`

Response includes:

- `captureTimeSec`, `captureTimeBreakdown`, `distanceMeters`
- `startedAt`, `completesAfter`

403 when B2B `minOwnedZonesRequired` not met or `maxOwnedZonesPerPlayer` cap reached.

## Guards (screen 7)

**Preferred:** Store SKUs — `GET /store/all-items?itemType=GUARD`, `POST /store/purchase` with `storeItemId` + `quantity`.

**Removed:** `POST /single-player/guards/purchase` returns **410 Gone** — use Store only.

## Merchant B2B (pending edits)

`PUT /merchant/single-player/b2b-zones/:id` — update a **pending** zone only (same body fields as create, partial OK).

## Zone ownership cap

Default **5** zones per player (`maxOwnedZonesPerPlayer`). Admin can set `null` via `PUT /admin/single-player/config` for unlimited.

## Notifications (settings screen)

`GET/PATCH /user/notification-preferences` — respects `eventsCoinRush`, `rareDropAlerts`, etc. Coin Rush cron and rare drop spawn use these prefs.

## Refresh single zone

`GET /single-player/zones/:id`

Optional query `latitude` & `longitude`: for zones you do not own, enforces same map visibility as discovery. Owned zones always return.

## Config

`GET /single-player/game-config` — capture timers, guard limits, prices, `maxOwnedZonesPerPlayer`.

## AR (screen 6)

No camera API; use active capture session + eliminate-guards. Price from `guardEliminationCoinPrice` in game-config / guards inventory.
