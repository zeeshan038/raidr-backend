# B2B zone — progress bars (frontend integration)

**Audience:** Flutter / mobile developer (or Cursor agent).  
**Backend:** `raidr-backend` — routes under **`/api`**.  
**Requires:** B2B passive + hold fields on zone payloads (`b2b.hold`, `b2b.passiveIncome`, `b2b.passiveIncomePreview`).

**Related:** [FRONTEND_ZONE_PROGRESS_BARS.md](./FRONTEND_ZONE_PROGRESS_BARS.md) (all zone types), [FRONTEND_NORMAL_ZONE_COIN_PROGRESS.md](./FRONTEND_NORMAL_ZONE_COIN_PROGRESS.md) (NORMAL only), [FLUTTER_SINGLE_PLAYER_INTEGRATION.md](./FLUTTER_SINGLE_PLAYER_INTEGRATION.md), OpenAPI schemas `B2bHoldProgress`, `B2bPassiveCoinProgress`, `SinglePlayerB2bBlock`.

---

## Paste into Cursor

```text
Implement B2B zone progress bars per:
docs/FRONTEND_B2B_ZONE_PROGRESS.md

Rules:
- Base URL: {BASE}/api
- Auth: Authorization: Bearer <user JWT>
- zoneType === "B2B" → normal is always null; use b2b block only
- Snatch timer bar: activeCaptureSession.captureProgressPercent (same as NORMAL snatch)
- B2B snatch preview: b2b.passiveIncomePreview.coinsPerHour (not for bar fill)
- Owned B2B — HOLD bar (claim reward): b2b.hold.progressPercent
- Owned B2B — COIN bar (passive during hold): b2b.passiveIncome.coinProgressPercent
- Coin label: coinsEarnedInHold / maxCoinsFromHold (max = holdDurationHours × coinsPerHour)
- Do NOT recompute hold % or coin % on client
- Claim CTA: b2b.canClaim → POST /single-player/zones/:id/b2b/claim
- Wallet: whoami.raidrCoins — not passiveIncome fields
- Poll GET zone every 30–60s while on owned B2B screen (cron ~5 min updates coins)
```

---

## Product summary — two bars when you own B2B

| Phase | Bar | API field | Meaning |
|-------|-----|-----------|---------|
| **Snatching** | Timer | `activeCaptureSession.captureProgressPercent` | Stay in radius until capture completes |
| **Snatching** | Preview text | `b2b.passiveIncomePreview.coinsPerHour` | “Earn X/hour after capture” (not a bar) |
| **Owned — hold** | Timer / claim | `b2b.hold.progressPercent` | Time until merchant reward claim |
| **Owned — coins** | Passive coins | `b2b.passiveIncome.coinProgressPercent` | Earned passive vs max for this hold window |

**Merchant reward** (coupon / physical) is separate from the coin bar — claim via **`b2b.canClaim`** when hold completes.

---

## Figma / screens

| Screen | UI |
|--------|-----|
| **Snatch (B2B)** | Timer ← `captureProgressPercent`; chip ← `passiveIncomePreview.coinsPerHour` |
| **B2B zone detail — owned** | Hold bar ← `b2b.hold.progressPercent`; coin bar ← `passiveIncome.coinProgressPercent` |
| **My Raids — B2B row** | Same hold % and/or coin % from list item `b2b` |
| **Success after capture** | From `capture/complete` → `b2b.passiveIncome`; then GET zone for `b2b.hold` |
| **Claim** | Button when `canClaim`; `POST .../b2b/claim` |

---

## API endpoints

| Step | Method | Path |
|------|--------|------|
| Zone detail | GET | `/single-player/zones/:id?latitude=&longitude=` |
| List / My Raids | GET | `/single-player/zones?status=conquered_by_me&...` |
| Dashboard | GET | `/single-player/dashboard?latitude=&longitude=` |
| Start snatch | POST | `/single-player/zones/:id/capture/start` `{ latitude, longitude }` |
| Snatch ping | POST | `/single-player/zones/:id/capture/ping` |
| Finish snatch | POST | `/single-player/zones/:id/capture/complete` |
| Claim reward | POST | `/single-player/zones/:id/b2b/claim` |

**Envelope:** `{ status, msg?, data? }` for GET.  
**Exception:** `capture/complete` puts `b2b`, `ownedAt`, `shieldExpiresAt` at **top level** (not inside `data`).

**Ping:** returns `remainingSec` only — refresh **GET zone** for `captureProgressPercent`.

---

## JSON — `b2b` block on zone (`zoneType === "B2B"`)

Always present when `zoneType === "B2B"` (reward fields + optional hold / passive).

```json
"b2b": {
  "rewardType": "DIGITAL_COUPON",
  "rewardTitle": "...",
  "rewardDescription": "...",
  "rewardImageUrl": "...",
  "hold": { ... },
  "passiveIncome": { ... },
  "passiveIncomePreview": { ... },
  "canClaim": false
}
```

