# NORMAL zone — coin progress bar (frontend integration)

**Audience:** Flutter / mobile developer (or Cursor agent).  
**Backend:** `raidr-backend` — all routes under **`/api`**.  
**Requires:** Backend deployed with `normal.*` and `captureProgressPercent` fields (Phase 2+ passive bar).

**Related docs:** [FLUTTER_SINGLE_PLAYER_INTEGRATION.md](./FLUTTER_SINGLE_PLAYER_INTEGRATION.md) (full Single Player API), [FRONTEND_SINGLE_PLAYER_V2.md](./FRONTEND_SINGLE_PLAYER_V2.md) (screen map), OpenAPI `swagger.json` schemas `NormalPassiveCoinProgress`, `SinglePlayerNormalBlock`, `ActiveCaptureSession`.

---

## Paste into Cursor

```text
Implement NORMAL zone coin + snatch progress bars per:
docs/FRONTEND_NORMAL_ZONE_COIN_PROGRESS.md

Rules:
- Base URL: {BASE}/api
- Auth: Authorization: Bearer <user JWT>
- Envelope: { status: true|false, msg?, data? } — zone detail uses data object
- Do NOT compute coin bar % on client for owned zones — bind to normal.passiveEarning.progressPercent
- Do NOT compute snatch timer % on client — bind to activeCaptureSession.captureProgressPercent (or remainingSec label)
- B2B zones: unchanged — use b2b.hold.progressPercent only (normal is null)
- Coins are NOT granted at capture/complete; passive payout runs server-side every 5 minutes
- estimatedCoinsSinceOwned is approximate (no daily cap / VIP in that number)
- Refresh zone via GET /single-player/zones/:id during snatch (ping loop) and after complete
```

---

## Product summary

| Zone type | Progress bar | API field |
|-----------|--------------|-----------|
| **NORMAL — snatching** | Hold / snatch **timer** | `activeCaptureSession.captureProgressPercent` (0–100) |
| **NORMAL — snatching** | Preview text (“earn X/hr”) | `normal.passiveIncomePreview` |
| **NORMAL — you own it** | **Coin** bar (this zone) | `normal.passiveEarning.progressPercent` (0–100) |
| **B2B — you own it** | Hold for reward | `b2b.hold.progressPercent` (unchanged) |

Use the **same UI pattern** as B2B hold: one integer 0–100 drives the bar widget; optional subtitle from other fields.

---

## Figma / screens

| Screen | What to show |
|--------|----------------|
| **5 — Snatch** (NORMAL) | Timer bar ← `captureProgressPercent`; optional chip ← `passiveIncomePreview.coinsPerHour` |
| **Success after capture** | Coin bar ← `normal.passiveEarning` from **complete** response or immediate GET zone |
| **2 — Your zone** (NORMAL) | Coin bar ← `normal.passiveEarning` |
| **10 — My Raid Zones** (captured tab) | Per-row coin bar ← `normal.passiveEarning.progressPercent` |
| **8/9 — B2B** | Do **not** use `normal`; use `b2b.hold` only |

---

## API endpoints (minimal flow)

All **Private** — `Authorization: Bearer {{userToken}}`.

| Step | Method | Path | Notes |
|------|--------|------|--------|
| Zone detail | `GET` | `/single-player/zones/:id?latitude={lat}&longitude={lng}` | Required query when zone not yours (discovery) |
| Start snatch | `POST` | `/single-player/zones/:id/capture/start` | Body: `{ latitude, longitude }` inside radius |
| Hold ping | `POST` | `/single-player/zones/:id/capture/ping` | Same body; every 2–5s while on snatch screen |
| Finish | `POST` | `/single-player/zones/:id/capture/complete` | After `remainingSec === 0` |
| My zones list | `GET` | `/single-player/zones?status=conquered_by_me&latitude=&longitude=&page=1&limit=20` | Each item is `SinglePlayerZoneFormatted` |

Postman walkthrough: [POSTMAN_SINGLE_PLAYER_V2.md](./POSTMAN_SINGLE_PLAYER_V2.md) §2, §4, §6.

---

## JSON shapes

### `normal` on zone (`zoneType === "NORMAL"`)

```json
"normal": {
  "passiveEarning": { "...": "only when status === conquered_by_me" },
  "passiveIncomePreview": { "...": "only during activeCaptureSession (snatch)" }
}
```

Both are never required at once: **preview while snatching**, **passiveEarning after own**.

### `normal.passiveIncomePreview` (during snatch)

```json
{
  "coinsPerHour": 60,
  "coinsPerAccrualCycle": 5,
  "accrualCycleMinutes": 5
}
```

- **`coinsPerAccrualCycle`** = floor(`coinsPerHour` × 5/60) — coins credited each server tick (5 min).
- Use for copy: “Earn **60** coins/hour from this zone after capture”.

