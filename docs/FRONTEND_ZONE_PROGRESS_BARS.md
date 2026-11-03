# Zone progress bars — frontend implementation guide

**API base:** `{BASE_URL}/api` · **Auth:** `Authorization: Bearer <user JWT>`

---

## Bar field cheat sheet

| Screen state | Bar % field | Label fields |
|--------------|-------------|--------------|
| Snatching (NORMAL or B2B) | `activeCaptureSession.captureProgressPercent` | `remainingSec` |
| NORMAL — you own | `normal.passiveEarning.progressPercent` | `yourCoinsFromZone` / `leaderCoinsFromZone` |
| B2B — you own (hold timer) | `b2b.hold.progressPercent` | `holdElapsedHours` / `holdDurationHours` |
| B2B — you own (coins during hold) | `b2b.passiveIncome.coinProgressPercent` | `coinsEarnedInHold` / `maxCoinsFromHold` |

Do **not** recompute % on the client unless the server field is missing.

---

## Decision tree

```text
if activeCaptureSession != null:
  timerBar = captureProgressPercent
  if zoneType == B2B: preview = b2b.passiveIncomePreview
  if zoneType == NORMAL: preview = normal.passiveIncomePreview
else if zoneType == B2B && b2b != null:
  holdBar = b2b.hold.progressPercent
  coinBar = b2b.passiveIncome?.coinProgressPercent   // optional second bar
else if zoneType == NORMAL && normal?.passiveEarning:
  coinBar = normal.passiveEarning.progressPercent
```

---

## B2B — coins per hour

### Zone root

- `coinsPerHour` — always on `SinglePlayerZoneFormatted`.

### Snatch — `b2b.passiveIncomePreview`

Same shape as NORMAL preview:

```json
"b2b": {
  "passiveIncomePreview": {
    "coinsPerHour": 10,
    "coinsPerAccrualCycle": 0,
    "accrualCycleMinutes": 5
  }
}
```

### Owned during hold — `b2b.passiveIncome`

```json
"b2b": {
  "hold": { "progressPercent": 27, "...": "..." },
  "passiveIncome": {
    "coinsPerHour": 10,
    "maxCoinsFromHold": 240,
    "coinsEarnedInHold": 24,
    "coinProgressPercent": 10
  },
  "canClaim": false
}
```

- **maxCoinsFromHold** = `holdDurationHours × coinsPerHour` (e.g. 24 × 10 = 240).
- **coinsEarnedInHold** updates after passive cron (~5 min); poll GET zone every 30–60s.
- Wallet balance: `whoami.raidrCoins` — not these fields.

### `POST capture/complete` (B2B)

Top-level (not in `data`):

```json
{
  "status": true,
  "ownedAt": "...",
  "b2b": {
    "passiveIncome": {
      "coinsPerHour": 10,
      "maxCoinsFromHold": 240,
      "coinsEarnedInHold": 0,
      "coinProgressPercent": 0
    }
  }
}
```

---

## B2B — full guide

See **[FRONTEND_B2B_ZONE_PROGRESS.md](./FRONTEND_B2B_ZONE_PROGRESS.md)** (hold + coin bars, full JSON, Dart models).

## NORMAL — competitive coin bar

See [FRONTEND_NORMAL_ZONE_COIN_PROGRESS.md](./FRONTEND_NORMAL_ZONE_COIN_PROGRESS.md).

---

## Endpoints

| Action | Path |
|--------|------|
| Zone detail | `GET /single-player/zones/:id?latitude=&longitude=` |
| List | `GET /single-player/zones?...` |
| Dashboard | `GET /single-player/dashboard?latitude=&longitude=` |
| Complete snatch | `POST /single-player/zones/:id/capture/complete` |

---

## Economy defaults

New B2B zones get `coinsPerHour` from admin **`defaultZoneCoinsPerHour`** (game config) when merchant omits it. Admin: `PUT /api/admin/single-player/config`.

**Doc version:** 2026-11-03
