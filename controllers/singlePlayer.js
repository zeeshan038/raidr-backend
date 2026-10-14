import { prisma } from "../config/db.js";
import { redis } from "../config/redis.js";
import {
  haversineDistance,
  resolveMapCoordinates,
  getDiscoveryRadiusMeters,
  syncUserLocationFromRequest,
  shouldShowSinglePlayerZoneOnMap,
  userControlsSinglePlayerZone,
  buildSinglePlayerZoneMapWhere,
} from "../utils/methods/methods.js";
import {
  captureAttemptRedisKey,
  computeCaptureTimeBreakdown,
  computeRequiredCaptureSeconds,
  formatSinglePlayerZoneForClient,
  isZoneAttackable,
  userOwnsSinglePlayerZone,
} from "../utils/singlePlayerZone.js";
import {
  getSpGameConfig,
  gameplayFromConfig,
  userVisibleZoneFilter,
} from "../utils/singlePlayerConfig.js";
import { parseJsonIntArray } from "../utils/configJson.js";
import {
  countOwnedZones,
  getEmpireStatus,
  userAtOwnedZoneCap,
  userMeetsZoneEligibility,
} from "../utils/singlePlayerEmpire.js";
import {
  notifyUserIfAllowed,
  SP_NOTIFICATION_CATEGORIES,
} from "../utils/singlePlayerNotify.js";
import {
  clearZoneAttackers,
  getActiveCaptureSessionForUser,
  normalizeCaptureAttempt,
  registerZoneAttacker,
  unregisterZoneAttacker,
} from "../utils/singlePlayerCapture.js";
import { publishZoneCaptureStartedToOwner } from "../sockets/singlePlayerPublisher.js";

const CAPTURE_SESSION_BUFFER_SEC = 120;

/**
 * @Description Get gameplay constants for the mobile app (capture, guards, shields)
 * @Route GET /api/single-player/game-config
 * @Access Private
 */
