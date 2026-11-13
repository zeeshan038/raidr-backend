import { redis } from "../config/redis.js";
import { prisma } from "../config/db.js";
import {
  executeBusinessQrClaim,
  executeGpsInstantClaim,
  assertWithinCollectRadius,
  formatSilentDropForClient,
} from "../utils/liveEventClaim.js";
import {
  isSilentMapDrop,
  LIVE_EVENT_DISPLAY,
  qrArmRedisKey,
  QR_ARM_TTL_SEC,
} from "../utils/liveEventModes.js";

export const silentDropProximityCheck = async (req, res) => {
  const userId = req.user.id;
  const { id: eventId } = req.params;
  const { latitude, longitude } = req.body;

  try {
    if (!latitude || !longitude) {
      return res.status(400).json({
        status: false,
        msg: "latitude and longitude are required",
      });
    }

    const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
    if (!event || !isSilentMapDrop(event)) {
      return res.status(404).json({ status: false, msg: "Silent drop not found" });
    }

    const inRange = assertWithinCollectRadius(event, latitude, longitude);
    if (!inRange.ok) {
      return res.status(inRange.status).json({ status: false, msg: inRange.msg });
    }

    const expiresAt = new Date(Date.now() + QR_ARM_TTL_SEC * 1000);
    await redis.set(
      qrArmRedisKey(userId, eventId),
      JSON.stringify({ armedAt: new Date().toISOString() }),
      "EX",
      QR_ARM_TTL_SEC
    );

    return res.status(200).json({
      status: true,
      msg: "GPS verified",
      data: {
        eventId,
        armed: true,
        expiresAt,
        collectionMethod: event.collectionMethod,
        openQrScanner: event.collectionMethod === "BUSINESS_QR",
        distanceMeters: inRange.distanceM,
      },
    });
  } catch (error) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};

export const collectSilentDropGps = async (req, res) => {
  const userId = req.user.id;
  const { id: eventId } = req.params;
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({
      status: false,
      msg: "latitude and longitude are required",
    });
  }

  const result = await executeGpsInstantClaim({
    eventId,
    userId,
    userLat: latitude,
    userLng: longitude,
    requireSilent: true,
  });

  if (!result.ok) {
    return res.status(result.status).json({ status: false, msg: result.msg });
  }

  return res.status(200).json({
    status: true,
    msg: result.msg,
    data: {
      claimId: result.claimId,
      code: result.code,
      xpEarned: result.xpEarned,
      coinsAwarded: result.coinsAwarded,
    },
  });
};

export const collectSilentDropQr = async (req, res) => {
  const userId = req.user.id;
  const { id: eventId } = req.params;
  const { qrCodeData, latitude, longitude } = req.body;

  if (!qrCodeData) {
    return res.status(400).json({ status: false, msg: "qrCodeData is required" });
  }

  const armed = await redis.get(qrArmRedisKey(userId, eventId));
  const proximityArmed = Boolean(armed);

  const result = await executeBusinessQrClaim({
    eventId,
    userId,
    qrCodeData,
    userLat: latitude,
    userLng: longitude,
    proximityArmed,
  });

  if (!result.ok) {
    return res.status(result.status).json({ status: false, msg: result.msg });
  }

  if (proximityArmed) {
    await redis.del(qrArmRedisKey(userId, eventId));
  }

  return res.status(200).json({
    status: true,
    msg: result.msg,
    data: {
      claimId: result.claimId,
      code: result.code,
      xpEarned: result.xpEarned,
      coinsAwarded: result.coinsAwarded,
      isRedeemed: result.isRedeemed,
    },
  });
};

export const getMySilentDropClaims = async (req, res) => {
  const userId = req.user.id;

  try {
    const claims = await prisma.liveEventClaim.findMany({
      where: {
        userId,
        event: { displayMode: LIVE_EVENT_DISPLAY.SILENT_MAP_DROP },
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            reward: true,
            address: true,
            imageUrl: true,
            displayMode: true,
            collectionMethod: true,
            startTime: true,
            endTime: true,
          },
        },
      },
      orderBy: { claimedAt: "desc" },
    });

    const data = claims.map((c) => ({
      claimId: c.id,
      code: c.code,
      xpEarned: c.xpEarned,
      isRedeemed: c.isRedeemed,
      redeemedAt: c.redeemedAt,
      claimedAt: c.claimedAt,
      drop: c.event,
    }));

    return res.status(200).json({
      status: true,
      msg: "Silent drop claim history",
      data,
    });
  } catch (error) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};

export const getSilentDropById = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { latitude, longitude } = req.query;

  try {
    const event = await prisma.liveEvent.findUnique({ where: { id } });
    if (!event || !isSilentMapDrop(event)) {
      return res.status(404).json({ status: false, msg: "Silent drop not found" });
    }

    const claim = await prisma.liveEventClaim.findUnique({
      where: { eventId_userId: { eventId: id, userId } },
    });

    const lat = latitude != null ? parseFloat(latitude) : null;
    const lng = longitude != null ? parseFloat(longitude) : null;

    return res.status(200).json({
      status: true,
      data: formatSilentDropForClient(event, lat, lng, claim),
    });
  } catch (error) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};