Only one of `passiveIncomePreview` (snatch) vs `passiveIncome` + `hold` (owned) is typical at a time.

---

### `b2b.hold` — hold-to-claim timer

Present when hold has started (after you capture B2B).

```json
"hold": {
  "holdDurationHours": 24,
  "holdElapsedHours": 6.5,
  "holdComplete": false,
  "holdStartedAt": "2026-11-03T04:00:00.000Z",
  "progressPercent": 27,
  "holdRemainingSeconds": 63000
}
```

| Field | UI |
|-------|-----|
| **`progressPercent`** | **Hold bar** 0–100 |
| `holdElapsedHours` / `holdDurationHours` | “6.5h / 24h” |
| `holdRemainingSeconds` | Countdown |
| `holdComplete` | Hold timer finished |

---

### `b2b.passiveIncome` — coin bar during hold

Present when **you own** the zone and hold is active (enriched on GET list/detail/dashboard).

```json
"passiveIncome": {
  "coinsPerHour": 10,
  "maxCoinsFromHold": 240,
  "coinsEarnedInHold": 24,
  "coinProgressPercent": 10
}
```

| Field | UI |
|-------|-----|
| **`coinProgressPercent`** | **Coin bar** 0–100 |
| **`coinsEarnedInHold`** / **`maxCoinsFromHold`** | Label e.g. “24 / 240 coins” |
| `coinsPerHour` | “10 coins / hour” |
| **`maxCoinsFromHold`** | Server: `floor(holdDurationHours × coinsPerHour)` |

**`coinsEarnedInHold`** increases when passive cron credits wallet + ledger (~every 5 minutes). Not instant at capture.

---

### `b2b.passiveIncomePreview` — during snatch only

```json
"passiveIncomePreview": {
  "coinsPerHour": 10,
  "coinsPerAccrualCycle": 0,
  "accrualCycleMinutes": 5
}
```

Use for copy only — **not** bar percentage.

---

### Zone root

| Field | Use |
|-------|-----|
| `coinsPerHour` | Same rate as inside `passiveIncome`; dashboard sums owned zones |
| `status` | `conquered_by_me` when you own |
| `meetsEligibility` | B2B capture gating vs `minOwnedZonesRequired` |

---

## Full response examples

### Snatching B2B

```json
{
  "status": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Brand Raid Zone",
    "zoneType": "B2B",
    "coinsPerHour": 10,
    "status": "available",
    "normal": null,
    "b2b": {
      "rewardType": "DIGITAL_COUPON",
      "rewardTitle": "Free meal combo",
      "rewardDescription": null,
      "rewardImageUrl": null,
      "hold": null,
      "canClaim": false,
      "passiveIncomePreview": {
        "coinsPerHour": 10,
        "coinsPerAccrualCycle": 0,
        "accrualCycleMinutes": 5
      }
    },
    "activeCaptureSession": {
      "captureProgressPercent": 60,
      "remainingSec": 12,
      "elapsedSec": 18,
      "captureTimeSec": 30,
      "sessionGuardsRemaining": 0,
      "initialGuardCount": 0,
      "guardsEliminatedInSession": 0,
      "startedAt": "2026-11-03T10:09:39.819Z"
    }
  }
}
```

**Timer bar:** `activeCaptureSession.captureProgressPercent` → **60**

---

### Owned B2B (hold + coins)

```json
{
  "status": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "zoneType": "B2B",
    "coinsPerHour": 10,
    "status": "conquered_by_me",
    "normal": null,
    "b2b": {
      "rewardType": "DIGITAL_COUPON",
      "rewardTitle": "Free meal combo",
      "rewardDescription": "Redeem after hold",
      "rewardImageUrl": "https://example.com/meal.png",
      "hold": {
        "holdDurationHours": 24,
        "holdElapsedHours": 6.5,
        "holdComplete": false,
        "holdStartedAt": "2026-11-03T04:00:00.000Z",
        "progressPercent": 27,
        "holdRemainingSeconds": 63000
      },
      "passiveIncome": {
        "coinsPerHour": 10,
        "maxCoinsFromHold": 240,
        "coinsEarnedInHold": 24,
        "coinProgressPercent": 10
      },
      "canClaim": false
    },
    "activeCaptureSession": null
  }
}
```

| Bar | Field | Value |
|-----|-------|-------|
| Hold | `b2b.hold.progressPercent` | 27 |
| Coins | `b2b.passiveIncome.coinProgressPercent` | 10 |

---

### `POST .../capture/complete` (B2B) — top level

