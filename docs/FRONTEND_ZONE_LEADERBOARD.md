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
