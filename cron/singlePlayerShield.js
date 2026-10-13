import { prisma } from "../config/db.js";
import { getSpGameConfig } from "../utils/singlePlayerConfig.js";
import {
  notifyUserIfAllowed,
  SP_NOTIFICATION_CATEGORIES,
} from "../utils/singlePlayerNotify.js";

/**
 * @Description Shield expiring soon alerts for zone owners
 */
export const startSinglePlayerShieldCron = () => {
  const INTERVAL_MS = 60 * 1000;

  const run = async () => {
    try {
      const configRow = await getSpGameConfig(prisma);
      const minutesBefore = configRow.shieldWarningMinutesBefore ?? 15;
      const now = new Date();
      const warnBefore = new Date(now.getTime() + minutesBefore * 60 * 1000);

      const zones = await prisma.singlePlayerZone.findMany({
        where: {
          currentOwnerId: { not: null },
          shieldExpiresAt: { gt: now, lte: warnBefore },
          shieldWarningSentAt: null,
        },
      });

      for (const zone of zones) {
        await notifyUserIfAllowed(
          prisma,
          zone.currentOwnerId,
          SP_NOTIFICATION_CATEGORIES.SHIELD,
          "Shield expiring soon",
          `Your shield on "${zone.name}" expires soon. Your zone will become attackable.`
        );

        await prisma.singlePlayerZone.update({
          where: { id: zone.id },
          data: { shieldWarningSentAt: now },
        });
      }
    } catch (err) {
      console.error("[Cron] Single Player shield warnings:", err);
    }
  };

  setInterval(run, INTERVAL_MS);
};
