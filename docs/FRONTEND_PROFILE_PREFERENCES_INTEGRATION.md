# Profile preferences onboarding — Frontend integration guide

> **Audience:** Flutter / mobile team  
> **Backend routes:** `routes/user.js` — profile preferences endpoints  
> **Swagger:** `{HOST}/swagger.json` — tag **User Profile** (this doc is authoritative for slugs & optional fields)

---

## Base URL & auth

| Item | Value |
|------|--------|
| API prefix | `{HOST}/api` |
| **Production** | `https://backend.raidr-app.com/api` or `https://backend-prod.raidr-app.com/api` (confirm with backend) |
| **Dev (Hetzner)** | `http://188.245.72.1:5002/api` |
| **Local backend** | `http://localhost:5001/api` |
| Auth | `Authorization: Bearer <JWT>` on all routes below |
| Errors | `{ "status": false, "msg": "..." }` |
| Success | `{ "status": true, ... }` |

JWT from: `POST /user/login`, `/user/register`, `/user/signin-with-google`, `/user/signin-with-apple`.

**Important:** Use one base URL per app flavor. Dev builds must not call production URLs.

---

## Product flow (5-step onboarding)

```text
Register / Login
       │
       ▼
GET /user/whoami  ── user.preferences === false? ──► Show onboarding wizard
       │
       ├── Steps 1–2: Home location (static UI + maps / search-location)
       ├── Step 3: Gender & age (static UI — send slugs, see tables below)
       ├── Step 4: Interests — load from GET /profile-preferences/options (data.interests)
       └── Step 5: (if any) Raid cities or summary
       │
       ▼
POST /user/profile-preferences  (once at end, or when product saves)
       │
       ▼
user.preferences === true  →  main app
```

| Screen | Data source | Send to API |
|--------|-------------|-------------|
| Home address / city | Static + `POST /user/search-location` (optional) | `homeAddress`, `homeCityLabel`, `homeLatitude`, `homeLongitude` |
| Gender & age | **Static** (Figma) | `genderOptionId`, `ageRangeOptionId` as **slugs** (`male`, `25_34`, …) |
| Raid cities | Static or API | `raidCityOptionIds` as slugs or UUIDs |
| **What are you into?** | **`GET /profile-preferences/options`** → `data.interests` | `interestOptionIds`: UUID **or** slug per item |

Field names stay `*OptionId` for backward compatibility; values may be **slug strings**, not only UUIDs.

---

## When to show onboarding

`GET /api/user/whoami` returns `user.preferences` (boolean):

- `false` — show onboarding; user has not completed `POST /profile-preferences` successfully.
- `true` — skip onboarding (unless you add a separate “edit profile” entry).

Backend sets `preferences: true` on successful **POST /profile-preferences**.

---

## Option values: slugs vs UUIDs

For these JSON fields the server accepts **either**:

1. **Slug** — recommended for static screens (`male`, `fashion`, `tel_aviv`).
2. **UUID** — from `GET /profile-preferences/options` (recommended for interests loaded from API).

Server normalizes some labels (e.g. `"Male"` → `male`, `"25 - 34"` → `25_34`, `"65+"` → `65_plus`).

Invalid or unknown slug → `400` with message like `Invalid GENDER option: …`.

---

## API reference

### 1. Get option lists (interests screen)

| | |
|---|---|
| **GET** | `/api/user/profile-preferences/options` |
| **Auth** | Bearer |

**200 response:**

```json
{
  "status": true,
  "data": {
    "genders": [
      { "id": "uuid", "type": "GENDER", "label": "Male", "slug": "male", "iconKey": "male", "sortOrder": 1 }
    ],
    "ageRanges": [ "... same shape ..." ],
    "raidCities": [ "... same shape ..." ],
    "interests": [
      {
        "id": "uuid",
        "label": "Fashion",
        "slug": "fashion",
        "subtitle": "Clothes & Accessories",
        "iconKey": "fashion",
        "accentColor": "#3B82F6",
        "sortOrder": 2
      }
    ]
  }
}
```

**Client use:**

- **Step 4 (interests):** Build grid from `data.interests` (label, subtitle, iconKey, accentColor).
- On submit you may send each selected item’s **`slug`** or **`id`** in `interestOptionIds`.
- Steps 3 / cities: you may skip this GET if UI is fully static and you use slugs from the tables below.

---

### 2. Save onboarding (first time)

| | |
|---|---|
| **POST** | `/api/user/profile-preferences` |
| **Auth** | Bearer |
| **Content-Type** | `application/json` |

**Required body fields**

| Field | Type | Notes |
|-------|------|--------|
| `homeAddress` | string | Non-empty |
| `homeCityLabel` | string | Non-empty |

**Optional body fields**

