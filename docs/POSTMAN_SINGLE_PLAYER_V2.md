# Postman — Single Player V2 (full module test)

Use this doc in Postman (or share with frontend). All paths are under **`/api`**.

**Flutter developers:** use **[FLUTTER_SINGLE_PLAYER_INTEGRATION.md](./FLUTTER_SINGLE_PLAYER_INTEGRATION.md)** for exhaustive API contracts (paste into Cursor).

---

## 0) Postman environment

Create an environment with:

| Variable | Example | Notes |
|----------|---------|--------|
| `baseUrl` | `http://localhost:3000/api` | Change for staging/prod |
| `adminToken` | *(from login)* | |
| `merchantToken` | *(from login)* | |
| `userToken` | *(from login)* | |
| `zoneId` | *(from create/list)* | Normal zone UUID |
| `b2bZoneId` | *(from merchant create)* | B2B zone UUID |
| `storeGuardId` | *(from store list)* | GUARD SKU id |
| `claimId` | *(from b2b claim)* | |

**Auth header (almost all routes below):**

```
Authorization: Bearer {{userToken}}
```

Use `{{adminToken}}` or `{{merchantToken}}` where noted.

**Content-Type for POST/PUT/PATCH with body:**

```
Content-Type: application/json
```

**Prerequisites:** PostgreSQL migrated, **Redis running** (required for capture start/ping/complete/eliminate-guards).

**Swagger UI:** `http://localhost:3000/api-docs` (if enabled in your `index.js`).

---

## 1) Login (get tokens)

### Admin

`POST {{baseUrl}}/admin/login`

```json
{
  "email": "admin@example.com",
  "password": "your-password"
}
```

Save `token` → `adminToken`.

---

### Merchant

`POST {{baseUrl}}/merchant/login`

```json
{
  "email": "merchant@example.com",
  "password": "your-password"
}
```

Save `token` → `merchantToken`.

---

### User (mobile player)

`POST {{baseUrl}}/user/login`

```json
{
  "email": "player@example.com",
  "password": "your-password"
}
```

Save `token` → `userToken`.

---

## 2) Admin setup (zones, config, guards in store)

Header: `Authorization: Bearer {{adminToken}}`

### Get / update game config

`GET {{baseUrl}}/admin/single-player/config`

`PUT {{baseUrl}}/admin/single-player/config`

```json
{
  "baseCaptureTimeSec": 30,
  "secondsPerGuard": 30,
  "maxGuardsPerZone": 5,
  "maxOwnedZonesPerPlayer": 5,
  "guardEliminationCoinPrice": 50,
  "empireVipMinOwnedZones": 5
}
```

Set `"maxOwnedZonesPerPlayer": null` for unlimited ownership cap.

---

### Create normal raid zone

`POST {{baseUrl}}/admin/single-player/create`

```json
{
  "name": "Postman Test Zone",
  "latitude": 40.7829,
  "longitude": -73.9654,
  "radius": 80,
  "coinsPerHour": 30,
  "city": "New York",
  "country": "US",
  "isActive": true
}
```

Copy `data.id` → `zoneId`.

---

### List zones (admin)

`GET {{baseUrl}}/admin/single-player/zones?page=1&limit=20`

---

### Create guard product (Store)

`POST {{baseUrl}}/admin/store/create-guard`

```json
{
  "name": "RAIDR Guard",
  "frontUrl": "https://example.com/guard-front.png",
  "backUrl": "https://example.com/guard-back.png",
  "price": 50,
  "guardsPerPurchase": 1,
  "isStoreActive": true,
  "isFeatured": true,
  "isNew": true
}
```

---

### B2B moderation

`GET {{baseUrl}}/admin/single-player/b2b/pending`

`POST {{baseUrl}}/admin/single-player/b2b/{{b2bZoneId}}/approve`

`POST {{baseUrl}}/admin/single-player/b2b/{{b2bZoneId}}/reject`

(No body required for approve/reject.)

Optional AI draft:

`POST {{baseUrl}}/admin/single-player/b2b/ai-draft`

```json
{
  "prompt": "McDonald's meal voucher campaign in downtown NYC, 72 hour hold"
}
```

---

## 3) Merchant B2B flow

Header: `Authorization: Bearer {{merchantToken}}`

### AI draft (optional)

