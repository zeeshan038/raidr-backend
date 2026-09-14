import { prisma } from "../config/db.js";
import { redis } from "../config/redis.js";
import { haversineDistance } from "../utils/methods/methods.js";

// Constants
const DEFAULT_CAPTURE_TIME_SEC = 30;
const DEFAULT_SHIELD_DURATION_MIN = 60;

/**
 * @Description Get all active single player zones
 * @Route GET /api/single-player/zones
 * @Access Private
 */
export const getZones = async (req, res) => {
  try {
    const zones = await prisma.singlePlayerZone.findMany({
      where: { isActive: true },
      include: {
        owner: {
          select: { id: true, name: true, photoUrl: true }
        }
      }
    });

    res.status(200).json({
      status: true,
      data: zones
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      msg: error.message
    });
  }
};

/**
 * @Description Start capturing a zone
 * @Route POST /api/single-player/zones/:id/capture/start
 * @Access Private
 */
export const startCapture = async (req, res) => {
  const { id: zoneId } = req.params;
  const { latitude, longitude } = req.body;
  const userId = req.user.id;
  try {

    if (!latitude || !longitude) {
      return res.status(400).json({
        status: false,
        msg: "Latitude and longitude are required"
      });
    }

    const zone = await prisma.singlePlayerZone.findUnique({ where: { id: zoneId } });
    if (!zone || !zone.isActive) {
      return res.status(404).json({
        status: false,
        msg: "Zone not found or inactive"
      });
    }

    // Check if shielded
    if (zone.shieldExpiresAt && new Date(zone.shieldExpiresAt) > new Date()) {
      return res.status(400).json({ success: false, message: "Zone is currently shielded" });
    }

    // Check distance
    const distance = haversineDistance(
      parseFloat(zone.latitude),
      parseFloat(zone.longitude),
      parseFloat(latitude),
      parseFloat(longitude)
    );

    if (distance > zone.radius) {
      return res.status(400).json({
        status: false,
        msg: `You are too far away. Distance: ${distance.toFixed(2)}m, Radius: ${zone.radius}m`
      });
    }

    // Fetch user and equipped avatar times
    const user = await prisma.user.findUnique({ where: { id: userId } });
    let captureTimeSec = DEFAULT_CAPTURE_TIME_SEC;
    
    if (user && user.selectedAvatarId) {
      const avatar = await prisma.store.findUnique({ where: { id: user.selectedAvatarId } });
      if (avatar && avatar.spCaptureTimeSec) {
        captureTimeSec = avatar.spCaptureTimeSec;
      }
    }

    // Store capture start time in Redis with expiry slightly longer than the capture time
    const redisKey = `sp_capture:${userId}:${zoneId}`;
    await redis.set(redisKey, Date.now(), "EX", captureTimeSec + 30);

    res.status(200).json({
      status: true,
      msg: "Capture started successfully",
      captureTime: captureTimeSec
    });

  } catch (error) {
    res.status(500).json({
      status: false,
      msg: error.message
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
  try {

    if (!latitude || !longitude) {
      return res.status(400).json({
        status: false,
        msg: "Latitude and longitude are required"
      });
    }

    const redisKey = `sp_capture:${userId}:${zoneId}`;
    const startTimeStr = await redis.get(redisKey);

    if (!startTimeStr) {
      return res.status(400).json({
        status: false,
        msg: "Capture session expired or not started"
      });
    }

    // Fetch user and equipped avatar times
    const user = await prisma.user.findUnique({ where: { id: userId } });
    let captureTimeSec = DEFAULT_CAPTURE_TIME_SEC;
    let shieldDurationMin = DEFAULT_SHIELD_DURATION_MIN;
    
    if (user && user.selectedAvatarId) {
      const avatar = await prisma.store.findUnique({ where: { id: user.selectedAvatarId } });
      if (avatar) {
        captureTimeSec = avatar.spCaptureTimeSec || DEFAULT_CAPTURE_TIME_SEC;
        shieldDurationMin = avatar.spShieldDurationMin || DEFAULT_SHIELD_DURATION_MIN;
      }
    }

    const startTime = parseInt(startTimeStr, 10);
    const elapsedSeconds = (Date.now() - startTime) / 1000;

    if (elapsedSeconds < captureTimeSec) {
      return res.status(400).json({
        status: false,
        msg: "Capture time has not elapsed yet"
      });
    }

    const zone = await prisma.singlePlayerZone.findUnique({ where: { id: zoneId } });
    if (!zone || !zone.isActive) {
      return res.status(404).json({
        status: false,
        msg: "Zone not found or inactive"
      });
    }

    // Check distance again to ensure they stayed in the radius
    const distance = haversineDistance(
      parseFloat(zone.latitude),
      parseFloat(zone.longitude),
      parseFloat(latitude),
      parseFloat(longitude)
    );

    if (distance > zone.radius) {
      // Clean up redis
      await redis.del(redisKey);
      return res.status(400).json({
        status: false,
        msg: "Capture failed. You left the zone."
      });
    }

    // Set shield time
    const shieldExpiresAt = new Date(Date.now() + shieldDurationMin * 60 * 1000);

    // Update zone
    await prisma.singlePlayerZone.update({
      where: { id: zoneId },
      data: {
        currentOwnerId: userId,
        shieldExpiresAt
      }
    });

    await redis.del(redisKey);

    res.status(200).json({
      status: true,
      msg: "Zone captured successfully",
      shieldExpiresAt
    });

  } catch (error) {
    res.status(500).json({
      status: false,
      msg: error.message
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
    if (drop.rewardType === "100_COINS") {
      await prisma.user.update({
        where: { id: userId },
        data: { raidrCoins: { increment: 100 } }
      });
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
    }

    await prisma.dailyDrop.update({
      where: { id: dropId },
      data: { isCollected: true }
    });

    res.status(200).json({ status: true, msg: rewardMsg });
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
    const now = new Date();
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
