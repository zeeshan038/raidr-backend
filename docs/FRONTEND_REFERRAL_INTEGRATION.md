# Referral / Invite Friends — Frontend integration guide

> **Audience:** Mobile app (Flutter/React Native) and any client consuming the Raidr user API.  
> **Backend module:** Invite link → friend signs up → **inviter earns 100 coins** (friend does **not** receive referral coins).  
> **Swagger:** `GET /swagger.json` on the API server — tag **Referral** (partial; this doc is the source of truth for responses).

---

## Base URL & auth

| Item | Value |
|------|--------|
| API prefix | `{HOST}/api` |
| Local example | `http://localhost:5001/api` (confirm `PORT` in your env) |
| Auth header | `Authorization: Bearer <JWT>` |
| Public routes | No token |
| Error shape | `{ "status": false, "msg": "..." }` |
| Success shape | `{ "status": true, "data": { ... } }` or `{ "status": true, "msg": "...", "data": { ... } }` |

JWT comes from existing auth: `POST /user/register`, `POST /user/login`, `POST /user/signin-with-google`, `POST /user/signin-with-apple`.

---

## Product rules (do not assume otherwise)

| Rule | Behavior |
|------|----------|
| Who gets coins | **Inviter only** — **100 coins** per successful new signup |
| Friend (invitee) coins | **No** referral bonus; normal new user wallet (default `0` unless other features grant coins) |
| Invalid invite code at signup | Signup **still succeeds**; code is **silently ignored** |
| Self-referral | Prevented server-side (code ignored) |
| One payout per friend | One reward per new account; duplicates cannot farm |
| Existing user login | `inviteCode` on Google/Apple/login is **ignored** (only **new** account creation) |
| Share link format | `https://raidr.app/invite/{CODE}` (server may override base via env; use `shareUrl` from API when possible) |

---

## End-to-end flow

```text
┌─────────────────────────────────────────────────────────────────┐
│ INVITER (logged in)                                              │
│  Settings → "Invite friends"                                     │
│  GET /referral/my-code  → show shareUrl + copy/share sheet       │
│  GET /referral/stats    → friends invited, total coins, list     │
└───────────────────────────────┬─────────────────────────────────┘
                                │ shares link
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRIEND (not logged in)                                           │
│  Opens deep link …/invite/AB7X9K                                 │
│  App stores pending code locally until signup completes          │
│  Optional: POST /referral/validate → show "Referred by {name}"   │
│  Signup with inviteCode in body (register or social)             │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ SERVER (automatic)                                               │
│  Sets referredBy on friend, credits inviter +100, push inviter │
└─────────────────────────────────────────────────────────────────┘
```

**Inviter UX after a friend joins:** Refresh wallet (`GET /user/whoami`) and/or referral stats; inviter may receive push: *"You've earned 100 coins!"*

---

## Deep link & local storage

### URL pattern

- Universal link / app link: `https://raidr.app/invite/AB7X9K`
- Backend also accepts the **full URL string** as `inviteCode` in validate/signup (parses the last path segment).

### Client responsibilities

1. On cold start / link open, parse code from path `/invite/:code`.
2. Persist in secure storage, e.g. key `pendingReferralInviteCode`, until:
   - successfully sent on **new user** signup, or
   - user clears onboarding without signing up (product choice).
3. Pre-fill optional "Invite code" field on signup UI from stored value.
4. Do **not** send stored code on **login** for existing accounts.

### Normalization (optional on client)

Server uppercases codes. You may display uppercase; sending mixed case is fine.

---

## API reference

### 1. Validate invite code (optional UX)

Use before or during signup to show validity and inviter name. **Does not** create users or move coins.

| | |
|---|---|
| **Method / URL** | `POST /api/referral/validate` |
| **Auth** | None |

**Request body** (one of `inviteCode` or `invite_code` is **required**):

```json
{
  "inviteCode": "AB7X9K"
}
```

Or full link:

```json
{
  "inviteCode": "https://raidr.app/invite/AB7X9K"
}
```

**Response `200` — valid**

```json
{
  "status": true,
  "data": {
    "valid": true,
    "inviteCode": "AB7X9K",
    "inviterName": "Alex",
    "rewardCoins": 100
  }
}
```

**Response `200` — invalid** (still `status: true` at top level)

```json
{
  "status": true,
  "data": {
    "valid": false,
    "msg": "Invalid invite code"
  }
}
```

**Response `400`** — missing code in body

```json
{
  "status": false,
  "msg": "Invite code is required"
}
```

**UI suggestion:** If `valid: false`, show a soft warning but still allow signup (server will ignore bad codes).

---

### 2. Get my invite code & share URL

Invite screen primary load.

| | |
|---|---|
| **Method / URL** | `GET /api/referral/my-code` |
| **Auth** | Bearer required |

**Response `200`**

```json
{
  "status": true,
  "data": {
    "inviteCode": "AB7X9K",
    "shareUrl": "https://raidr.app/invite/AB7X9K",
    "rewardCoins": 100
  }
}
```

**UI:** Bind "Share" to `shareUrl`; show copy button for `shareUrl` or `inviteCode`. Display copy like *"Earn 100 coins for each friend who joins"* using `rewardCoins`.

---

### 3. Referral stats (invite screen / settings)

| | |
|---|---|
| **Method / URL** | `GET /api/referral/stats` |
| **Auth** | Bearer required |

**Response `200`**

```json
{
  "status": true,
  "data": {
    "inviteCode": "AB7X9K",
    "shareUrl": "https://raidr.app/invite/AB7X9K",
    "friendsInvited": 3,
    "totalCoinsEarned": 300,
    "rewardCoinsPerReferral": 100,
    "recentRewards": [
      {
        "id": "uuid",
        "rewardCoins": 100,
        "createdAt": "2026-11-02T12:00:00.000Z",
        "invitedUserName": "Sam"
      }
    ]
  }
}
```

**Notes**

- `recentRewards` is capped at **20** entries, newest first.
- `invitedUserName` may be `"Friend"` if name unavailable.

---

### 4. Redeem referral (fallback — rarely needed)

Completes inviter payout if the friend was attributed (`referredBy`) but reward failed earlier. **Coins still go to the inviter**, not the caller.

| | |
|---|---|
| **Method / URL** | `POST /api/referral/redeem` |
| **Auth** | Bearer (typically **invitee** token, right after first signup) |
| **Body** | Empty `{}` or no body |

**Response `200` — nothing to do**

```json
{
  "status": true,
  "msg": "No referral reward to redeem",
  "data": {
    "redeemed": false,
    "reason": "no_referrer"
  }
}
```

**Response `200` — already paid**

```json
{
  "status": true,
  "msg": "Referral reward already redeemed",
  "data": {
    "redeemed": false,
    "alreadyRedeemed": true,
    "rewardCoins": 100
  }
}
```

**Response `200` — payout completed on this call**

```json
{
  "status": true,
  "msg": "Referral reward redeemed",
  "data": {
    "redeemed": true,
    "alreadyRedeemed": false,
    "rewardCoins": 100
  }
}
```

**When to call:** Optional once after first signup if you want a safety net. Happy path does **not** require this — signup already triggers payout.

---

## Signup: attach invite code (required for attribution)

Send **`inviteCode`** or **`invite_code`** only when creating a **new** account.

### Email register

| | |
|---|---|
| **Method / URL** | `POST /api/user/register` |
| **Auth** | None |

**Body** (existing fields + optional referral):

```json
{
  "name": "Sam",
  "email": "sam@example.com",
  "password": "password123",
  "agreedToTerms": true,
  "inviteCode": "AB7X9K"
}
```

**Response:** Unchanged from existing register (`token`, `user`, etc.). No referral-specific fields in response — verify inviter side via stats/wallet.

**Edge case:** Resuming signup for an **existing unverified** email updates password only — referral is **not** applied on that path (new-user create only).