### `normal.passiveEarning` (you own the zone)

```json
{
  "coinsPerHour": 60,
  "coinsPerAccrualCycle": 5,
  "accrualCycleMinutes": 5,
  "coinsAccruedInCycle": 2,
  "progressPercent": 42,
  "accrualCycleRemainingSeconds": 174,
  "estimatedCoinsSinceOwned": 15,
  "ownedAt": "2026-11-03T10:12:00.000Z"
}
```

| Field | UI use |
|-------|--------|
| **`progressPercent`** | **Primary** — `LinearProgressIndicator(value: p / 100)` |
| `coinsAccruedInCycle` / `coinsPerAccrualCycle` | Label: “2 / 5 coins” (this 5‑min window) |
| `coinsPerHour` | Chip under bar |
| `accrualCycleRemainingSeconds` | Optional countdown to next tick |
| `estimatedCoinsSinceOwned` | Optional total line — mark as **estimate** in UI |
| `ownedAt` | “Held since …” (you may still format locally) |

### `activeCaptureSession` (during snatch)

```json
{
  "initialGuardCount": 0,
  "sessionGuardsRemaining": 0,
  "guardsEliminatedInSession": 0,
  "captureTimeSec": 30,
  "startedAt": "2026-11-03T10:09:39.819Z",
  "remainingSec": 12,
  "elapsedSec": 18,
  "captureProgressPercent": 60
}
```

| Field | UI use |
|-------|--------|
| **`captureProgressPercent`** | Snatch **timer** bar (0–100) |
| `remainingSec` | Big countdown text |
| `sessionGuardsRemaining` | AR / guard flow (unchanged) |

**Example (timer done, not owned yet):** `remainingSec: 0`, `captureProgressPercent: 100`, `status: "available"` → enable **Complete capture** CTA and call `capture/complete`.

### `POST .../capture/complete` — 200 body (top level, not wrapped in `data`)

```json
{
  "status": true,
  "msg": "Zone captured successfully",
  "shieldExpiresAt": "2026-11-03T11:12:00.000Z",
  "ownedAt": "2026-11-03T10:12:00.000Z",
  "normal": {
    "passiveEarning": {
      "coinsPerHour": 60,
      "coinsPerAccrualCycle": 5,
      "accrualCycleMinutes": 5,
      "coinsAccruedInCycle": 0,
      "progressPercent": 0,
      "accrualCycleRemainingSeconds": 300,
      "estimatedCoinsSinceOwned": 0,
      "ownedAt": "2026-11-03T10:12:00.000Z"
    }
  }
}
```

`normal` is omitted for B2B captures (use `b2b` on subsequent GET zone).

---

## Dart models (suggested)

```dart
class NormalPassiveIncomePreview {
  final int coinsPerHour;
  final int coinsPerAccrualCycle;
  final int accrualCycleMinutes;

  factory NormalPassiveIncomePreview.fromJson(Map<String, dynamic> j) =>
      NormalPassiveIncomePreview(
        coinsPerHour: j['coinsPerHour'] as int? ?? 0,
        coinsPerAccrualCycle: j['coinsPerAccrualCycle'] as int? ?? 0,
        accrualCycleMinutes: j['accrualCycleMinutes'] as int? ?? 5,
      );
}

class NormalPassiveEarning {
  final int coinsPerHour;
  final int coinsPerAccrualCycle;
  final int accrualCycleMinutes;
  final int coinsAccruedInCycle;
  final int progressPercent;
  final int accrualCycleRemainingSeconds;
  final int estimatedCoinsSinceOwned;
  final DateTime? ownedAt;

  factory NormalPassiveEarning.fromJson(Map<String, dynamic> j) =>
      NormalPassiveEarning(
        coinsPerHour: j['coinsPerHour'] as int? ?? 0,
        coinsPerAccrualCycle: j['coinsPerAccrualCycle'] as int? ?? 0,
        accrualCycleMinutes: j['accrualCycleMinutes'] as int? ?? 5,
        coinsAccruedInCycle: j['coinsAccruedInCycle'] as int? ?? 0,
        progressPercent: j['progressPercent'] as int? ?? 0,
        accrualCycleRemainingSeconds: j['accrualCycleRemainingSeconds'] as int? ?? 0,
        estimatedCoinsSinceOwned: j['estimatedCoinsSinceOwned'] as int? ?? 0,
        ownedAt: j['ownedAt'] != null ? DateTime.tryParse(j['ownedAt']) : null,
      );

  double get progress => (progressPercent.clamp(0, 100)) / 100.0;
}

class NormalZoneBlock {
  final NormalPassiveEarning? passiveEarning;
  final NormalPassiveIncomePreview? passiveIncomePreview;

  factory NormalZoneBlock.fromJson(Map<String, dynamic>? j) {
    if (j == null) return NormalZoneBlock();
    return NormalZoneBlock(
      passiveEarning: j['passiveEarning'] != null
          ? NormalPassiveEarning.fromJson(j['passiveEarning'])
          : null,
      passiveIncomePreview: j['passiveIncomePreview'] != null
          ? NormalPassiveIncomePreview.fromJson(j['passiveIncomePreview'])
          : null,
    );
  }
}

class ActiveCaptureSession {
  // ... existing fields ...
  final int captureProgressPercent;
  final int remainingSec;
  final int elapsedSec;

  double get timerProgress => (captureProgressPercent.clamp(0, 100)) / 100.0;
}
```

