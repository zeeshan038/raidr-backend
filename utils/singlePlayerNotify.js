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

export const notifyUserIfAllowed = async (
  prisma,
  userId,
  categoryKey,
  title,
  body
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

  try {
    await sendNotification(user.fcmToken, title, body);
  } catch (err) {
    console.error("[SP Notify]", categoryKey, userId, err?.message || err);
  }
};
