# Zone leaderboard — backend (REST + WebSocket)

**Audience:** Mobile / Flutter  
**Scope:** NORMAL and B2B single-player zones  
**Ranking:** `SinglePlayerZonePassiveLedger.coinsEarned` per zone (same source as coin progress bar). Tie-break: earlier `updatedAt` wins.

---

## REST — zone detail

`GET /api/single-player/zones/:id` includes:

```json
"leaderboard": {
  "zoneId": "uuid",
  "zoneType": "NORMAL",
  "sortBy": "coins_from_zone",
  "top": [
    {
      "rank": 1,
      "userId": "uuid",
      "name": "Alex",
      "photoUrl": "",
      "avatarUrl": "https://...",
      "coins": 120,
      "isWinner": false,
      "isYou": false
    }
  ],
  "viewer": null,
  "winnerAnnounced": false,
  "winnerUserId": null
}
```

| Field | Meaning |
|-------|---------|
| `avatarUrl` | **Always a non-empty HTTPS URL** — equipped store avatar, else `User.avatarFrontUrl`, else `photoUrl`, else default Raider avatar |
| `top` | Up to **3** entries |
| `viewer` | Present when **you** are rank **> 3** (show as 4th row in UI) |
| `isYou` | True when row is the authenticated user |
| `isWinner` | B2B: true when hold is complete and this user is the announced winner |
| `winnerAnnounced` / `winnerUserId` | B2B only — set when hold complete; winner = claim holder if claimed, else top coin earner |

---

## WebSocket

Same connection as events / Coin Rush:

`ws://{HOST}:{WS_PORT}/live-tracking?token={JWT}`

### Join zone room (while on zone detail)

```json
{ "type": "join_single_player_zone", "zoneId": "uuid" }
```

Subscribes to topic **`spzone:{zoneId}`**.

**Immediate snapshot (unicast):**

```json
{
  "type": "single_player_zone_leaderboard_snapshot",
  "zoneId": "uuid",
  "zoneType": "B2B",
  "sortBy": "coins_from_zone",
  "top": [ ... ],
  "viewer": { ... },
  "winnerAnnounced": false,
  "winnerUserId": null
}
```

**Live updates (broadcast to room):**

```json
{
  "type": "single_player_zone_leaderboard_updated",
  "zoneId": "uuid",
  "zoneType": "NORMAL",
  "sortBy": "coins_from_zone",
  "top": [ ... ],
  "entries": [ ... ],
  "winnerAnnounced": false,
  "winnerUserId": null
}
```

Use `entries` to resolve your rank when not in `top`. Recompute local “4th row” from `entries` + your `userId`.

**B2B winner announced (optional event on claim):**

```json
{
  "type": "single_player_zone_winner_announced",
  "zoneId": "uuid",
  "winnerUserId": "uuid"
}
```

### When server pushes updates

- Passive coins cron (~5 min) after ledger increment for that zone
- `POST .../capture/complete`
- `POST .../b2b/claim` (+ winner event)

---

## UI summary

1. Open zone → `GET zones/:id` for initial `leaderboard`.
2. Send `join_single_player_zone` on same screen.
3. On `single_player_zone_leaderboard_updated`, refresh list from `entries` or merge `top`.
4. Render top 3; if `viewer != null`, show as row 4; show winner badge when `isWinner`.

---

## Where to show the leaderboard (Flutter screens)

The leaderboard is **not** sent on `single_player_zone_under_attack` or `single_player_guard_eliminated`. Those events are **owner alerts** on the **`user:{userId}`** channel (auto-subscribed on connect). Show those as banners / toasts / “under attack” UI on map or My Raids — **not** as leaderboard rows.

| Screen | Show leaderboard? | Data source |
|--------|-------------------|-------------|
| **Zone detail** (map pin tap, enemy or owned NORMAL/B2B) | **Yes — primary** | `GET /single-player/zones/:id` → `data.leaderboard`; live via `join_single_player_zone` + snapshot/updated |
| **Snatch / capture flow** (same zone, user still on detail) | **Yes** (optional compact) | Same WS room if already joined; refresh on `leaderboard_updated` |
| **My Raids list row** | Optional mini (top 1–3 avatars) | Only if you add list enrichment later — **today REST leaderboard is on zone detail only** |
| **Home map** | No full board | Tap zone → open detail with leaderboard |
| **Global WS handler** (`under_attack`, etc.) | **No** | Use for alerts only; do not parse as leaderboard |

### Suggested zone detail layout (NORMAL / B2B)

```text
┌─────────────────────────────┐
│ Zone name, pin, owner, …    │
│ Snatch timer OR hold bars   │  ← existing (captureProgressPercent, normal.passiveEarning, b2b.*)
├─────────────────────────────┤
│ Coin leaderboard            │  ← NEW: from data.leaderboard / WS
│  #1 avatar name coins       │
│  #2 …                       │
│  #3 …                       │
│  #7 You (if viewer set)     │
└─────────────────────────────┘
```

### Lifecycle on zone detail

1. **Navigate** to zone detail with `zoneId`.
2. **REST:** `GET /single-player/zones/:id` → bind `leaderboard` to widget.
3. **WS (same app connection):** send `{ "type": "join_single_player_zone", "zoneId" }`.
4. **On** `single_player_zone_leaderboard_snapshot` **or** `_updated` **for this `zoneId`:** update the same widget.
5. **On leave screen:** optional — no server “leave” required; stop updating UI when `zoneId` no longer matches.

### Prod / dev URL (domain)

- REST: `https://backend.raidr-app.com/api` (nginx → dev **5002** today)
- WS: `wss://backend.raidr-app.com/live-tracking?token={JWT}` (nginx → dev WS **3012**)
- Path **`/live-tracking`**, scheme **`wss://`** (not `https://`)
