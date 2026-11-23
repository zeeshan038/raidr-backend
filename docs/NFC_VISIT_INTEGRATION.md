# NFC Partner Visit (Phase 1)

Physical RAIDR NFC tags at partner counters verify **store visits** (foot traffic). Receipt photo / purchase AI is **Phase 2**.

OpenAPI: `swagger.json` tags **NFC Visits**, **Admin - NFC**, **Merchant - NFC** (merge with `npm run swagger:merge-nfc`).

## Tag payload

Write a **URI NDEF** record:

```text
raidr://nfc/v1?token=<token>&merchantId=<merchantUuid>
```

`merchantId` is optional (token alone is enough). Admin/merchant APIs return `payloadUri` + `programmingHint`.

## Player API

`POST /api/nfc/verify` (Bearer user token)

```json
{
  "payload": "raidr://nfc/v1?token=...",
  "latitude": 32.08,
  "longitude": 34.78,
  "chipUid": "optional-hardware-uid"
}
```

Also accepts `token` alone.

**Response highlights**

| Field | Meaning |
|--------|---------|
| `missionCompleted` | First rewarded tap today for this merchant |
| `alreadyVisitedToday` | Already got today’s visit reward |
| `coinsAwarded` / `xpAwarded` | Mission reward (0 if already rewarded) |
| `promptReceipt` | Show “snap receipt?” CTA |
| `receiptUploadReady` | `false` until Phase 2 |

`GET /api/nfc/my-visits` — player history.

## Admin / Merchant

| Method | Path |
|--------|------|
| GET | `/api/admin/nfc/merchants/:merchantId/tags` (auto-provisions default tag) |
| POST | `/api/admin/nfc/merchants/:merchantId/tags` |
| GET | `/api/admin/nfc/merchants/:merchantId/visits` |
| GET | `/api/merchant/nfc/tags` |
| POST | `/api/merchant/nfc/tags` |
| GET | `/api/merchant/nfc/visits` |

**UI**

- Super Admin → Merchants → **NFC**
- Merchant Hub → sidebar **NFC visit tags** (`/nfc`) — copy URI + visit history

## Flutter checklist

1. Request NFC permission / session.
2. On tap, read URI → `POST /nfc/verify` with GPS if available.
3. If `missionCompleted`, show success + coins.
4. If `promptReceipt`, show optional receipt CTA (upload API later).
