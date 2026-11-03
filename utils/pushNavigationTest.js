import {
  buildPushData,
  EVENT_KIND,
  PUSH_TYPE,
} from "./pushNotificationPayload.js";
import { SP_NOTIFICATION_CATEGORIES } from "./singlePlayerNotify.js";

/** Default UUIDs for navigation testing when IDs are omitted in the request body. */
export const PUSH_NAV_PLACEHOLDER_IDS = {
  zoneId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  dropId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  eventId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
  claimId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd4",
  userVoucherId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5",
  campaignId: "ffffffff-ffff-4fff-8fff-fffffffffff6",
};

const C = SP_NOTIFICATION_CATEGORIES;

/**
 * @type {Record<string, {
 *   category?: string,
 *   title: string,
 *   body: string,
 *   eventKind?: string,
 *   idFields: string[],
 *   milestoneHours?: string,
 * }>}
 */
export const PUSH_NAV_TEST_CASES = {
  [PUSH_TYPE.RARE_DROP_SPAWNED]: {
    category: C.RARE_DROP,
    title: "[Test] Rare drop spawned",
    body: "Tap to open the map and collect the rare drop.",
    idFields: ["dropId"],
  },
  [PUSH_TYPE.SHIELD_EXPIRING]: {
    category: C.SHIELD,
    title: "[Test] Shield expiring soon",
    body: "Your zone shield is about to expire.",
    idFields: ["zoneId"],
  },
  [PUSH_TYPE.ZONE_UNDER_ATTACK]: {
    category: C.ATTACK_SNATCH,
    title: "[Test] Your zone is under attack",
    body: "Someone started capturing your zone.",
    idFields: ["zoneId"],
  },
  [PUSH_TYPE.ZONE_SNATCHED]: {
    category: C.ATTACK_SNATCH,
    title: "[Test] Zone snatched",
    body: "You lost your zone to another player.",
    idFields: ["zoneId"],
  },
  [PUSH_TYPE.B2B_RIVALRY_MILESTONE]: {
    category: C.B2B_RIVALRY,
    title: "[Test] Nearby B2B streak",
    body: "A rival has held a B2B zone for 24h. Break the streak!",
    idFields: ["zoneId"],
    milestoneHours: "24",
  },
  [PUSH_TYPE.B2B_REWARD_CLAIMED]: {
    category: C.REWARDS,
    title: "[Test] B2B reward ready",
    body: "You claimed a B2B hold reward.",
    idFields: ["claimId", "zoneId"],
  },
  [PUSH_TYPE.BRAND_MONTH_REWARD]: {
    category: C.REWARDS,
    title: "[Test] Brand Month reward unlocked",
    body: "Open RAIDR to view your voucher.",
    idFields: ["userVoucherId", "campaignId"],
  },
  [PUSH_TYPE.COIN_RUSH_STARTS_20M]: {
    category: C.COIN_RUSH,
    title: "[Test] Coin Rush starts in 20 minutes",
    body: "Warm up and get ready to collect coins.",
    eventKind: EVENT_KIND.COIN_RUSH,
    idFields: ["eventId"],
  },
  [PUSH_TYPE.COIN_RUSH_STARTS_10M]: {
    category: C.COIN_RUSH,
    title: "[Test] Coin Rush in 10 minutes",
    body: "Join now and race to collect coins.",
    eventKind: EVENT_KIND.COIN_RUSH,
    idFields: ["eventId"],
  },
  [PUSH_TYPE.COIN_RUSH_LIVE]: {
    category: C.COIN_RUSH,
    title: "[Test] Coin Rush is live",
    body: "Race to hit checkpoints and grab the reward.",
    eventKind: EVENT_KIND.COIN_RUSH,
    idFields: ["eventId"],
  },
  [PUSH_TYPE.COIN_RUSH_COMPLETED]: {
    category: C.COIN_RUSH,
    title: "[Test] Coin Rush completed",
    body: "See if you made it to the top.",
    eventKind: EVENT_KIND.COIN_RUSH,
    idFields: ["eventId"],
  },
  [PUSH_TYPE.COIN_RUSH_SCHEDULED_NEARBY]: {
    category: C.COIN_RUSH,
    title: "[Test] New Coin Rush scheduled nearby",
    body: "A Coin Rush was scheduled near you.",
    eventKind: EVENT_KIND.COIN_RUSH,
    idFields: ["eventId"],
  },
  [PUSH_TYPE.LIVE_RAID_NEW_NEARBY]: {
    category: C.PROMO,
    title: "[Test] A new raid appeared",
    body: "A live raid is near you.",
    eventKind: EVENT_KIND.LIVE_RAID,
    idFields: ["eventId"],
  },
  [PUSH_TYPE.LIVE_RAID_STARTS_20M]: {
    title: "[Test] Your raid starts in 20 minutes",
    body: "Get ready — your registered raid begins soon.",
    eventKind: EVENT_KIND.LIVE_RAID,
    idFields: ["eventId"],
  },
  [PUSH_TYPE.LIVE_RAID_STARTS_10M]: {
    category: C.PROMO,
    title: "[Test] Raid begins in 10 minutes",
    body: "A live raid goes live soon near you.",
    eventKind: EVENT_KIND.LIVE_RAID,
    idFields: ["eventId"],
  },
  [PUSH_TYPE.LIVE_RAID_LIVE]: {
    category: C.PROMO,
    title: "[Test] The raid is live",
    body: "Head there now and secure your rewards.",
    eventKind: EVENT_KIND.LIVE_RAID,
    idFields: ["eventId"],
  },
  [PUSH_TYPE.LIVE_RAID_COMPLETED]: {
    title: "[Test] Raid completed",
    body: "Thanks for joining the live raid.",
    eventKind: EVENT_KIND.LIVE_RAID,
    idFields: ["eventId"],
  },
  [PUSH_TYPE.REFERRAL_REWARD]: {
    title: "[Test] Referral reward",
    body: "You earned coins from a referral.",
    idFields: [],
  },
  [PUSH_TYPE.TEST]: {
    title: "[Test] Generic test push",
    body: "No navigation payload.",
    idFields: [],
  },
};

