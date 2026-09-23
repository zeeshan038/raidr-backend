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
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const status = req.query.status;
  const userId = req.user?.id;

  try {
    const whereClause = { isActive: true };

    if (userId) {
      if (status === 'conquered_by_me') {
        whereClause.currentOwnerId = userId;
      } else if (status === 'conquered_by_others') {
        whereClause.AND = [
          { currentOwnerId: { not: null } },
          { currentOwnerId: { not: userId } }
        ];
      } else if (status === 'available') {
        whereClause.currentOwnerId = null;
      }
    }

    const totalZones = await prisma.singlePlayerZone.count({
      where: whereClause
    });

    const zones = await prisma.singlePlayerZone.findMany({
      where: whereClause,
      include: {
        owner: {
          select: { id: true, name: true, photoUrl: true }
        }
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    const processedZones = zones.map(zone => {
      let zoneStatus = 'available';
      const now = new Date();
      const isShieldExpired = zone.shieldExpiresAt && new Date(zone.shieldExpiresAt) <= now;

      if (userId && zone.currentOwnerId && !isShieldExpired) {
        if (zone.currentOwnerId === userId) {
          zoneStatus = 'conquered_by_me';
        } else {
          zoneStatus = 'conquered_by_others';
        }
      }

      return {
        ...zone,
        currentOwnerId: isShieldExpired ? null : zone.currentOwnerId,
        shieldExpiresAt: isShieldExpired ? null : zone.shieldExpiresAt,
        status: zoneStatus
      };
    });

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

    const zone = await prisma.singlePlayerZone.findUnique({ where: { id: zoneId } });
    if (!zone || !zone.isActive) {
      return res.status(404).json({
        status: false,
        msg: "Zone not found or inactive"
      });
    }

    // Check if shielded
    if (zone.shieldExpiresAt && new Date(zone.shieldExpiresAt) > new Date()) {
      return res.status(400).json({ status: false, msg: "Zone is currently shielded by another player." });
    }

    // Fetch user and equipped avatar times for shield duration
    const user = await prisma.user.findUnique({ where: { id: userId } });
    let shieldDurationMin = DEFAULT_SHIELD_DURATION_MIN;

    if (user && user.selectedAvatarId) {
      const avatar = await prisma.store.findUnique({ where: { id: user.selectedAvatarId } });
      if (avatar && avatar.spShieldDurationMin) {
        shieldDurationMin = avatar.spShieldDurationMin;
      }
    }


    const distance = haversineDistance(
      parseFloat(zone.latitude),
      parseFloat(zone.longitude),
      parseFloat(latitude),
      parseFloat(longitude)
    );

    if (distance > zone.radius) {
      return res.status(400).json({
        status: false,
        msg: `Capture failed. You must be within ${zone.radius}m of the zone.`
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

    // 1. Fetch User Data (for multiplier)
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // 2. Fetch Zones
    const zones = await prisma.singlePlayerZone.findMany({
      where: { isActive: true }
    });

    // 3. Calculate Dashboard Stats
    const ownedZones = zones.filter(z => z.currentOwnerId === userId);
    const ownedZonesCount = ownedZones.length;
    let passiveIncome = ownedZones.reduce((sum, zone) => sum + zone.coinsPerHour, 0);

    const hasActiveBoost = user.coinBoostExpiresAt && new Date(user.coinBoostExpiresAt) > new Date();
    if (hasActiveBoost && user.coinBoostMultiplier) {
      passiveIncome = Math.round(passiveIncome * user.coinBoostMultiplier);
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
    }

    // Calculate distance to drop
    const dropDistance = haversineDistance(dailyDrop.latitude, dailyDrop.longitude, userLat, userLng);

    // Add status to zones for the frontend
    const processedZones = zones.map(zone => {
      let status = "available";
      const now = new Date();
      const isShieldExpired = zone.shieldExpiresAt && new Date(zone.shieldExpiresAt) <= now;

      if (zone.currentOwnerId && !isShieldExpired) {
        if (zone.currentOwnerId === userId) {
          status = "conquered_by_me";
        } else {
          status = "conquered_by_others";
        }
      }

      return {
        ...zone,
        currentOwnerId: isShieldExpired ? null : zone.currentOwnerId,
        shieldExpiresAt: isShieldExpired ? null : zone.shieldExpiresAt,
        isConquered: zone.currentOwnerId === userId && !isShieldExpired,
        status
      };
    });

    let processedDailyDrop = null;
    if (dailyDrop) {
      processedDailyDrop = {
        ...dailyDrop,
        distanceMeters: Math.round(dropDistance),
        isNewlySpawned: isNewDrop
      };


    }

    res.status(200).json({
      status: true,
      data: {
        dashboard: {
          ownedZonesCount,
          maxZonesCount: 5,
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



