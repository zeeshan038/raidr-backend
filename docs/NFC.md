# RAIDR NFC — Partner Visit + Purchase Tracking

Physical NFC stickers at partner shop counters. No POS. Zero cashier work.

| Step | What happens | Who builds it |
|------|----------------|---------------|
| **1. NFC tap** | Player taps phone on sticker → visit verified → visit mission reward (once/day) | **Backend + Admin/Merchant done** · Flutter reads NFC |
| **2. Receipt photo** | Optional “Bought something?” → live camera → AI reads ₪ total → bonus coins + spend logged under merchant | **Backend done** · Flutter camera + upload |

**Not** for geo drops, Coin Rush checkpoints, or loot QR. Those stay separate.

---

## Business flow (client-confirmed)

1. RAIDR places an NFC tag at the partner counter.
2. Player opens RAIDR and taps the phone on the tag → visit logged → visit mission completes.
3. If they bought something, they snap a **live camera** receipt photo (not gallery).
4. Vision AI extracts **total amount** + **date/time**.
5. System credits bonus coins/XP and stores spend under that merchant (revenue attribution).

**Anti-fraud (required)**

- Receipt must be live camera (`captureSource=camera`)
- Receipt date must be **today** (`Asia/Jerusalem`)
- Duplicate photo / same spend fingerprint blocked

---

## Tag payload (write to physical sticker)

URI NDEF record:

```text
raidr://nfc/v1?token=<token>&merchantId=<merchantUuid>
```

- `token` — required (from Admin/Merchant NFC UI)
- `merchantId` — optional; token alone is enough

Admin/Merchant APIs return `payloadUri` + `programmingHint` ready to copy into an NFC writer app.

---

## Base URLs

| Env | API |
|-----|-----|
| Dev | `http://188.245.72.1:5002/api` |
| Prod | `https://backend.raidr-app.com/api` |

Auth: `Authorization: Bearer <user JWT>` on all player routes.

OpenAPI: `swagger.json` — tags **NFC Visits**, **Admin - NFC**, **Merchant - NFC**  
Merge fragment: `npm run swagger:merge-nfc`

---

## Player APIs

### 1) Verify tap — `POST /nfc/verify`

```json
{
  "payload": "raidr://nfc/v1?token=...&merchantId=...",
  "latitude": 32.0853,
  "longitude": 34.7818,
  "chipUid": "optional-hardware-uid"
}
```

Also accepts `token` alone (or `uri` / `nfcPayload`).

**Response `data` (highlights)**

| Field | Meaning |
|--------|---------|
| `visitId` | Pass to receipt submit |
| `missionCompleted` | First rewarded tap today for this merchant |
| `alreadyVisitedToday` | Already got today’s visit reward |
| `coinsAwarded` / `xpAwarded` | Visit reward (0 if already rewarded) |
| `promptReceipt` | Show “snap receipt?” CTA |
| `receiptUploadReady` | `true` → call `POST /nfc/receipt` |
| `receiptSubmitPath` | `/api/nfc/receipt` |
| `merchant` | id, name, businessName, photoUrl, address |

Default visit reward: **5 coins / 15 XP** (once per user + merchant per UTC day).

---

### 2) Receipt photo — `POST /nfc/receipt`

**Preferred: multipart/form-data**

| Field | Value |
|--------|--------|
| `visitId` | from verify |
| `captureSource` | **`camera`** only |
| `image` | live camera JPEG/PNG (max 10MB) |

**Or JSON** (after `POST /upload/image`):

```json
{
  "visitId": "uuid-from-verify",
  "captureSource": "camera",
  "imageUrl": "https://..."
}
```

**Backend pipeline**

1. Visit must belong to user; within **24h** of tap
2. One receipt per visit
3. Same image hash → reject (409)
4. Same user + merchant + day + amount → reject (409)
5. Gemini Vision (OpenAI fallback) → total + date
6. Date must be today → else 400
7. Bonus: `floor(₪ × coinsPerIls)` / XP (capped)

**Success `data`**

| Field | Example |
|--------|---------|
| `receiptId` | uuid |
| `amountIls` | `48.90` |
| `currency` | `ILS` |
| `coinsAwarded` / `xpAwarded` | bonus |
| `imageUrl` | stored receipt |
| `status` | `approved` |
| `merchant` | business info |

**Common errors**

| Status | When |
|--------|------|
| 400 | Not `camera`, window expired, receipt not today |
| 403 | Visit not yours |
| 409 | Duplicate / already submitted for visit |
| 422 | AI could not read a receipt |

