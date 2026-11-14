export const LIVE_EVENT_DISPLAY = {
  LIVE_MULTIPLAYER: "LIVE_MULTIPLAYER",
  SILENT_MAP_DROP: "SILENT_MAP_DROP",
};

export const LIVE_EVENT_COLLECTION = {
  GPS_INSTANT: "GPS_INSTANT",
  BUSINESS_QR: "BUSINESS_QR",
};

export const isSilentMapDrop = (event) =>
  event?.displayMode === LIVE_EVENT_DISPLAY.SILENT_MAP_DROP;

export const isLiveMultiplayerEvent = (event) =>
  !event?.displayMode || event.displayMode === LIVE_EVENT_DISPLAY.LIVE_MULTIPLAYER;

export const QR_ARM_REDIS_PREFIX = "silent_drop:qr_arm:";
export const QR_ARM_TTL_SEC = 20 * 60;

export const qrArmRedisKey = (userId, eventId) =>
  `${QR_ARM_REDIS_PREFIX}${userId}:${eventId}`;