| Field | Type | Notes |
|-------|------|--------|
| `homeLatitude` | number | |
| `homeLongitude` | number | |
| `genderOptionId` | string | Slug or UUID |
| `ageRangeOptionId` | string | Slug or UUID |
| `raidCityOptionIds` | string[] | Slugs or UUIDs |
| `interestOptionIds` | string[] | Slugs or UUIDs; min 1 if array is sent |

**Example (static slugs — copy/paste Postman):**

```json
{
  "homeAddress": "Islamabad, Pakistan",
  "homeCityLabel": "Islamabad",
  "homeLatitude": 33.699619,
  "homeLongitude": 73.036187,
  "genderOptionId": "male",
  "ageRangeOptionId": "25_34",
  "raidCityOptionIds": ["jerusalem"],
  "interestOptionIds": ["fashion", "events", "cosmetics"]
}
```

**Minimal example (home only — options omitted):**

```json
{
  "homeAddress": "Test Home",
  "homeCityLabel": "Islamabad"
}
```

**200 response (shape):**

```json
{
  "status": true,
  "msg": "Profile preferences saved",
  "preferences": true,
  "data": {
    "homeAddress": "...",
    "homeCityLabel": "...",
    "homeLatitude": null,
    "homeLongitude": null,
    "gender": { "id": "...", "label": "Male", "slug": "male", ... },
    "ageRange": { ... },
    "raidCities": [ ... ],
    "interests": [ ... ]
  },
  "user": { "...": "sanitized user fields", "preferences": true }
}
```

Use `data` for display after save; refresh local user from `user` or call `whoami` again.

---

### 3. Update after onboarding (settings)

| | |
|---|---|
| **POST** | `/api/user/update-profile-preferences` |
| **Auth** | Bearer |

Partial update: send **at least one** field. Same slug/UUID rules as save.

Requires an existing row from POST #2; otherwise **404**:

```json
{
  "status": false,
  "msg": "Profile preferences not found. Complete onboarding with POST /profile-preferences first."
}
```

**Example — change interests only:**

```json
{
  "interestOptionIds": ["fashion", "vacations"]
}
```

---

## Default slugs (must match server seed)

Use these in static UI when not using UUIDs. Admin may add options later; interests screen should prefer **GET options** for new categories.

### Gender (`genderOptionId`)

| UI label | slug |
|----------|------|
| Male | `male` |
| Female | `female` |
| Other | `other` |
| Prefer not to say | `prefer_not_to_say` |

### Age range (`ageRangeOptionId`)

| UI label | slug |
|----------|------|
| Under 18 | `under_18` |
| 18 - 24 | `18_24` |
| 25 - 34 | `25_34` |
| 35 - 44 | `35_44` |
| 45 - 54 | `45_54` |
| 55 - 64 | `55_64` |
| 65+ | `65_plus` |

### Raid cities (`raidCityOptionIds[]`)

| City | slug |
|------|------|
| Tel Aviv | `tel_aviv` |
| Jerusalem | `jerusalem` |
| Haifa | `haifa` |
| Rishon LeZion | `rishon_lezion` |
| Petah Tikva | `petah_tikva` |
| Netanya | `netanya` |

### Interests (`interestOptionIds[]`)

| UI label | slug |
|----------|------|
| All Categories | `all_categories` |
| Fashion | `fashion` |
| Cosmetics | `cosmetics` |
| Sports Equipment | `sports` |
| Events | `events` |
| Toys | `toys` |
| Toddler Equipment | `toddler` |
| Vacations | `vacations` |

---

## Flutter implementation checklist

- [ ] Map app flavor → correct `{HOST}/api` (dev **5002** vs prod domain).
- [ ] After login, `GET /user/whoami` → gate on `user.preferences`.
- [ ] **Step 4:** `GET /profile-preferences/options` → render `data.interests`.
- [ ] On finish onboarding, `POST /profile-preferences` with home fields + slugs (and/or interest UUIDs from step 4).
- [ ] Do **not** send display labels as IDs unless they normalize to a valid slug (prefer explicit slugs from table).
- [ ] Settings edit: `POST /update-profile-preferences` with only changed fields.
- [ ] Handle `400` / `500` — show `msg` to user.

---

## Common errors

| msg | Cause |
|-----|--------|
| `"genderOptionId" must be a valid GUID` | Old backend build; deploy latest API (slug support). |
| `Invalid GENDER option: …` | Wrong slug or option not seeded on that environment’s DB. |
| `The table ProfilePreferenceOption does not exist` | DB migration/seed not applied on server for that API’s database. |
| `GET options` returns empty arrays | Run backend seed on that environment; then retry. |

---

## Postman quick test

1. `POST {{BASE}}/user/login` → token  
2. `GET {{BASE}}/user/profile-preferences/options`  
3. `POST {{BASE}}/user/profile-preferences` with JSON example above  

---

## Related docs

- Referral: `docs/FRONTEND_REFERRAL_INTEGRATION.md`
- Dev Docker URLs: `docs/DEV_DOCKER_SAME_SERVER_AS_PROD.md`