export const getGameConfigForUser = async (_req, res) => {
  try {
    const configRow = await getSpGameConfig(prisma);
    const config = gameplayFromConfig(configRow);
    res.status(200).json({
      status: true,
      data: {
        ...config,
        rivalryMilestoneHours: parseJsonIntArray(configRow.rivalryMilestoneHours, [24, 48]),
        allowedHoldDurationHours: parseJsonIntArray(configRow.allowedHoldDurationHours, [24, 48, 72]),
      },
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Get all active single player zones
 * @Route GET /api/single-player/zones
 * @Access Private
 */
export const getZones = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const status = req.query.status;
  const userId = req.user?.id;
  const now = new Date();

  try {
    const configRow = await getSpGameConfig(prisma);
    const gameplay = gameplayFromConfig(configRow);

    syncUserLocationFromRequest(req);
    const coords = resolveMapCoordinates(req);
    const radiusMeters = getDiscoveryRadiusMeters(req);
    const city = req.query.city ? String(req.query.city).trim() : null;

    const mapDiscoveryStatuses = new Set([
      undefined,
      "available",
      "conquered_by_others",
    ]);
    if (
      mapDiscoveryStatuses.has(status) &&
      (coords?.lat == null || coords?.lng == null)
    ) {
      return res.status(400).json({
        status: false,
        msg:
          "latitude and longitude query params are required to discover nearby zones (including approved B2B). Use status=conquered_by_me to list only your owned zones without GPS.",
      });
    }

    let whereClause;

    if (userId && status === "conquered_by_me") {
      // All zones you own — anywhere on the map
      whereClause = {
        isActive: true,
        currentOwnerId: userId,
      };
    } else {
      whereClause = buildSinglePlayerZoneMapWhere({
        userId,
        coords,
        radiusMeters,
        now,
      });

      if (userId && status === "conquered_by_others") {
        whereClause = {
          AND: [
            whereClause,
            { currentOwnerId: { not: null } },
            { currentOwnerId: { not: userId } },
          ],
        };
      } else if (status === "available") {
        whereClause = {
          AND: [whereClause, { currentOwnerId: null }],
        };
      }
    }

    whereClause = { AND: [userVisibleZoneFilter, whereClause] };

    const candidateZones = await prisma.singlePlayerZone.findMany({
      where: whereClause,
      include: {
        owner: {
          select: { id: true, name: true, photoUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const visibilityOpts = { coords, radiusMeters, city, userId, now };
    const visibleZones =
      userId && status === "conquered_by_me"
        ? candidateZones
        : candidateZones.filter((zone) =>
            shouldShowSinglePlayerZoneOnMap(zone, visibilityOpts)
          );

    const totalZones = visibleZones.length;
    const zones = visibleZones.slice(skip, skip + limit);

    const ownedZonesCount = userId ? await countOwnedZones(prisma, userId) : null;

    const processedZones = zones.map((zone) =>
      formatSinglePlayerZoneForClient(zone, userId, now, gameplay, ownedZonesCount)
    );

    res.status(200).json({
      status: true,
      data: processedZones,
      pagination: {
        total: totalZones,
        page,
        limit,
        totalPages: Math.ceil(totalZones / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      msg: error.message
    });
  }
};

/**
 * @Description Get a single zone by id (detail / refresh for map, manage guards, B2B)
 * @Route GET /api/single-player/zones/:id
 * @Access Private
 */
export const getZoneById = async (req, res) => {
  const { id: zoneId } = req.params;
  const userId = req.user?.id;
  const now = new Date();

  try {
    const [zone, configRow] = await Promise.all([
      prisma.singlePlayerZone.findFirst({
        where: {
          id: zoneId,
          ...userVisibleZoneFilter,
        },
        include: {
          owner: {
            select: { id: true, name: true, photoUrl: true },
          },
        },
      }),
      getSpGameConfig(prisma),
    ]);
    const gameplay = gameplayFromConfig(configRow);

    if (!zone) {
      return res.status(404).json({ status: false, msg: "Zone not found" });
    }

    const ownsZone = userId && userOwnsSinglePlayerZone(zone, userId);

    if (!ownsZone && userId) {
      syncUserLocationFromRequest(req);
      const coords = resolveMapCoordinates(req);
      const radiusMeters = getDiscoveryRadiusMeters(req);
      const city = req.query.city ? String(req.query.city).trim() : null;
      const visibilityOpts = { coords, radiusMeters, city, userId, now };
      if (
        coords?.lat != null &&
        coords?.lng != null &&
        !shouldShowSinglePlayerZoneOnMap(zone, visibilityOpts)
      ) {
        return res.status(404).json({ status: false, msg: "Zone not found" });
      }
    }

    const ownedZonesCount = userId ? await countOwnedZones(prisma, userId) : null;
    const data = formatSinglePlayerZoneForClient(
      zone,
      userId,
      now,
      gameplay,
      ownedZonesCount
    );

    if (userId) {
      data.activeCaptureSession = await getActiveCaptureSessionForUser(
        userId,
        zoneId,
        zone.guardCount ?? 0
      );
    }

    res.status(200).json({ status: true, data });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

const validateCaptureLocation = (zone, latitude, longitude) => {
  const distance = haversineDistance(
    parseFloat(zone.latitude),
    parseFloat(zone.longitude),
    parseFloat(latitude),
    parseFloat(longitude)
  );
  if (distance > zone.radius) {
    return {
      ok: false,
      msg: `You must be within ${zone.radius}m of the zone.`,
    };
  }
  return { ok: true };
};

const resolveShieldDurationMin = async (userId) => {
  const [user, configRow] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getSpGameConfig(prisma),
  ]);
  let shieldDurationMin = gameplayFromConfig(configRow).shieldDurationMin;
  if (user?.selectedAvatarId) {
    const avatar = await prisma.store.findUnique({ where: { id: user.selectedAvatarId } });
    if (avatar?.spShieldDurationMin) {
      shieldDurationMin = avatar.spShieldDurationMin;
    }
  }
  return shieldDurationMin;
};

/**
 * @Description Start a hold-to-capture / snatch attempt (server returns required duration)
 * @Route POST /api/single-player/zones/:id/capture/start
 * @Access Private
 */
export const startCapture = async (req, res) => {
  const { id: zoneId } = req.params;
  const { latitude, longitude } = req.body;
  const userId = req.user.id;
  const now = new Date();

  try {
    if (latitude == null || longitude == null) {
      return res.status(400).json({
        status: false,
        msg: "Latitude and longitude are required",
      });
    }

    const [zone, configRow] = await Promise.all([
      prisma.singlePlayerZone.findUnique({ where: { id: zoneId } }),
      getSpGameConfig(prisma),
    ]);
    const gameplay = gameplayFromConfig(configRow);

    if (!zone || !zone.isActive) {
      return res.status(404).json({
        status: false,
        msg: "Zone not found or inactive",
      });
    }

    if (zone.zoneType === "B2B" && zone.approvalStatus !== "approved") {
      return res.status(400).json({ status: false, msg: "This zone is not available yet." });
    }

    if (userOwnsSinglePlayerZone(zone, userId)) {
      return res.status(400).json({
        status: false,
        msg: "You already own this zone.",
      });
    }

    if (!isZoneAttackable(zone, now)) {
      return res.status(400).json({
        status: false,
        msg: "Zone is currently shielded by another player.",
      });
    }

    const locationCheck = validateCaptureLocation(zone, latitude, longitude);
    if (!locationCheck.ok) {
      return res.status(400).json({ status: false, msg: locationCheck.msg });
    }

    const ownedCount = await countOwnedZones(prisma, userId);
    if (!userMeetsZoneEligibility(ownedCount, zone)) {
      return res.status(403).json({
        status: false,
        msg: `This campaign requires owning at least ${zone.minOwnedZonesRequired} zones.`,
        ownedZonesCount: ownedCount,
      });
    }

    if (userAtOwnedZoneCap(ownedCount, gameplay.maxOwnedZonesPerPlayer)) {
      return res.status(403).json({
        status: false,
        msg: `You can own at most ${gameplay.maxOwnedZonesPerPlayer} zones.`,
        ownedZonesCount: ownedCount,
        maxOwnedZonesPerPlayer: gameplay.maxOwnedZonesPerPlayer,
      });
    }

    const previousOwnerId = zone.currentOwnerId;

    const captureTimeSec = computeRequiredCaptureSeconds(zone, now, gameplay);
    const captureTimeBreakdown = computeCaptureTimeBreakdown(zone, now, gameplay);
    const distanceMeters = Math.round(
      haversineDistance(
        parseFloat(zone.latitude),
        parseFloat(zone.longitude),
        parseFloat(latitude),
        parseFloat(longitude)
      )
    );
    const startedAt = Date.now();
    const attemptKey = captureAttemptRedisKey(userId, zoneId);
    const sessionTtl = captureTimeSec + CAPTURE_SESSION_BUFFER_SEC;
    const attempt = normalizeCaptureAttempt(
      {
        zoneId,
        userId,
        startedAt,
        captureTimeSec,
        targetOwnerId: zone.currentOwnerId ?? null,
        initialGuardCount: zone.guardCount ?? 0,
        sessionGuardsRemaining: zone.guardCount ?? 0,
        guardsEliminatedInSession: 0,
      },
      zone.guardCount ?? 0
    );

    await redis.set(attemptKey, JSON.stringify(attempt), "EX", sessionTtl);
    await registerZoneAttacker(zoneId, userId, sessionTtl);

    if (previousOwnerId && previousOwnerId !== userId) {
      await notifyUserIfAllowed(
        prisma,
        previousOwnerId,
        SP_NOTIFICATION_CATEGORIES.ATTACK_SNATCH,
        "Your zone is under attack",
        `Someone started capturing "${zone.name}".`
      );

      const attacker = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, photoUrl: true },
      });
      publishZoneCaptureStartedToOwner(previousOwnerId, {
        zoneId: zone.id,
        zoneName: zone.name,
        zoneGuardCount: zone.guardCount ?? 0,
        attacker: {
          id: attacker?.id ?? userId,
          name: attacker?.name ?? "Player",
          photoUrl: attacker?.photoUrl ?? null,
        },
        initialGuardCount: attempt.initialGuardCount,
        at: new Date().toISOString(),
      });
    }

    res.status(200).json({
      status: true,
      msg: "Capture started",
      captureTimeSec,
      captureTimeBreakdown,
      distanceMeters,
      startedAt: new Date(startedAt).toISOString(),
      completesAfter: new Date(startedAt + captureTimeSec * 1000).toISOString(),
      initialGuardCount: attempt.initialGuardCount,
      sessionGuardsRemaining: attempt.sessionGuardsRemaining,
      guardsEliminatedInSession: attempt.guardsEliminatedInSession,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      msg: error.message,
    });
  }
};

/**
 * @Description Ping during capture — fails if player left the zone radius (auto-cancels attempt)
 * @Route POST /api/single-player/zones/:id/capture/ping
 * @Access Private
 */
export const pingCapture = async (req, res) => {
  const { id: zoneId } = req.params;
  const { latitude, longitude } = req.body;
  const userId = req.user.id;

  try {
    if (latitude == null || longitude == null) {
      return res.status(400).json({
        status: false,
        msg: "Latitude and longitude are required",
      });
    }

    const attemptKey = captureAttemptRedisKey(userId, zoneId);
    const rawAttempt = await redis.get(attemptKey);
    if (!rawAttempt) {
      return res.status(400).json({
        status: false,
        msg: "No active capture attempt.",
      });
    }

    const zone = await prisma.singlePlayerZone.findUnique({ where: { id: zoneId } });
    if (!zone) {
      return res.status(404).json({ status: false, msg: "Zone not found" });
    }

    const locationCheck = validateCaptureLocation(zone, latitude, longitude);
    if (!locationCheck.ok) {
      await redis.del(attemptKey);
      await unregisterZoneAttacker(zoneId, userId);
      return res.status(400).json({
        status: false,
        msg: "Left zone radius — capture cancelled.",
        cancelled: true,
      });
    }

    const attempt = normalizeCaptureAttempt(JSON.parse(rawAttempt), zone.guardCount ?? 0);
    const elapsedSec = (Date.now() - attempt.startedAt) / 1000;
    const remainingSec = Math.max(0, Math.ceil(attempt.captureTimeSec - elapsedSec));

    res.status(200).json({
      status: true,
      inRadius: true,
      remainingSec,
      sessionGuardsRemaining: attempt.sessionGuardsRemaining,
      initialGuardCount: attempt.initialGuardCount,
      guardsEliminatedInSession: attempt.guardsEliminatedInSession,
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Cancel an in-progress capture attempt
 * @Route POST /api/single-player/zones/:id/capture/cancel
 * @Access Private
 */
export const cancelCapture = async (req, res) => {
  const { id: zoneId } = req.params;
  const userId = req.user.id;

  try {
    const attemptKey = captureAttemptRedisKey(userId, zoneId);
    await redis.del(attemptKey);
    await unregisterZoneAttacker(zoneId, userId);

    res.status(200).json({
      status: true,
      msg: "Capture cancelled",
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      msg: error.message,
    });
  }
};

/**
 * @Description Complete capturing a zone
 * @Route POST /api/single-player/zones/:id/capture/complete
 * @Access Private
 */
export const completeCapture = async (req, res) => {
  const { id: zoneId } = req.params;
  const { latitude, longitude } = req.body;
  const userId = req.user.id;
  const now = new Date();

  try {
    if (latitude == null || longitude == null) {
      return res.status(400).json({
        status: false,
        msg: "Latitude and longitude are required",
      });
    }

    const zone = await prisma.singlePlayerZone.findUnique({ where: { id: zoneId } });
    if (!zone || !zone.isActive) {
      return res.status(404).json({
        status: false,
        msg: "Zone not found or inactive",
      });
    }

    const attemptKey = captureAttemptRedisKey(userId, zoneId);
    const rawAttempt = await redis.get(attemptKey);
    if (!rawAttempt) {
      return res.status(400).json({
        status: false,
        msg: "No active capture attempt. Start capture first.",
      });
    }

    const attempt = normalizeCaptureAttempt(JSON.parse(rawAttempt), zone.guardCount ?? 0);
    if (attempt.zoneId !== zoneId || attempt.userId !== userId) {
      return res.status(400).json({
        status: false,
        msg: "Invalid capture attempt.",
      });
    }

    const ownerUnchanged =
      (attempt.targetOwnerId ?? null) === (zone.currentOwnerId ?? null);
    if (!ownerUnchanged) {
      return res.status(409).json({
        status: false,
        msg: "This zone was already captured by another player.",
      });
    }

    if (attempt.initialGuardCount > 0 && attempt.sessionGuardsRemaining > 0) {
      return res.status(400).json({
        status: false,
        msg: "You must eliminate all guards before completing capture.",
        sessionGuardsRemaining: attempt.sessionGuardsRemaining,
        initialGuardCount: attempt.initialGuardCount,
      });
    }

    if (!isZoneAttackable(zone, now)) {
      return res.status(400).json({
        status: false,
        msg: "Zone is currently shielded by another player.",
      });
    }

    const elapsedSec = (Date.now() - attempt.startedAt) / 1000;
    if (elapsedSec < attempt.captureTimeSec) {
      return res.status(400).json({
        status: false,
        msg: "Capture time not met. Hold position until the timer completes.",
        remainingSec: Math.ceil(attempt.captureTimeSec - elapsedSec),
      });
    }

    const locationCheck = validateCaptureLocation(zone, latitude, longitude);
    if (!locationCheck.ok) {
      return res.status(400).json({ status: false, msg: locationCheck.msg });
    }

    const [configRow, ownedCount] = await Promise.all([
      getSpGameConfig(prisma),
      countOwnedZones(prisma, userId),
    ]);
    const gameplay = gameplayFromConfig(configRow);
    if (userAtOwnedZoneCap(ownedCount, gameplay.maxOwnedZonesPerPlayer)) {
      return res.status(403).json({
        status: false,
        msg: `You can own at most ${gameplay.maxOwnedZonesPerPlayer} zones.`,
        ownedZonesCount: ownedCount,
        maxOwnedZonesPerPlayer: gameplay.maxOwnedZonesPerPlayer,
      });
    }

    const previousOwnerId = zone.currentOwnerId;
    const shieldDurationMin = await resolveShieldDurationMin(userId);
    const shieldExpiresAt = new Date(Date.now() + shieldDurationMin * 60 * 1000);
    const ownedAt = new Date();
    const holdStartedAt = zone.zoneType === "B2B" ? new Date() : null;

    await prisma.$transaction([
      prisma.singlePlayerZone.update({
        where: { id: zoneId },
        data: {
          currentOwnerId: userId,
          shieldExpiresAt,
          ownedAt,
          holdStartedAt,
          shieldWarningSentAt: null,
        },
      }),
      prisma.singlePlayerRivalryAlert.deleteMany({ where: { zoneId } }),
    ]);

    await redis.del(attemptKey);
    await clearZoneAttackers(zoneId);

    if (previousOwnerId && previousOwnerId !== userId) {
      await notifyUserIfAllowed(
        prisma,
        previousOwnerId,
        SP_NOTIFICATION_CATEGORIES.ATTACK_SNATCH,
        "Zone snatched",
        `You lost "${zone.name}" to another player.`
      );
    }

    res.status(200).json({
      status: true,
      msg: previousOwnerId ? "Zone snatched successfully" : "Zone captured successfully",
      shieldExpiresAt,
      ownedAt,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      msg: error.message,
    });
  }
};

/**
 * Generate random coordinates roughly minMeters to maxMeters away
 */
const generateNearbyCoordinates = (lat, lng, minMeters, maxMeters) => {
  const metersToDegrees = 1 / 111000;

  const distance = Math.random() * (maxMeters - minMeters) + minMeters;
  const radiusInDegrees = distance * metersToDegrees;
  const angle = Math.random() * 2 * Math.PI;

  const dLat = radiusInDegrees * Math.cos(angle);
  const dLng = (radiusInDegrees * Math.sin(angle)) / Math.cos(lat * (Math.PI / 180));

  return {
    latitude: lat + dLat,
    longitude: lng + dLng
  };
};

/**
 * @Description Get or spawn today's Daily Drop
 * @Route POST /api/single-player/daily-drop
 * @Access Private
 */
export const getDailyDrop = async (req, res) => {
  const userId = req.user.id;
  const { latitude, longitude } = req.body;

  try {
    if (!latitude || !longitude) {
      return res.status(400).json({ status: false, msg: "Latitude and longitude are required" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dailyDrop = await prisma.dailyDrop.findFirst({
      where: {
        userId,
        createdAt: { gte: today }
      }
    });

    if (dailyDrop) {
      return res.status(200).json({ status: true, data: dailyDrop });
    }

    const dropLocation = generateNearbyCoordinates(parseFloat(latitude), parseFloat(longitude), 50, 150);
    const isRare = Math.random() < 0.15; // 15% chance
    const rewardType = isRare ? "2X_BOOST_24H" : "100_COINS";

    dailyDrop = await prisma.dailyDrop.create({
      data: {
        userId,
        latitude: dropLocation.latitude,
        longitude: dropLocation.longitude,
        isRare,
        rewardType
      }
    });

    if (isRare) {
      await notifyUserIfAllowed(
        prisma,
        userId,
        SP_NOTIFICATION_CATEGORIES.RARE_DROP,
        "Rare drop spawned!",
        "A rare daily drop appeared nearby. Open the map to collect it before it's gone."
      );
    }

    res.status(201).json({ status: true, msg: "New daily drop spawned", data: dailyDrop });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Collect Daily Drop
 * @Route POST /api/single-player/daily-drop/collect
 * @Access Private
 */
export const collectDailyDrop = async (req, res) => {
  const userId = req.user.id;
  const { dropId, latitude, longitude } = req.body;

  try {
    if (!dropId || !latitude || !longitude) {
      return res.status(400).json({ status: false, msg: "Drop ID, latitude, and longitude are required" });
    }

    const drop = await prisma.dailyDrop.findUnique({ where: { id: dropId } });

    if (!drop) {
      return res.status(404).json({ status: false, msg: "Drop not found" });
    }

    if (drop.userId !== userId) {
      return res.status(403).json({ status: false, msg: "Not your drop" });
    }

    if (drop.isCollected) {
      return res.status(400).json({ status: false, msg: "Already collected" });
    }

    const distance = haversineDistance(
      parseFloat(drop.latitude),
      parseFloat(drop.longitude),
      parseFloat(latitude),
      parseFloat(longitude)
    );

    if (distance > 50) {
      return res.status(400).json({
        status: false,
        msg: `Too far away to collect. Distance: ${distance.toFixed(2)}m`
      });
    }

    let rewardMsg = "You found 100 Coins!";
    let rewardData = null;

    if (drop.rewardType === "100_COINS") {
      await prisma.user.update({
        where: { id: userId },
        data: { raidrCoins: { increment: drop.rewardAmount || 100 } }
      });
      rewardMsg = `You found ${drop.rewardAmount || 100} Coins!`;
      rewardData = {
        type: "COINS",
        amount: drop.rewardAmount || 100
      };
    } else if (drop.rewardType === "2X_BOOST_24H") {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: userId },
        data: {
          coinBoostMultiplier: 2.0,
          coinBoostExpiresAt: expiresAt
        }
      });
      rewardMsg = "You found a Rare Drop! 2x Passive Coins for 24 hours.";
      rewardData = {
        type: "BOOST",
        multiplier: 2.0,
        expiresAt: expiresAt
      };
    } else if (drop.rewardType === "INSTANT_CAPTURE") {
      rewardMsg = "You found a Rare Drop! 1x Instant Capture added.";
      rewardData = {
        type: "INSTANT_CAPTURE",
        amount: 1
      };
    } else if (drop.rewardType === "AVATAR") {
      if (drop.rewardAvatarFrontUrl && drop.rewardAvatarBackUrl) {
        rewardMsg = "You found a Rare Drop! New Avatar unlocked.";
        rewardData = {
          type: "AVATAR",
          frontUrl: drop.rewardAvatarFrontUrl,
          backUrl: drop.rewardAvatarBackUrl
        };
      }
    } else if (drop.rewardType === "VOUCHER") {
      if (drop.rewardVoucherCode) {
        rewardMsg = `You won a ${drop.rewardVoucherTitle}!`;
        rewardData = {
          type: "VOUCHER",
          redemptionCode: drop.rewardVoucherCode,
          title: drop.rewardVoucherTitle,
          sponsor: drop.rewardVoucherSponsor,
          imageUrl: drop.rewardVoucherImageUrl
        };
      }
    }

    await prisma.dailyDrop.update({
      where: { id: dropId },
      data: { isCollected: true }
    });

    res.status(200).json({ status: true, msg: rewardMsg, rewardData });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Get currently active sponsored theme
 * @Route GET /api/single-player/theme
 * @Access Private
 */
export const getActiveTheme = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const now = new Date();

    // Find the current active theme
    const activeTheme = await prisma.sponsoredTheme.findFirst({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (activeTheme) {
      // If the theme has a specific location, check distance
      if (activeTheme.latitude !== null && activeTheme.longitude !== null) {
        if (!lat || !lng) {
          return res.status(200).json({ status: true, data: null, msg: "Theme requires location. Please provide lat and lng." });
        }

        const userLat = parseFloat(lat);
        const userLng = parseFloat(lng);
        const radius = activeTheme.radius || 5000;

        const distance = haversineDistance(userLat, userLng, activeTheme.latitude, activeTheme.longitude);

        if (distance > radius) {
          return res.status(200).json({ status: true, data: null, msg: `You are too far away from the active theme. Distance: ${Math.round(distance)}m, Radius: ${radius}m` });
        }
      }

      // If no location restrictions or user is within radius
      return res.status(200).json({ status: true, data: activeTheme });
    } else {
      return res.status(200).json({ status: true, data: null, msg: "No active theme" });
    }
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Get user's single player history (Daily Drops, Rare Drops, and Raid Zones)
 * @Route GET /api/single-player/history
 * @Access Private
 */
export const getSinglePlayerHistory = async (req, res) => {
  const userId = req.user.id;
  const { type } = req.query;

  try {
    let data;

    if (type === 'dailyDrops') {
      data = await prisma.dailyDrop.findMany({
        where: { userId, isCollected: true, isRare: false },
        orderBy: { updatedAt: 'desc' }
      });
    } else if (type === 'rareDrops') {
      data = await prisma.dailyDrop.findMany({
        where: { userId, isCollected: true, isRare: true },
        orderBy: { updatedAt: 'desc' }
      });
    } else if (type === 'raidZones') {
      data = await prisma.singlePlayerZone.findMany({
        where: { currentOwnerId: userId },
        orderBy: { updatedAt: 'desc' }
      });
    } else {
      // Fallback: return everything if no query is passed
      const dailyDrops = await prisma.dailyDrop.findMany({
        where: { userId, isCollected: true, isRare: false },
        orderBy: { updatedAt: 'desc' }
      });
      const rareDrops = await prisma.dailyDrop.findMany({
        where: { userId, isCollected: true, isRare: true },
        orderBy: { updatedAt: 'desc' }
      });
      const raidZones = await prisma.singlePlayerZone.findMany({
        where: { currentOwnerId: userId },
        orderBy: { updatedAt: 'desc' }
      });
      data = { dailyDrops, rareDrops, raidZones };
    }

    res.status(200).json({
      status: true,
      data
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};


/**
 * @Description Get aggregate dashboard data (Zones, Daily Drop, and Stats) in one API
 * @Route GET /api/single-player/dashboard
 * @Access Private
 */
export const getSinglePlayerDashboard = async (req, res) => {
  const userId = req.user.id;
  const { latitude, longitude } = req.query;

  try {
    if (!latitude || !longitude) {
      return res.status(400).json({ status: false, msg: "Latitude and longitude are required in query params" });
    }

    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);
    const coords = { lat: userLat, lng: userLng };
    const radiusMeters = getDiscoveryRadiusMeters(req);
    const city = req.query.city ? String(req.query.city).trim() : null;
    const now = new Date();

    syncUserLocationFromRequest(req);

    const configRow = await getSpGameConfig(prisma);
    const gameplay = gameplayFromConfig(configRow);

    // 1. Fetch User Data (for multiplier)
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // 2. Fetch zones (all for passive income; map shows nearby + your controlled only)
    const allActiveZones = await prisma.singlePlayerZone.findMany({
      where: userVisibleZoneFilter,
    });

    const visibilityOpts = { coords, radiusMeters, city, userId, now };
    const zones = allActiveZones.filter((zone) =>
      shouldShowSinglePlayerZoneOnMap(zone, visibilityOpts)
    );

    // 3. Calculate Dashboard Stats (worldwide owned zones)
    const ownedZones = allActiveZones.filter((z) =>
      userControlsSinglePlayerZone(z, userId)
    );
    const empire = await getEmpireStatus(prisma, userId);
    const ownedZonesCount = empire.ownedZonesCount;
    let passiveIncome = ownedZones.reduce((sum, zone) => sum + zone.coinsPerHour, 0);

    const hasActiveBoost = user.coinBoostExpiresAt && new Date(user.coinBoostExpiresAt) > new Date();
    if (hasActiveBoost && user.coinBoostMultiplier) {
      passiveIncome = Math.round(passiveIncome * user.coinBoostMultiplier);
    }
    if (empire.isVip && empire.vipRewardMultiplier > 1) {
      passiveIncome = Math.round(passiveIncome * empire.vipRewardMultiplier);
    }

    // 4. Handle Daily Drop
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dailyDrop = await prisma.dailyDrop.findFirst({
      where: {
        userId,
        createdAt: { gte: today }
      }
    });

    let isNewDrop = false;
    if (!dailyDrop) {
      const radiusInDegrees = 150 / 111320;
      const u = Math.random();
      const v = Math.random();
      const w = radiusInDegrees * Math.sqrt(u);
      const t = 2 * Math.PI * v;
      const offsetLat = w * Math.cos(t);
      const offsetLng = w * Math.sin(t) / Math.cos(userLat * Math.PI / 180);

      const isRare = Math.random() < 0.15;

      let rewardType = "100_COINS";
      let rewardAvatarFrontUrl = null;
      let rewardAvatarBackUrl = null;
      let rewardVoucherTitle = null;
      let rewardVoucherSponsor = null;
      let rewardVoucherCode = null;
      let rewardVoucherImageUrl = null;

      if (isRare) {
        const rareTypes = ["2X_BOOST_24H", "INSTANT_CAPTURE", "AVATAR", "VOUCHER"];
        rewardType = rareTypes[Math.floor(Math.random() * rareTypes.length)];

        if (rewardType === "AVATAR") {
          const avatars = await prisma.avatar.findMany({ select: { frontUrl: true, backUrl: true } });
          if (avatars.length > 0) {
            const selectedAvatar = avatars[Math.floor(Math.random() * avatars.length)];
            rewardAvatarFrontUrl = selectedAvatar.frontUrl;
            rewardAvatarBackUrl = selectedAvatar.backUrl;
          } else {
            rewardType = "2X_BOOST_24H";
          }
        } else if (rewardType === "VOUCHER") {
          const vouchers = await prisma.commercialVoucher.findMany({
            where: { isActive: true, quantity: { gt: 0 } }
          });
          if (vouchers.length > 0) {
            const selectedVoucher = vouchers[Math.floor(Math.random() * vouchers.length)];
            rewardVoucherTitle = selectedVoucher.title;
            rewardVoucherSponsor = selectedVoucher.sponsorName;
            rewardVoucherCode = selectedVoucher.redemptionCode;
            rewardVoucherImageUrl = selectedVoucher.imageUrl;
          } else {
            rewardType = "2X_BOOST_24H";
          }
        }
      }

      dailyDrop = await prisma.dailyDrop.create({
        data: {
          userId,
          latitude: userLat + offsetLat,
          longitude: userLng + offsetLng,
          isRare,
          rewardType,
          rewardAvatarFrontUrl,
          rewardAvatarBackUrl,
          rewardVoucherTitle,
          rewardVoucherSponsor,
          rewardVoucherCode,
          rewardVoucherImageUrl
        }
      });
      isNewDrop = true;

      if (isRare) {
        await notifyUserIfAllowed(
          prisma,
          userId,
          SP_NOTIFICATION_CATEGORIES.RARE_DROP,
          "Rare drop spawned!",
          "A rare daily drop appeared nearby. Open the map to collect it before it's gone."
        );
      }
    }

    // Calculate distance to drop
    const dropDistance = haversineDistance(dailyDrop.latitude, dailyDrop.longitude, userLat, userLng);

    const processedZones = zones.map((zone) => {
      const formatted = formatSinglePlayerZoneForClient(
        zone,
        userId,
        now,
        gameplay,
        ownedZonesCount
      );
      return {
        ...formatted,
        isConquered: userOwnsSinglePlayerZone(zone, userId),
      };
    });

    let processedDailyDrop = null;
    if (dailyDrop) {
      processedDailyDrop = {
        id: dailyDrop.id,
        userId: dailyDrop.userId,
        latitude: dailyDrop.latitude,
        longitude: dailyDrop.longitude,
        isCollected: dailyDrop.isCollected,
        isRare: dailyDrop.isRare,
        createdAt: dailyDrop.createdAt,
        updatedAt: dailyDrop.updatedAt,
        distanceMeters: Math.round(dropDistance),
        isNewlySpawned: isNewDrop
      };


    }

    res.status(200).json({
      status: true,
      data: {
        dashboard: {
          ownedZonesCount,
          maxOwnedZonesPerPlayer: gameplay.maxOwnedZonesPerPlayer,
          empireVipMinOwnedZones: empire.empireVipMinOwnedZones,
          isVip: empire.isVip,
          vipRewardMultiplier: empire.vipRewardMultiplier,
          passiveIncomePerHour: passiveIncome,
          daysUntilNextRareDrop: 3
        },
        dailyDrop: processedDailyDrop,
        zones: processedZones
      }
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Get all commercial vouchers collected by the user
 * @Route GET /api/single-player/vouchers
 * @Access Private
 */
export const getUserVouchers = async (req, res) => {
  const userId = req.user.id;

  try {
    const userVouchers = await prisma.userVoucher.findMany({
      where: { userId },
      include: {
        voucher: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      status: true,
      data: userVouchers
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};



