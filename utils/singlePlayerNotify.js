import { sendNotification } from "./Notification.js";

/** Maps preference column names for each notification category. */
export const SP_NOTIFICATION_CATEGORIES = {
  DAILY_DROP: "dailyDropReminders",
  RARE_DROP: "rareDropAlerts",
  SHIELD: "raidZoneShield",
  ATTACK_SNATCH: "zoneAttackSnatch",
  B2B_RIVALRY: "b2bRivalryNearby",
  REWARDS: "rewardsVoucher",
  COIN_RUSH: "eventsCoinRush",
  PROMO: "promotionalSponsored",
};

export const getOrCreateNotificationPrefs = async (prisma, userId) => {
  let prefs = await prisma.userNotificationPreference.findUnique({
    where: { userId },
  });
  if (!prefs) {
    prefs = await prisma.userNotificationPreference.create({
      data: { userId },
    });
  }
  return prefs;
};

const deliverPush = async (fcmToken, title, body, data) => {
  try {
    await sendNotification(fcmToken, title, body, data);
  } catch (err) {
    console.error("[Push]", err?.message || err);
  }
};

/**
 * Respects master + category preference toggles.
 * @param {Record<string, string>} [data] FCM data; should include `category` matching categoryKey.
 */
export const notifyUserIfAllowed = async (
  prisma,
  userId,
  categoryKey,
  title,
  body,
  data
) => {
  if (!userId || !categoryKey) return;

  const prefs = await getOrCreateNotificationPrefs(prisma, userId);
  if (!prefs.masterEnabled) return;
  if (prefs[categoryKey] === false) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcmToken: true },
  });

  if (!user?.fcmToken) return;

  const payload = {
    ...data,
    category: data?.category ?? categoryKey,
  };

  await deliverPush(user.fcmToken, title, body, payload);
};

/** Master toggle only (no category pref). Used for live-raid participant alerts, referrals, etc. */
export const notifyUserIfMasterEnabled = async (
  prisma,
  userId,
  title,
  body,
  data
) => {
  if (!userId) return;

  const prefs = await getOrCreateNotificationPrefs(prisma, userId);
  if (!prefs.masterEnabled) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcmToken: true },
  });

  if (!user?.fcmToken) return;

  await deliverPush(user.fcmToken, title, body, data);
};
