import { prisma } from "../config/db.js";
import { redis } from "../config/redis.js";
import {
  notifyUserIfAllowed,
  SP_NOTIFICATION_CATEGORIES,
} from "../utils/singlePlayerNotify.js";

/**
 * @Description Remind users with an uncollected daily drop (respects notification prefs)
 */
export const startDailyDropReminderCron = () => {
  const INTERVAL_MS = 60 * 60 * 1000;

  const run = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const uncollected = await prisma.dailyDrop.findMany({
        where: {
          createdAt: { gte: today },
          isCollected: false,
        },
        select: { userId: true },
        distinct: ["userId"],
      });

      const dayKey = today.toISOString().slice(0, 10);

      for (const row of uncollected) {
        const dedupeKey = `daily_drop_reminder:${row.userId}:${dayKey}`;
        const set = await redis.set(dedupeKey, "1", "EX", 86400, "NX");
        if (set !== "OK") continue;

        await notifyUserIfAllowed(
          prisma,
          row.userId,
          SP_NOTIFICATION_CATEGORIES.DAILY_DROP,
          "Daily Drop waiting",
          "Your Daily Drop is nearby — open RAIDR to collect it."
        );
      }
    } catch (err) {
      console.error("[Cron] Daily drop reminder:", err);
    }
  };

  setInterval(run, INTERVAL_MS);
};
