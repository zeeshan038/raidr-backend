# NFC Partner Visit + Receipt (Phase 1 + 2)

Physical RAIDR NFC tags at partner counters verify **store visits** (foot traffic). Optional **receipt photo** proves purchase amount (no POS).

OpenAPI: `swagger.json` tags **NFC Visits**, **Admin - NFC**, **Merchant - NFC** (merge with `npm run swagger:merge-nfc`).

## Tag payload

Write a **URI NDEF** record:

```text
raidr://nfc/v1?token=<token>&merchantId=<merchantUuid>
```

`merchantId` is optional (token alone is enough). Admin/merchant APIs return `payloadUri` + `programmingHint`.

## Player API

### 1) Verify tap

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

| Field | Meaning |
|--------|---------|
| `missionCompleted` | First rewarded tap today for this merchant |
| `alreadyVisitedToday` | Already got today’s visit reward |
| `coinsAwarded` / `xpAwarded` | Visit mission reward (0 if already rewarded) |
| `promptReceipt` | Show “snap receipt?” CTA |
| `receiptUploadReady` | `true` — call `POST /nfc/receipt` |
| `visitId` | Pass this when submitting a receipt |

### 2) Receipt photo (bonus coins)

`POST /api/nfc/receipt` (Bearer user token)

**multipart/form-data** (preferred):

| Field | Value |
|--------|--------|
| `visitId` | from verify response |
| `captureSource` | **`camera`** only (gallery rejected) |
| `image` | live camera JPEG/PNG |

Or JSON after `POST /upload/image`:

```json
{
  "visitId": "...",
  "captureSource": "camera",
  "imageUrl": "https://..."
}
```

**Backend checks**

1. Visit belongs to user; not older than 24h (env `NFC_RECEIPT_SUBMIT_WINDOW_HOURS`)
2. One receipt per visit
3. Same photo hash blocked globally
4. Same user + merchant + day + amount fingerprint blocked
5. Vision AI (Gemini → OpenAI fallback) extracts **total** + **date**
6. Receipt date must be **today** (`Asia/Jerusalem`)
7. Bonus: `floor(amount × NFC_RECEIPT_COINS_PER_ILS)` coins / XP (capped)

**Response highlights:** `amountIls`, `coinsAwarded`, `xpAwarded`, `imageUrl`, `status: approved`.

`GET /api/nfc/my-visits` — player history (includes nested `receipt` when present).

## Admin / Merchant

| Method | Path |
|--------|------|
| GET | `/api/admin/nfc/merchants/:merchantId/tags` (auto-provisions default tag) |
| POST | `/api/admin/nfc/merchants/:merchantId/tags` |
| GET | `/api/admin/nfc/merchants/:merchantId/visits` |
| GET | `/api/merchant/nfc/tags` |
| POST | `/api/merchant/nfc/tags` |
| GET | `/api/merchant/nfc/visits` |

Visit lists include `receipt.amountIls` for revenue attribution.

**UI**

- Super Admin → Merchants → **NFC**
- Merchant Hub → sidebar **NFC visit tags** (`/nfc`)

## Flutter checklist

1. Request NFC permission / session.
2. On tap, read URI → `POST /nfc/verify` with GPS if available.
3. If `missionCompleted`, show success + coins.
4. If `promptReceipt` && `receiptUploadReady`, show optional receipt CTA.
5. Open **camera only** (disable gallery). Upload via `POST /nfc/receipt` with `captureSource=camera` + `visitId`.
6. Show bonus coins from response; handle 409 duplicate / 400 old receipt.

## Env knobs

| Var | Default |
|-----|---------|
| `NFC_VISIT_REWARD_COINS` / `NFC_VISIT_REWARD_XP` | 5 / 15 |
| `NFC_RECEIPT_COINS_PER_ILS` / `NFC_RECEIPT_XP_PER_ILS` | 1 / 2 |
| `NFC_RECEIPT_MAX_COINS` / `NFC_RECEIPT_MAX_XP` | 500 / 1000 |
| `NFC_RECEIPT_SUBMIT_WINDOW_HOURS` | 24 |
| `NFC_RECEIPT_VISION_MODEL` | `gemini-2.0-flash` |
| `GEMINI_KEY` or `OPENAI_API_KEY` | required for Vision |