---

### Google sign-in (new user)

| | |
|---|---|
| **Method / URL** | `POST /api/user/signin-with-google` |
| **Auth** | None |

```json
{
  "firebaseToken": "<Firebase ID token>",
  "inviteCode": "AB7X9K"
}
```

Apply when response indicates a **new** user (e.g. `user.isNewUser === true`). If existing user, ignore stored referral code and clear pending storage.

---

### Apple sign-in (new user)

| | |
|---|---|
| **Method / URL** | `POST /api/user/signin-with-apple` |
| **Auth** | None |

Same body shape as Google (`firebaseToken` + optional `inviteCode`).

---

## Screen checklist

| Screen | APIs | Notes |
|--------|------|--------|
| Settings entry | — | Navigate to Invite |
| Invite / Earn coins | `GET /referral/my-code`, `GET /referral/stats` | Share `shareUrl`; show stats |
| Signup (manual) | `POST /referral/validate` (optional), `POST /user/register` | Include pending `inviteCode` |
| Signup (Google/Apple) | optional validate, social POST with `inviteCode` | Only on new user |
| Inviter wallet | `GET /user/whoami` | `raidrCoins` after friend joins |
| Post-signup (optional) | `POST /referral/redeem` | Invitee token, once |

---

## TypeScript types (optional)

```typescript
type ApiError = { status: false; msg: string };

type ReferralValidateData =
  | { valid: true; inviteCode: string; inviterName: string; rewardCoins: number }
  | { valid: false; msg: string };

type ReferralMyCodeData = {
  inviteCode: string;
  shareUrl: string;
  rewardCoins: number;
};

type ReferralRecentReward = {
  id: string;
  rewardCoins: number;
  createdAt: string;
  invitedUserName: string;
};

type ReferralStatsData = {
  inviteCode: string | null;
  shareUrl: string | null;
  friendsInvited: number;
  totalCoinsEarned: number;
  rewardCoinsPerReferral: number;
  recentRewards: ReferralRecentReward[];
};

type ReferralRedeemData = {
  redeemed: boolean;
  alreadyRedeemed?: boolean;
  reason?: string;
  rewardCoins?: number;
};
```

---

## Example client helper (pseudo-Dart/TS)

```typescript
const PENDING_REFERRAL_KEY = "pendingReferralInviteCode";

function parseInviteFromUrl(url: string): string | null {
  const match = url.match(/\/invite\/([A-Za-z0-9]+)\/?$/i);
  return match ? match[1].toUpperCase() : null;
}

async function signupWithReferral(registerFn: (body: object) => Promise<void>) {
  const pending = await storage.get(PENDING_REFERRAL_KEY);
  const body: Record<string, unknown> = { /* name, email, password, agreedToTerms */ };
  if (pending) body.inviteCode = pending;
  await registerFn(body);
  await storage.remove(PENDING_REFERRAL_KEY);
}
```

---

## Testing (Postman / QA)

1. Register **User A** → login → `GET /referral/my-code` → copy `inviteCode`.
2. `POST /referral/validate` with that code → `valid: true`.
3. Register **User B** with `"inviteCode": "<code>"`.
4. As **User A**: `GET /referral/stats` → `friendsInvited: 1`, `totalCoinsEarned: 100`; `GET /user/whoami` → `raidrCoins` increased by 100.
5. As **User B**: wallet unchanged by referral (no +100 for B).

---

## Cursor / AI agent hint

When implementing in the app repo, point the agent at this file and:

- Wire deep links to `pendingReferralInviteCode`.
- Implement Invite screen against `my-code` + `stats`.
- Pass `inviteCode` only on **new** signup routes above.
- Do not show "You earned 100 coins" to the **friend** unless product adds invitee bonus later.

---

## Changelog

| Date | Notes |
|------|--------|
| 2026-11-02 | Initial referral module — inviter-only 100 coins, four `/referral/*` endpoints |