export const listPushNavigationTestTypes = () =>
  Object.entries(PUSH_NAV_TEST_CASES).map(([type, spec]) => ({
    type,
    category: spec.category ?? null,
    title: spec.title,
    body: spec.body,
    eventKind: spec.eventKind ?? null,
    idFields: spec.idFields,
    placeholderIds: spec.idFields.reduce((acc, key) => {
      acc[key] = PUSH_NAV_PLACEHOLDER_IDS[key] ?? null;
      return acc;
    }, {}),
  }));

export const buildPushNavigationTestPayload = (type, overrides = {}) => {
  const spec = PUSH_NAV_TEST_CASES[type];
  if (!spec) {
    return { error: `Unknown type "${type}". Use GET /test/push-navigation/types for valid values.` };
  }

  const dataFields = {
    type,
    category: overrides.category ?? spec.category,
    eventKind: overrides.eventKind ?? spec.eventKind,
    milestoneHours: overrides.milestoneHours ?? spec.milestoneHours,
  };

  for (const key of spec.idFields) {
    dataFields[key] =
      overrides[key] ?? PUSH_NAV_PLACEHOLDER_IDS[key] ?? "00000000-0000-4000-8000-000000000001";
  }

  if (overrides.zoneId && !spec.idFields.includes("zoneId")) {
    dataFields.zoneId = overrides.zoneId;
  }
  if (overrides.dropId && !spec.idFields.includes("dropId")) {
    dataFields.dropId = overrides.dropId;
  }
  if (overrides.eventId && !spec.idFields.includes("eventId")) {
    dataFields.eventId = overrides.eventId;
  }

  const data = buildPushData(dataFields);

  return {
    title: overrides.title ?? spec.title,
    body: overrides.body ?? spec.body,
    data,
  };
};

export const isPushNavigationTestAllowed = (req) => {
  const secret = process.env.PUSH_NAV_TEST_SECRET;
  if (!secret) return true;
  const provided =
    req.body?.secret ??
    req.headers["x-push-test-secret"] ??
    req.query?.secret;
  return provided === secret;
};
