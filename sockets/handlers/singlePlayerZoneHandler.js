import { prisma } from "../../config/db.js";
import { userVisibleZoneFilter } from "../../utils/singlePlayerConfig.js";
import {
  buildZoneLeaderboard,
  toClientLeaderboardPayload,
} from "../../utils/singlePlayerZoneLeaderboard.js";

/**
 * Subscribe socket to spzone:{zoneId} and send personalized leaderboard snapshot.
 *
 * Client message: { "type": "join_single_player_zone", "zoneId": "uuid" }
 */
export const handleJoinSinglePlayerZoneRoom = async (ws, payload) => {
  const { zoneId } = payload;

  if (!zoneId) {
    ws.send(
      JSON.stringify({
        type: "error",
        msg: "zoneId is required to join a single player zone room",
      })
    );
    return;
  }

  const topic = `spzone:${zoneId}`;
  ws.subscribe(topic);
  console.log(`[SinglePlayerZoneHandler] User ${ws.userId} subscribed to ${topic}`);

  try {
    const zone = await prisma.singlePlayerZone.findFirst({
      where: { id: zoneId, ...userVisibleZoneFilter },
    });

    if (!zone) {
      ws.send(
        JSON.stringify({
          type: "error",
          msg: "Zone not found",
        })
      );
      return;
    }

    if (zone.zoneType !== "NORMAL" && zone.zoneType !== "B2B") {
      ws.send(
        JSON.stringify({
          type: "error",
          msg: "Leaderboard is only available for NORMAL and B2B zones",
        })
      );
      return;
    }

    const built = await buildZoneLeaderboard(prisma, zone, ws.userId);
    const snapshot = toClientLeaderboardPayload(built);

    ws.send(
      JSON.stringify({
        type: "single_player_zone_leaderboard_snapshot",
        ...snapshot,
      })
    );
  } catch (err) {
    console.error("[SinglePlayerZoneHandler] snapshot failed:", err.message);
    ws.send(
      JSON.stringify({
        type: "error",
        msg: "Failed to load zone leaderboard",
      })
    );
  }
};
