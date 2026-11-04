# Notification test API (push navigation QA)

Send **real FCM notifications** with the same `data` shape as production, without triggering crons, captures, or merchant events.

**No authentication** on these routes (protect via env secret in staging/production).

Full notification contract: [NOTIFICATIONS.md](./NOTIFICATIONS.md).

OpenAPI tag: **Test** — schemas `PushNavigationTestRequest`, `PushNavigationTestResponse`.

---

## Base URL

Same as the rest of the API, e.g.:

- Local: `http://localhost:5001/api`
- Production: `{host}/api`

---

## Optional security

If the server sets **`PUSH_NAV_TEST_SECRET`**, every request must include the same value:

| Location | Example |
|----------|---------|
| JSON body | `"secret": "your-secret"` |
| Query | `?secret=your-secret` |
| Header | `x-push-test-secret: your-secret` |

If the env var is **unset**, no secret is required (typical for local dev).

---

## List all test cases

### `GET /test/push-navigation/types`

Returns every supported `type`, default title/body, `category`, required ID fields, and **placeholder UUIDs**.

**Example**

```http
GET /api/test/push-navigation/types
```

**200 response (shape)**

```json
{
  "success": true,
  "data": [
    {
      "type": "zone_under_attack",
      "category": "zoneAttackSnatch",
      "title": "[Test] Your zone is under attack",
      "body": "Someone started capturing your zone.",
      "eventKind": null,
      "idFields": ["zoneId"],
      "placeholderIds": {
        "zoneId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
      }
    }
  ],
  "placeholderIds": {
    "zoneId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "dropId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    "eventId": "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
    "claimId": "dddddddd-dddd-4ddd-8ddd-ddddddddddd4",
    "userVoucherId": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5",
    "campaignId": "ffffffff-ffff-4fff-8fff-fffffffffff6"
  },
  "hint": "POST /api/test/push-navigation with fcmToken + type (+ optional real IDs)."
}
```

---

## Send a test push

### `POST /test/push-navigation`

**Required body fields**

| Field | Description |
|-------|-------------|
| `fcmToken` | Device token from the app |
| `type` | One of the `type` values from GET (or Swagger enum) |

**Optional body fields**

| Field | Description |
|-------|-------------|
| `zoneId`, `dropId`, `eventId`, `claimId`, `userVoucherId`, `campaignId` | Real UUIDs from your dev DB; omitted keys use placeholders |
| `eventKind` | `live_raid` or `coin_rush` (auto-set per type if omitted) |
| `milestoneHours` | e.g. `"24"` for `b2b_rivalry_milestone` |
| `category` | Override FCM `data.category` |
| `title`, `body` | Override notification text |
| `secret` | If `PUSH_NAV_TEST_SECRET` is set |

### Example — zone under attack

```http
POST /api/test/push-navigation
Content-Type: application/json
```

```json
{
  "fcmToken": "YOUR_DEVICE_FCM_TOKEN",
  "type": "zone_under_attack",
  "zoneId": "real-zone-uuid-optional"
}
```

### Example — rare drop

```json
{
  "fcmToken": "YOUR_DEVICE_FCM_TOKEN",
  "type": "rare_drop_spawned",
  "dropId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"
}
```

### Example — Coin Rush live

```json
{
  "fcmToken": "YOUR_DEVICE_FCM_TOKEN",
  "type": "coin_rush_live",
  "eventId": "cccccccc-cccc-4ccc-8ccc-ccccccccccc3"
}
```

**200 response**

```json
{
  "success": true,
  "message": "Navigation test push sent",
  "sent": {
    "title": "[Test] Your zone is under attack",
    "body": "Someone started capturing your zone.",
    "data": {
      "category": "zoneAttackSnatch",
      "type": "zone_under_attack",
      "zoneId": "real-zone-uuid-optional"
    }
  }
}
```

Use `sent.data` to verify the client router receives the expected keys.

---

## All `type` values (quick reference)

| `type` | Typical IDs |
|--------|-------------|
| `rare_drop_spawned` | `dropId` |
| `shield_expiring` | `zoneId` |
| `zone_under_attack` | `zoneId` |
| `zone_snatched` | `zoneId` |
| `b2b_rivalry_milestone` | `zoneId`, `milestoneHours` |
| `b2b_reward_claimed` | `claimId`, `zoneId` |
| `brand_month_reward` | `userVoucherId`, `campaignId` |
| `coin_rush_starts_20m` | `eventId` (+ `eventKind: coin_rush`) |
| `coin_rush_starts_10m` | `eventId` |
| `coin_rush_live` | `eventId` |
| `coin_rush_completed` | `eventId` |
| `coin_rush_scheduled_nearby` | `eventId` |
| `live_raid_new_nearby` | `eventId` (+ `eventKind: live_raid`) |
| `live_raid_starts_20m` | `eventId` |
| `live_raid_starts_10m` | `eventId` |
| `live_raid_live` | `eventId` |
| `live_raid_completed` | `eventId` |
| `referral_reward` | — |
| `test` | — |

---

## Legacy simple test push

### `POST /test/push-notification`

Minimal push with `type: test` only (no navigation IDs).

```json
{
  "fcmToken": "YOUR_DEVICE_FCM_TOKEN",
  "title": "Optional title",
  "body": "Optional body"
}
```

Prefer **`POST /test/push-navigation`** for navigation QA.

---

## Suggested QA checklist

1. `GET /test/push-navigation/types` — confirm catalog matches app enum.
2. For each `type` your app handles, `POST` with `fcmToken` and real IDs from dev.
3. Test **cold start** (tap notification) and **foreground** (`onMessage`).
4. Toggle off a `category` in `PATCH /user/notification-preferences` and confirm **production** paths respect it (test API bypasses prefs by design).

---

## cURL

```bash
curl -s -X POST "http://localhost:5001/api/test/push-navigation" \
  -H "Content-Type: application/json" \
  -d '{
    "fcmToken": "YOUR_DEVICE_FCM_TOKEN",
    "type": "zone_under_attack",
    "zoneId": "real-zone-uuid-optional"
  }'
```

With secret:

```bash
curl -s -X POST "http://localhost:5001/api/test/push-navigation" \
  -H "Content-Type: application/json" \
  -H "x-push-test-secret: your-secret" \
  -d '{"fcmToken":"...","type":"coin_rush_live","eventId":"..."}'
```