`POST {{baseUrl}}/merchant/single-player/b2b-zones/ai-draft`

```json
{
  "prompt": "KFC branded zone with physical meal voucher, 72h hold, 50 coins per hour"
}
```

---

### Submit B2B zone

`POST {{baseUrl}}/merchant/single-player/b2b-zones`

```json
{
  "name": "McDonald's Raid",
  "latitude": 40.7835,
  "longitude": -73.9660,
  "radius": 60,
  "city": "New York",
  "country": "US",
  "imageUrl": "https://example.com/mcd.jpg",
  "brandLogoUrl": "https://example.com/m-logo.png",
  "holdDurationHours": 72,
  "b2bRewardType": "PHYSICAL",
  "b2bRewardTitle": "Meal Voucher",
  "b2bRewardDescription": "Physical meal voucher at participating location",
  "b2bRewardImageUrl": "https://example.com/meal.png",
  "coinsPerHour": 50,
  "minOwnedZonesRequired": 0,
  "eligibilityNote": "Own 5 zones for VIP campaigns"
}
```

Save `data.id` → `b2bZoneId`, then **admin approve** (section 2).

---

### Update pending B2B

`PUT {{baseUrl}}/merchant/single-player/b2b-zones/{{b2bZoneId}}`

```json
{
  "name": "McDonald's Raid (Updated)",
  "coinsPerHour": 55
}
```

---

### List my B2B zones

`GET {{baseUrl}}/merchant/single-player/b2b-zones?page=1&limit=20`

---

## 4) User — discovery & profile (screens 1, 10)

Header: `Authorization: Bearer {{userToken}}`

Use **GPS near your zone** for map discovery (example matches admin zone above):

- `latitude`: `40.7829`
- `longitude`: `-73.9654`

### Who am I (coins, level)

`GET {{baseUrl}}/user/whoami`

---

### Game config

`GET {{baseUrl}}/single-player/game-config`

---

### Dashboard (map + stats + zones + daily drop)

`GET {{baseUrl}}/single-player/dashboard?latitude=40.7829&longitude=-73.9654`

Response highlights: `dashboard.ownedZonesCount`, `dashboard.maxOwnedZonesPerPlayer`, `dashboard.passiveIncomePerHour`, `zones[].mapPinType`, `zones[].status`.

---

### Zone lists (My Raid Zones tabs)

`GET {{baseUrl}}/single-player/zones?latitude=40.7829&longitude=-73.9654&page=1&limit=20`

| Tab | Query |
|-----|--------|
| Available | `&status=available` |
| Captured | `&status=conquered_by_me` |
| Held by others | `&status=conquered_by_others` |

---

### Zone detail (screens 2, 4, 8, 9)

`GET {{baseUrl}}/single-player/zones/{{zoneId}}?latitude=40.7829&longitude=-73.9654`

Check: `defenseBonusSec`, `captureTimeBreakdown`, `b2b.hold.progressPercent`, `mapPinType`.

---

### Empire / VIP

`GET {{baseUrl}}/single-player/empire`

---

## 5) User — Store guards (screen 7)

### List guard SKUs

`GET {{baseUrl}}/store/all-items?itemType=GUARD&page=1&limit=10`

Save a GUARD item `id` → `storeGuardId`. Response includes `coins`, `spGuardInventory`.

---

### Buy guards

`POST {{baseUrl}}/store/purchase`

```json
{
  "storeItemId": "{{storeGuardId}}",
  "quantity": 2
}
```

---

### Legacy guard purchase (should fail)

`POST {{baseUrl}}/single-player/guards/purchase`

```json
{
  "quantity": 1
}
```

Expected: **410 Gone**.

---

### Guard inventory

`GET {{baseUrl}}/single-player/guards/inventory`

---

## 6) User — capture / snatch (screens 4, 5, 6)

**Important:** `latitude` / `longitude` in body must be **inside the zone radius** (same as zone center for testing).

Replace `{{zoneId}}` with an **enemy** or **available** zone id.

### Start capture

`POST {{baseUrl}}/single-player/zones/{{zoneId}}/capture/start`

```json
{
  "latitude": 40.7829,
  "longitude": -73.9654
}
```

Save `captureTimeSec`, `captureTimeBreakdown`, `distanceMeters`, `completesAfter`.

