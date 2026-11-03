import { prisma } from "../config/db.js";
import { getSpGameConfig } from "../utils/singlePlayerConfig.js";
import {
  isSinglePlayerZoneTableReady,
  logSinglePlayerCronSkippedOnce,
  handleSinglePlayerSchemaError,
} from "../utils/singlePlayerSchemaReady.js";
import {
  notifyUserIfAllowed,
  SP_NOTIFICATION_CATEGORIES,
} from "../utils/singlePlayerNotify.js";
import { buildPushData, PUSH_TYPE } from "../utils/pushNotificationPayload.js";

/**
 * @Description Shield expiring soon alerts for zone owners
 */
export const startSinglePlayerShieldCron = () => {
  const INTERVAL_MS = 60 * 1000;

  const run = async () => {
    try {
      if (!(await isSinglePlayerZoneTableReady(prisma))) {
        logSinglePlayerCronSkippedOnce("Single Player shield warnings");
        return;
      }

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
          `Your shield on "${zone.name}" expires soon. Your zone will become attackable.`,
          buildPushData({
            type: PUSH_TYPE.SHIELD_EXPIRING,
            zoneId: zone.id,
          })
        );

        await prisma.singlePlayerZone.update({
          where: { id: zone.id },
          data: { shieldWarningSentAt: now },
        });
      }
    } catch (err) {
      if (handleSinglePlayerSchemaError(err, "Single Player shield warnings")) return;
      console.error("[Cron] Single Player shield warnings:", err);
    }
  };

  setInterval(run, INTERVAL_MS);
};