Extend existing `SinglePlayerZone`:

```dart
final NormalZoneBlock? normal; // parse from json['normal']
```

Parse `capture/complete` into a small `CaptureCompleteResult` that includes optional `NormalPassiveEarning? passiveEarning` from `json['normal']?['passiveEarning']`.

---

## UI logic (decision tree)

```text
if zone.zoneType == 'B2B':
  show hold bar from zone.b2b?.hold?.progressPercent
  return

if zone.zoneType != 'NORMAL':
  return

if zone.activeCaptureSession != null:
  show TIMER bar = activeCaptureSession.captureProgressPercent
  show optional preview = zone.normal?.passiveIncomePreview
  when remainingSec == 0 → enable Complete → POST capture/complete
  return

if zone.status == 'conquered_by_me' && zone.normal?.passiveEarning != null:
  show COIN bar = passiveEarning.progressPercent
  label = "${coinsAccruedInCycle} / ${coinsPerAccrualCycle} coins"
  return
```

---

## Refresh / polling

| Screen | Recommendation |
|--------|------------------|
| Snatch | `capture/ping` every 2–5s; optionally `GET zones/:id` after ping to refresh `captureProgressPercent` |
| Your zone / My Raids | Poll `GET zones/:id` or list every **30–60s** so `progressPercent` moves (server-aligned 5‑min cycle) |
| After complete | Use response `normal.passiveEarning` immediately; then GET zone to sync |

You **may** animate the coin bar locally between polls using `accrualCycleRemainingSeconds`, but **reset** from server on each GET to avoid drift.

---

## Edge cases

| Case | Behavior |
|------|----------|
| `normal == null` | Enemy zone, or not NORMAL, or not owner |
| Only `passiveIncomePreview` | Mid-snatch — no coin bar yet (or show empty coin bar + preview text) |
| `captureProgressPercent == 100` but still `available` | Call **`capture/complete`** — ownership not applied until then |
| User owns 5 zones | `capture/start` → 403 — show `ownedZonesCount` / `maxOwnedZonesPerPlayer` |
| Guards on zone | `sessionGuardsRemaining > 0` → eliminate before complete (unchanged) |
| Wallet balance | Passive coins still update via cron / `whoami` — bar is **per-zone UI**, not wallet |

---

## Implementation checklist

- [ ] Parse `normal` on `SinglePlayerZone` from dashboard, list, and detail
- [ ] Parse `captureProgressPercent` on `ActiveCaptureSession`
- [ ] Snatch screen: timer bar + preview; complete when `remainingSec == 0`
- [ ] Success screen: coin bar from `capture/complete` → `normal.passiveEarning`
- [ ] Your zone + My Raids (NORMAL): coin bar from `passiveEarning.progressPercent`
- [ ] B2B screens unchanged (`b2b.hold`)
- [ ] Do not show coin bar for zones owned by others
- [ ] QA against staging/prod backend that includes this release

---

## Quick QA (Postman)

1. Create NORMAL zone (admin) → capture as user → **complete**.
2. GET zone: `status: conquered_by_me`, `normal.passiveEarning.progressPercent` present.
3. During snatch: `captureProgressPercent`, `passiveIncomePreview`, no `passiveEarning`.

---

## Cursor agent — file touch list (typical Flutter app)

Adjust paths to your repo:

| Area | Task |
|------|------|
| `models/single_player_zone.dart` | Add `NormalZoneBlock`, `NormalPassiveEarning`, `NormalPassiveIncomePreview` |
| `models/capture_session.dart` | Add `captureProgressPercent` |
| `api/single_player_api.dart` | Parse `normal` on zone; parse complete response |
| `screens/snatch/` | Timer bar + preview |
| `screens/zone_detail/` | Coin bar when owned NORMAL |
| `screens/my_raids/` | List tile progress for NORMAL |
| `widgets/zone_progress_bar.dart` | Reuse one widget: `percent` + `label` (B2B hold vs NORMAL coins vs snatch timer) |

---

**Document version:** 2026-11-03 — aligned with `utils/singlePlayerZone.js`, `utils/singlePlayerCapture.js`, `controllers/singlePlayer.js` (`completeCapture`).