```json
{
  "status": true,
  "msg": "Zone captured successfully",
  "shieldExpiresAt": "2026-11-03T13:00:00.000Z",
  "ownedAt": "2026-11-03T12:00:00.000Z",
  "normal": null,
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

Follow with **GET zone** for full `b2b.hold` (starts at capture).

---

## Decision tree (Flutter)

```dart
int? b2bHoldBarPercent(SinglePlayerZone z) {
  if (z.activeCaptureSession != null) {
    return z.activeCaptureSession!.captureProgressPercent;
  }
  if (z.zoneType == 'B2B' && z.b2b?.hold != null) {
    return z.b2b!.hold!.progressPercent;
  }
  return null;
}

int? b2bCoinBarPercent(SinglePlayerZone z) {
  if (z.zoneType == 'B2B' && z.b2b?.passiveIncome != null) {
    return z.b2b!.passiveIncome!.coinProgressPercent;
  }
  return null;
}
```

```text
if activeCaptureSession != null:
  show TIMER bar = captureProgressPercent
  show chip = b2b.passiveIncomePreview.coinsPerHour
  when remainingSec == 0 → POST capture/complete
  return

if zoneType == B2B && status == conquered_by_me:
  show HOLD bar = b2b.hold.progressPercent
  show COIN bar = b2b.passiveIncome.coinProgressPercent
  label coins = coinsEarnedInHold / maxCoinsFromHold
  if b2b.canClaim → show Claim → POST b2b/claim
```

---

## Suggested Dart models

```dart
class B2bHoldProgress {
  final double holdDurationHours;
  final double holdElapsedHours;
  final bool holdComplete;
  final int progressPercent;
  final int holdRemainingSeconds;

  double get holdBarProgress => progressPercent.clamp(0, 100) / 100.0;
}

class B2bPassiveIncome {
  final int coinsPerHour;
  final int maxCoinsFromHold;
  final int coinsEarnedInHold;
  final int coinProgressPercent;

  factory B2bPassiveIncome.fromJson(Map<String, dynamic> j) =>
      B2bPassiveIncome(
        coinsPerHour: j['coinsPerHour'] as int? ?? 0,
        maxCoinsFromHold: j['maxCoinsFromHold'] as int? ?? 0,
        coinsEarnedInHold: j['coinsEarnedInHold'] as int? ?? 0,
        coinProgressPercent: j['coinProgressPercent'] as int? ?? 0,
      );

  double get coinBarProgress => coinProgressPercent.clamp(0, 100) / 100.0;
}

class B2bZoneBlock {
  final String? rewardType;
  final String? rewardTitle;
  final B2bHoldProgress? hold;
  final B2bPassiveIncome? passiveIncome;
  final PassiveIncomePreview? passiveIncomePreview;
  final bool canClaim;
}
```

Reuse the same **`PassiveIncomePreview`** model as NORMAL for `passiveIncomePreview`.

---

## Refresh / polling

| Screen | Recommendation |
|--------|------------------|
| Snatch | `capture/ping` every 2–5s; GET zone for `captureProgressPercent` |
| Owned B2B | GET zone every **30–60s** for `passiveIncome` and `hold` |
| After complete | Use `capture/complete` `b2b.passiveIncome`; GET zone for `hold` |

---

## Edge cases

| Case | Behavior |
|------|----------|
| `coinsPerHour === 0` | `maxCoinsFromHold === 0`, `coinProgressPercent === 0` — fix rate in admin/merchant |
| `hold === null` | Not captured yet or hold not started |
| `normal != null` on B2B | Should not happen — ignore `normal` on B2B |
| Lost zone to snatch | No `passiveIncome` for you; enemy sees their own state |
| Hold complete, not claimed | `holdComplete: true`, `canClaim: true` |

---

## Economy

- New merchant B2B zones default **`coinsPerHour`** from **`defaultZoneCoinsPerHour`** (game config, typically **10**).
- Admin: `PUT /api/admin/single-player/config`, mobile hints: `GET /single-player/game-config`.
- B2B hold complete bonus coins/XP: **`b2bHoldCompleteCoins`** / **`b2bHoldCompleteXp`** on claim — separate from passive bar.

---

## QA checklist

- [ ] B2B snatch: timer from `captureProgressPercent`; preview from `passiveIncomePreview`
- [ ] B2B owned: hold bar from `hold.progressPercent`
- [ ] B2B owned: coin bar from `passiveIncome.coinProgressPercent`
- [ ] List/dashboard B2B rows match detail
- [ ] Claim when `canClaim`
- [ ] Do not use `normal.*` on B2B
- [ ] Backend has `SinglePlayerZonePassiveLedger` table deployed

---

## Backend reference

- Hold math: `utils/singlePlayerZone.js` → `computeB2bHoldProgress`
- Coin math: `computeB2bPassiveCoinProgress`
- Enrichment: `utils/singlePlayerZonePassiveLedger.js` → `enrichB2bPassiveIncomeOnFormattedZones`

**Document version:** 2026-11-04
