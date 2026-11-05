import { redis } from "../services/redis.js";

/**
 * Broadcast to all sockets subscribed to spzone:{zoneId}
 * (join via type join_single_player_zone on /live-tracking).
 */
export const publishToSinglePlayerZone = (zoneId, payload) => {
  if (!zoneId) return;
  payload.zoneId = zoneId;
  const topic = `spzone:${zoneId}`;
  redis.publish("ws_broadcast", JSON.stringify({ topic, payload }));
};