403 if: shield active, B2B eligibility failed, or **owned zone cap** (5 zones).

---

### Ping (hold in radius)

`POST {{baseUrl}}/single-player/zones/{{zoneId}}/capture/ping`

```json
{
  "latitude": 40.7829,
  "longitude": -73.9654
}
```

---

### Eliminate guard during capture (AR)

`POST {{baseUrl}}/single-player/zones/{{zoneId}}/capture/eliminate-guards`

```json
{
  "count": 1
}
```

Requires active capture session + enough `raidrCoins` (`guardEliminationCoinPrice` from config).

---

### Complete capture

Wait until `captureTimeSec` elapsed (or shorten config in admin for testing), then:

`POST {{baseUrl}}/single-player/zones/{{zoneId}}/capture/complete`

```json
{
  "latitude": 40.7829,
  "longitude": -73.9654
}
```

---

### Cancel capture

`POST {{baseUrl}}/single-player/zones/{{zoneId}}/capture/cancel`

No body.

---

## 7) User — manage defense (screen 3)

Zone must be **`conquered_by_me`**.

### Assign guards

`POST {{baseUrl}}/single-player/zones/{{zoneId}}/guards/assign`

```json
{
  "quantity": 1
}
```

---

### Unassign guards

`POST {{baseUrl}}/single-player/zones/{{zoneId}}/guards/unassign`

```json
{
  "quantity": 1
}
```

---

## 8) User — B2B hold & claim (screens 8, 9)

After you **own** an approved B2B zone and hold time completes (or adjust `holdStartedAt` in DB for QA):

### Claim reward

`POST {{baseUrl}}/single-player/zones/{{b2bZoneId}}/b2b/claim`

No body.

---

### List claims

`GET {{baseUrl}}/single-player/b2b/claims`

---

### Redeem claim

`POST {{baseUrl}}/single-player/b2b/claims/{{claimId}}/redeem`

No body (check controller if extra fields required).

---

## 9) User — daily drop & notifications

### Spawn / get daily drop

`POST {{baseUrl}}/single-player/daily-drop`

```json
{
  "latitude": 40.7829,
  "longitude": -73.9654
}
```

---

### Collect daily drop

`POST {{baseUrl}}/single-player/daily-drop/collect`

```json
{
  "dropId": "PASTE_DROP_UUID",
  "latitude": 40.7829,
  "longitude": -73.9654
}
```

Use drop coordinates from previous response; must be within ~50m.

---

### Notification preferences (settings screen)

`GET {{baseUrl}}/user/notification-preferences`

`PATCH {{baseUrl}}/user/notification-preferences`

```json
{
  "zoneAttackSnatch": true,
  "rareDropAlerts": true,
  "eventsCoinRush": true,
  "b2bRivalryNearby": true,
  "raidZoneShield": true,
  "dailyDropReminders": true
}
```

---

## 10) Other user endpoints (V1 + history)

`GET {{baseUrl}}/single-player/history?type=raidZones`

`GET {{baseUrl}}/single-player/theme`

`GET {{baseUrl}}/single-player/vouchers`

---

## Recommended test order (checklist)

1. [ ] Migrations + Redis up  
2. [ ] Admin login → set config → create zone → create guard SKU  
3. [ ] Merchant login → create B2B → admin approve  
4. [ ] User login → dashboard → list zones → zone detail  
5. [ ] Store buy guards → inventory → assign to owned zone  
6. [ ] Second user (optional): snatch flow start → ping → complete  
7. [ ] Capture eliminate-guards on defended zone  
8. [ ] B2B claim after hold (QA or wait)  
9. [ ] Notification prefs GET/PATCH  

---

## Frontend handover

Field mapping and screen → API table: **`docs/FRONTEND_SINGLE_PLAYER_V2.md`**.

OpenAPI: **`swagger.json`** (+ merge script `node scripts/merge-swagger-sp-phase2.js`).

---

## Two-player snatch test (optional)

1. User A captures neutral `zoneId`.  
2. User B logs in, `GET zones?status=conquered_by_others`, pick same zone.  
3. Wait until User A’s shield expires (`isAttackable: true`) or shorten `shieldDurationMin` in admin config.  
4. User B: `capture/start` → wait `captureTimeSec` → `capture/complete`.  

Use two Postman environments with different `userToken` values.