---

### 3) History — `GET /nfc/my-visits?page=1&limit=20`

Returns visits with nested `receipt` when present (`amountIls`, coins, imageUrl, …).

---

## Admin APIs

| Method | Path |
|--------|------|
| `GET` | `/admin/nfc/merchants/:merchantId/tags` (auto-provisions default “Counter” tag) |
| `POST` | `/admin/nfc/merchants/:merchantId/tags` body `{ "label?", "chipUid?" }` |
| `GET` | `/admin/nfc/merchants/:merchantId/visits?page&limit` |

**UI:** Super Admin → Merchants → **NFC** (copy URI, create tags, visit + spend history).

---

## Merchant APIs

| Method | Path |
|--------|------|
| `GET` | `/merchant/nfc/tags` |
| `POST` | `/merchant/nfc/tags` |
| `GET` | `/merchant/nfc/visits?page&limit` |

**UI:** Merchant Hub → **NFC visit tags** (`/nfc`).

Visit tables show **Spend (₪)** when a receipt was approved.

---

## Flutter checklist

1. Request NFC permission / start NFC session.
2. On tag read → parse URI (or token) → `POST /nfc/verify` with GPS if available.
3. If `missionCompleted` → success UI + coins/XP.
4. If `promptReceipt` && `receiptUploadReady` → optional CTA:  
   *“Bought something? Snap a receipt for bonus coins per ₪.”*
5. Open **camera only** (disable gallery / file picker).
6. `POST /nfc/receipt` with `visitId` + `captureSource=camera` + image.
7. Show bonus from response; handle 400 / 409 / 422 with clear copy.

---

## Rewards & env knobs

| Variable | Default | Role |
|----------|---------|------|
| `NFC_VISIT_REWARD_COINS` | `5` | Visit tap coins |
| `NFC_VISIT_REWARD_XP` | `15` | Visit tap XP |
| `NFC_RECEIPT_COINS_PER_ILS` | `1` | Bonus coins per ₪ |
| `NFC_RECEIPT_XP_PER_ILS` | `2` | Bonus XP per ₪ |
| `NFC_RECEIPT_MAX_COINS` | `500` | Cap per receipt |
| `NFC_RECEIPT_MAX_XP` | `1000` | Cap per receipt |
| `NFC_RECEIPT_MIN_AMOUNT_ILS` | `1` | Min accepted total |
| `NFC_RECEIPT_MAX_AMOUNT_ILS` | `5000` | Max accepted total |
| `NFC_RECEIPT_SUBMIT_WINDOW_HOURS` | `24` | Max hours after tap |
| `NFC_RECEIPT_TZ` | `Asia/Jerusalem` | “Today” for receipt date |
| `NFC_RECEIPT_VISION_MODEL` | `gemini-2.0-flash` | Gemini model |
| `GEMINI_KEY` / `OPENAI_API_KEY` | — | Vision (Gemini first) |

Coin sources: `nfc_visit`, `nfc_receipt`.

---

## Database

| Model | Purpose |
|--------|---------|
| `MerchantNfcTag` | Physical sticker (`token`, label, optional `chipUid`) |
| `NfcVisit` | Each successful tap |
| `NfcReceipt` | Approved receipt linked 1:1 to a visit (amount, image hash, fingerprint) |

Migrations:

- `prisma/migrations/20261123220000_nfc_visit_tags/`
- `prisma/migrations/20261124010000_nfc_receipt_phase2/`

---

## Code map

| Area | Path |
|------|------|
| Utils | `utils/nfc/` (`payload`, `visitService`, `receiptService`, `receiptVision`, `receiptRewards`) |
| Player routes | `routes/nfc.js` → `controllers/nfc.js` |
| Admin | `routes/Admin/nfc.js` |
| Merchant | `routes/Merchant/nfc.js` |
| Joi | `schema/nfc.js` |
| Swagger fragment | `swagger-fragments/nfc-visits.json` |
| Tests | `npm run test:nfc` |

---

## Deploy notes (dev)

```bash
cd ~/raidr-backend
git pull origin zeeshan-dev
# apply receipt migration on raidr_postgres_dev if not yet applied
sh scripts/compose-dev-up.sh
curl -s http://127.0.0.1:5002/check-server
```

Dev API: `http://188.245.72.1:5002/api`  
Prod folder is `~/raidr-backend-prod` — do **not** use plain `docker compose up` in the dev folder.
