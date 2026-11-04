# Push notifications (mobile integration)

Backend sends Firebase Cloud Messaging (FCM) alerts with:

- **`notification`**: `title`, `body` (system tray)
- **`data`**: string key/value map for **routing and deep links** (always parse this on tap and in foreground handlers)

Swagger schemas: `PushNotificationFcmData`, `UserNotificationPreference`.

For QA without waiting on crons/game events, use the **[Notification test API](./NOTIFICATION_TEST_API.md)**.

---

## 1. Register the device token

| Method | Path | Auth |
|--------|------|------|
| PATCH | `/api/user/update-fcm` | Bearer |

**Body**

```json
{
  "fcmToken": "<device FCM token>"
}
```

Call after login and whenever the token refreshes.

---

## 2. User preferences

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/user/notification-preferences` | Bearer |
| PATCH | `/api/user/notification-preferences` | Bearer |

**Response / patch fields** (all booleans):

| Field | Server push? | Notes |
|-------|----------------|-------|
| `masterEnabled` | — | Global off → no server pushes (except you may still show in-app UI). |
| `dailyDropReminders` | **No** | **Client only** — schedule local reminders when `true`. Backend does not send this category. |
| `rareDropAlerts` | Yes | Rare daily drop spawned → `dropId` |
| `raidZoneShield` | Yes | Shield expiring → `zoneId` |
| `zoneAttackSnatch` | Yes | Under attack / snatched → `zoneId` |
| `b2bRivalryNearby` | Yes | Nearby B2B milestone → `zoneId`, `milestoneHours` |
| `rewardsVoucher` | Yes | B2B claim / Brand Month → `claimId` or `userVoucherId` |
| `eventsCoinRush` | Yes | Coin Rush lifecycle → `eventId`, `eventKind: coin_rush` |
| `promotionalSponsored` | Yes | Live raid geo / new raid nearby → `eventId`, `eventKind: live_raid` |

PATCH accepts any subset; unknown keys are rejected (Joi).

---

## 3. FCM `data` payload contract

All values are **strings** (FCM requirement on Android).

| Key | When present |
|-----|----------------|
| `category` | Preference key (see table above). Omitted on some master-only pushes (e.g. referral, live-raid participant 20m/completed). |
| `type` | **Primary router** — snake_case action (see §4). |
| `zoneId` | Single-player zone |
| `dropId` | Daily drop |
| `eventId` | Live raid or Coin Rush event |
| `eventKind` | `live_raid` or `coin_rush` (disambiguates `eventId`) |
| `claimId` | B2B hold claim (`SinglePlayerB2bClaim.id`) |
| `userVoucherId` | Vouchers wallet row |
| `campaignId` | Brand Month campaign |
| `milestoneHours` | B2B rivalry milestone (e.g. `"24"`) |

**Recommended client logic**

1. On notification tap (and optional foreground `onMessage`): read `data.type`.
2. Navigate using `type` + IDs; use `eventKind` when opening event screens.
3. Do not use `category` alone for routing — one category can map to multiple `type` values.

Example production payload (rare drop):

```json
{
  "category": "rareDropAlerts",
  "type": "rare_drop_spawned",
  "dropId": "uuid"
}
```

Example (zone attack):

```json
{
  "category": "zoneAttackSnatch",
  "type": "zone_under_attack",
  "zoneId": "uuid"
}
```

---

## 4. `type` enum (routing)

| `type` | Suggested screen / API |
|--------|-------------------------|
| `rare_drop_spawned` | Map / dashboard → collect with `dropId` (`POST /single-player/daily-drop/collect`) |
| `shield_expiring` | Zone detail `GET /single-player/zones/:zoneId` |
| `zone_under_attack` | Same zone detail (capture in progress) |
| `zone_snatched` | Same zone detail or “my zones” |
| `b2b_rivalry_milestone` | B2B zone detail `:zoneId` |
| `b2b_reward_claimed` | B2B claims / reward detail (`claimId`, `zoneId`) |
| `brand_month_reward` | Vouchers `GET /single-player/vouchers` (`userVoucherId`) |
| `coin_rush_starts_20m` | Coin Rush event `:eventId` |
| `coin_rush_starts_10m` | Coin Rush event `:eventId` |
| `coin_rush_live` | Coin Rush event `:eventId` |
| `coin_rush_completed` | Coin Rush results / event `:eventId` |
| `coin_rush_scheduled_nearby` | Coin Rush detail / join |
| `live_raid_new_nearby` | Live event detail `:eventId` |
| `live_raid_starts_20m` | Live event (registered participant) |
| `live_raid_starts_10m` | Live event nearby |
| `live_raid_live` | Live event active |
| `live_raid_completed` | Live event ended |
| `referral_reward` | Wallet / profile (no required ID) |
| `test` | Dev only |

Source of truth in code: `utils/pushNotificationPayload.js` → `PUSH_TYPE`.

---

## 5. What the server sends (by feature)

| Feature | `category` | `type`(s) | IDs |
|---------|------------|-----------|-----|
| Rare drop spawn | `rareDropAlerts` | `rare_drop_spawned` | `dropId` |
| Shield warning cron | `raidZoneShield` | `shield_expiring` | `zoneId` |
| Capture started on your zone | `zoneAttackSnatch` | `zone_under_attack` | `zoneId` |
| Capture completed (you lost zone) | `zoneAttackSnatch` | `zone_snatched` | `zoneId` |
| B2B rivalry cron | `b2bRivalryNearby` | `b2b_rivalry_milestone` | `zoneId`, `milestoneHours` |
| B2B claim | `rewardsVoucher` | `b2b_reward_claimed` | `claimId`, `zoneId` |
| Brand Month prize | `rewardsVoucher` | `brand_month_reward` | `userVoucherId`, `campaignId` |
| Coin Rush (cron + merchant nearby) | `eventsCoinRush` | `coin_rush_*` | `eventId`, `eventKind: coin_rush` |
| Live raid geo / new event | `promotionalSponsored` | `live_raid_new_nearby`, `live_raid_starts_10m`, `live_raid_live` | `eventId`, `eventKind: live_raid` |
| Live raid participant 20m / completed | *(master only)* | `live_raid_starts_20m`, `live_raid_completed` | `eventId`, `eventKind: live_raid` |
| Referral reward | *(master only)* | `referral_reward` | — |

---

## 6. Daily drop reminders (client)

When `dailyDropReminders === true`:

- Schedule **local** notifications (e.g. once per day if drop uncollected).
- Use `GET /single-player/dashboard` (or daily-drop APIs) for `dropId` / map coordinates.
- Do **not** expect server FCM with `category: dailyDropReminders`.

When `rareDropAlerts === true`, server may push `rare_drop_spawned` with `dropId`.

---

## 7. Preference gating (backend behavior)

- **`notifyUserIfAllowed`**: respects `masterEnabled` + matching `category`.
- **`notifyUserIfMasterEnabled`**: respects `masterEnabled` only (live-raid participant alerts, referral).

Users can disable a category in settings; server will not send that category’s pushes.

---

## 8. Related docs

- [NOTIFICATION_TEST_API.md](./NOTIFICATION_TEST_API.md) — send test pushes for every `type`
- [FLUTTER_SINGLE_PLAYER_INTEGRATION.md](./FLUTTER_SINGLE_PLAYER_INTEGRATION.md) §4.14 — preference API examples
- OpenAPI: `/test/push-navigation`, `/user/notification-preferences`, components `PushNotificationFcmData`
