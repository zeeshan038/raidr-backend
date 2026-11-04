/** FCM data `type` — routing / deep link (snake_case). */
export const PUSH_TYPE = {
  RARE_DROP_SPAWNED: "rare_drop_spawned",
  SHIELD_EXPIRING: "shield_expiring",
  ZONE_UNDER_ATTACK: "zone_under_attack",
  ZONE_SNATCHED: "zone_snatched",
  B2B_RIVALRY_MILESTONE: "b2b_rivalry_milestone",
  B2B_REWARD_CLAIMED: "b2b_reward_claimed",
  BRAND_MONTH_REWARD: "brand_month_reward",
  COIN_RUSH_STARTS_20M: "coin_rush_starts_20m",
  COIN_RUSH_STARTS_10M: "coin_rush_starts_10m",
  COIN_RUSH_LIVE: "coin_rush_live",
  COIN_RUSH_COMPLETED: "coin_rush_completed",
  COIN_RUSH_SCHEDULED_NEARBY: "coin_rush_scheduled_nearby",
  LIVE_RAID_NEW_NEARBY: "live_raid_new_nearby",
  LIVE_RAID_STARTS_20M: "live_raid_starts_20m",
  LIVE_RAID_STARTS_10M: "live_raid_starts_10m",
  LIVE_RAID_LIVE: "live_raid_live",
  LIVE_RAID_COMPLETED: "live_raid_completed",
  REFERRAL_REWARD: "referral_reward",
  TEST: "test",
};

export const EVENT_KIND = {
  COIN_RUSH: "coin_rush",
  LIVE_RAID: "live_raid",
};

/**
 * Build FCM data map (all string values). Omits null/undefined/empty.
 */
export const buildPushData = (fields) => {
  const data = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === "") continue;
    data[key] = String(value);
  }
  return data;
};
