# Capture tap acceleration (Flutter implementation)

**Audience:** Flutter / mobile developer (or Cursor agent).  
**Backend:** `raidr-backend` — all routes under **`/api`**.

## Recommended flow (no API per tap)

1. Player starts capture → store `captureTimeSec` from server.
2. On device: run a **wall stopwatch** for the snatch screen; compute **`speedMultiplier` (1.0–2.0)** from local taps (same rule: ~4 taps/sec → 2×).
3. **Do not** call the API on every tap.
4. Every **3–5s** (and right before complete), call **`POST .../capture/ping`** or **`POST .../capture/taps`** with GPS + progress:

```json
{
  "latitude": 40.7829,
  "longitude": -73.9654,
  "holdWallSec": 30,
  "speedMultiplier": 2
}
```

5. Server credits **effective = holdWallSec × speedMultiplier** (capped at `captureTimeSec`, and `holdWallSec` cannot exceed real time since `capture/start`).
6. Example: **60s** capture, user holds **30s** wall at **2×** → **`canComplete: true`** → `POST .../capture/complete`.

**Related:** [FLUTTER_SINGLE_PLAYER_INTEGRATION.md](./FLUTTER_SINGLE_PLAYER_INTEGRATION.md) § Capture.

---

## Paste into Cursor

```text
Snatch timer sync per docs/FLUTTER_CAPTURE_TAP_ACCELERATION.md (client hold sync).

- Taps are LOCAL only (UI + speedMultiplier).
- Every 3-5s: POST capture/ping { lat, lng, holdWallSec, speedMultiplier }
- holdWallSec = cumulative wall seconds since capture/start (Stopwatch), non-decreasing
- speedMultiplier = 1.0..2.0 from local tap rate (do not exceed 2)
- Complete when server canComplete === true (e.g. 60s capture: holdWallSec 30 + speed 2)
- Optional: same body on capture/taps instead of ping
- Legacy per-tap API (taps only) still works but do not use for new builds
```

---

## Fields

| Field | Type | Meaning |
|--------|------|---------|
| `holdWallSec` | number | Wall-clock seconds since snatch started (device stopwatch) |
| `speedMultiplier` | number | **Required with** `holdWallSec`. **1.0–2.0** from local taps |

Server response (same as before): `remainingSec`, `captureProgressPercent`, `canComplete`, `speedMultiplier`, etc.

---

## Client UI

| Widget | Source |
|--------|--------|
| Wall hold label (optional) | Local stopwatch |
| Countdown / bar | Prefer **server** after each ping; smooth locally between syncs |
| Complete button | `canComplete` from last ping/taps response |

Interpolation between syncs (optional):

```dart
// After each successful ping:
displayRemaining = response.remainingSec;
// Optionally animate down until next ping using local speedMultiplier
```

---

## Server validation (what Flutter must respect)

| Rule | Detail |
|------|--------|
| Effective time | `min(captureTimeSec, holdWallSec × clamp(speedMultiplier, 1..2))` |
| Wall cap | `holdWallSec` ≤ seconds since `capture/start` (+ ~3s clock slack) |
| Monotonic | `holdWallSec` must not decrease vs last sync |
| Radius | Out of radius on ping/taps → `cancelled: true` |
| Complete | Still requires `capture/complete` when `canComplete` |

---

## Legacy (deprecated)

`POST .../capture/taps` with only `{ taps: 1 }` per request — server counts taps. **Not** needed if you use `holdWallSec` + `speedMultiplier`.

---

## Example: 60 second capture at 2×

| Step | holdWallSec | speedMultiplier | Server effective | remainingSec |
|------|-------------|-----------------|------------------|--------------|
| ping @ 15s | 15 | 2 | 30 | 30 |
| ping @ 30s | 30 | 2 | 60 | **0** → complete |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03 | Client `holdWallSec` + `speedMultiplier` sync on ping/taps |
| 2026-03 | Added `POST .../capture/taps`; server-side tap counting (legacy) |
