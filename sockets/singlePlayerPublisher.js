import { publishToUser } from "./eventPublisher.js";

/**
 * Notify zone owner in real time (WebSocket topic user:{ownerId}).
 * Mobile must connect to ws /live-tracking?token=... — auto-subscribed to user channel.
 */
export const publishGuardEliminatedToOwner = (ownerId, payload) => {
  if (!ownerId) return;
  publishToUser(ownerId, {
    type: "single_player_guard_eliminated",
    ...payload,
  });
};

export const publishZoneCaptureStartedToOwner = (ownerId, payload) => {
  if (!ownerId) return;
  publishToUser(ownerId, {
    type: "single_player_zone_under_attack",
    ...payload,
  });
};
