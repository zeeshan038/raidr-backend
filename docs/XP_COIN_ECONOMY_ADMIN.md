# XP & Coin economy (admin-configurable)

Approved balancing values live on the singleton row `SinglePlayerGameConfig` (`id = default`).

## Super Admin

**Single Player → Game config** — section **XP & coin economy**. Saves via `PUT /api/admin/single-player/config`.

## Mobile / client labels

`GET /api/single-player/game-config` includes economy hints (`dailyDropCoinsNormal`, `liveEventRedeemCoins`, referral amounts, etc.) alongside existing capture/guard fields.

## Referrals

Inviter rewards (**coins + XP**) are paid when the invitee completes a **qualifying activity** (daily drop collect, live event redeem, coin rush checkpoint, or merchant ad claim)—not at signup. `POST /api/referral/redeem` remains an idempotent fallback.

## Passive zone income

Cron uses each zone’s `coinsPerHour`, VIP multiplier, coin boost, and **`passiveCoinsDailyCapPerUser`** (UTC day).

## Avatars

Coin **prices** remain per item in the admin store (`/admin/store`); economy config does not replace individual avatar rows.

See client PDF: `docs/Coins/RAIDR_XP_Coin_Economy_Recommendation.pdf`.
