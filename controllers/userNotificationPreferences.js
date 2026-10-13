import { prisma } from "../config/db.js";
import { getOrCreateNotificationPrefs } from "../utils/singlePlayerNotify.js";
import { UpdateNotificationPrefsSchema } from "../schema/UserNotificationPrefs.js";

/**
 * @Description Get in-app notification preferences (master + categories)
 * @Route GET /api/user/notification-preferences
 * @Access Private
 */
export const getNotificationPreferences = async (req, res) => {
  try {
    const prefs = await getOrCreateNotificationPrefs(prisma, req.user.id);
    res.status(200).json({ status: true, data: prefs });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Update notification preferences
 * @Route PATCH /api/user/notification-preferences
 * @Access Private
 */
export const updateNotificationPreferences = async (req, res) => {
  const result = UpdateNotificationPrefsSchema(req.body);
  if (result.error) {
    return res.status(400).json({ status: false, msg: result.error.message });
  }

  try {
    await getOrCreateNotificationPrefs(prisma, req.user.id);
    const updated = await prisma.userNotificationPreference.update({
      where: { userId: req.user.id },
      data: result.value,
    });
    res.status(200).json({
      status: true,
      msg: "Notification preferences updated",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};
