import { prisma } from "../config/db.js";
import { getSpGameConfig } from "../utils/singlePlayerConfig.js";
import { parseJsonIntArray } from "../utils/configJson.js";
import { haversineDistance } from "../utils/methods/methods.js";
import {
  notifyUserIfAllowed,
  SP_NOTIFICATION_CATEGORIES,
} from "../utils/singlePlayerNotify.js";

const RIVALRY_RADIUS_M = 5000;

/**
 * @Description B2B rivalry milestone pushes to nearby players
 */
export const startSinglePlayerRivalryCron = () => {
  const INTERVAL_MS = 5 * 60 * 1000;

  const run = async () => {
    try {
      const configRow = await getSpGameConfig(prisma);
      const milestones = parseJsonIntArray(configRow.rivalryMilestoneHours, [24, 48]);
      if (milestones.length === 0) return;

      const now = Date.now();
      const zones = await prisma.singlePlayerZone.findMany({
        where: {
          zoneType: "B2B",
          approvalStatus: "approved",
          isActive: true,
          currentOwnerId: { not: null },
          holdStartedAt: { not: null },
        },
        include: {
          owner: { select: { name: true } },
        },
      });

      for (const zone of zones) {
        const elapsedHours =
          (now - new Date(zone.holdStartedAt).getTime()) / (60 * 60 * 1000);

        for (const milestone of milestones) {
          if (elapsedHours < milestone) continue;

          const sent = await prisma.singlePlayerRivalryAlert.findUnique({
            where: {
              zoneId_milestoneHours: { zoneId: zone.id, milestoneHours: milestone },
            },
          });
          if (sent) continue;

          const users = await prisma.user.findMany({
            where: {
              fcmToken: { not: null },
              id: { not: zone.currentOwnerId },
            },
            select: { id: true, fcmToken: true, lat: true, long: true },
          });

          const nearby = users.filter((u) => {
            if (!u.lat || !u.long) return false;
            const dist = haversineDistance(
              parseFloat(zone.latitude),
              parseFloat(zone.longitude),
              parseFloat(u.lat),
              parseFloat(u.long)
            );
            return dist <= RIVALRY_RADIUS_M;
          });

          for (const u of nearby) {
            await notifyUserIfAllowed(
              prisma,
              u.id,
              SP_NOTIFICATION_CATEGORIES.B2B_RIVALRY,
              "Nearby B2B streak",
              `${zone.name}: a rival has held for ${milestone}h. Visit and break the streak!`
            );
          }

          await prisma.singlePlayerRivalryAlert.create({
            data: { zoneId: zone.id, milestoneHours: milestone },
          });
        }
      }
    } catch (err) {
      console.error("[Cron] Single Player rivalry:", err);
    }
  };

  setInterval(run, INTERVAL_MS);
};
