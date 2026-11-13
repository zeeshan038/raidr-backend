import crypto from "crypto";
import { prisma } from "../config/db.js";
import { haversineDistance } from "./methods/methods.js";
import { getEconomyConfig, awardRaidrCoins } from "./economyConfig.js";
import { tryCompleteReferralQualifyingActivity } from "./referralService.js";
import { publishToUser } from "../sockets/eventPublisher.js";
import {
  isSilentMapDrop,
  LIVE_EVENT_COLLECTION,
} from "./liveEventModes.js";

export const assertEventCollectible = (event) => {
  const allowed = ["live"];
  if (isSilentMapDrop(event)) {
    allowed.push("scheduled");
  }
  if (!allowed.includes(event.status)) {
    return {
      ok: false,
      status: 400,
      msg: `Cannot claim reward. Event is currently "${event.status}" (must be "live").`,
    };
  }
  const now = new Date();
  if (event.startTime && new Date(event.startTime) > now) {
    return { ok: false, status: 400, msg: "This drop is not active yet." };
  }
  if (event.endTime && new Date(event.endTime) <= now) {
    return { ok: false, status: 400, msg: "This drop has expired." };
  }
  if (event.remainingQty <= 0) {
    return { ok: false, status: 400, msg: "soldOut" };
  }
  return { ok: true };
};

export const assertWithinCollectRadius = (event, userLat, userLng) => {
  const radius = event.collectRadiusM ?? 20;
  const distance = haversineDistance(
    parseFloat(userLat),
    parseFloat(userLng),
    event.latitude,
    event.longitude
  );
  if (distance > radius) {
    return {
      ok: false,
      status: 400,
      msg: `Too far from drop. You are ${Math.round(distance)}m away; must be within ${radius}m.`,
      distanceM: Math.round(distance),
    };
  }
  return { ok: true, distanceM: Math.round(distance) };
};

const applyXpLevelUpdate = async (userId, xpAwarded) => {
  const userForLevel = await prisma.user.findUnique({
    where: { id: userId },
    select: { level: true, xp_progress: true },
  });
  const xp = xpAwarded || 0;
  let lv = Math.max(1, userForLevel.level);
  let bank = Math.max(0, userForLevel.xp_progress) + xp;
  const xpRequired = (level) => 100 * level * level;
  while (bank >= xpRequired(lv)) {
    bank -= xpRequired(lv);
    lv += 1;
  }
  return { lv, bank, leveledUp: lv > userForLevel.level };
};

export const executeGpsInstantClaim = async ({
  eventId,
  userId,
  userLat,
  userLng,
  requireSilent = false,
}) => {
  const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    return { ok: false, status: 404, msg: "Drop not found" };
  }
  if (requireSilent && !isSilentMapDrop(event)) {
    return { ok: false, status: 400, msg: "Not a silent map drop" };
  }
  if (event.collectionMethod === LIVE_EVENT_COLLECTION.BUSINESS_QR) {
    return {
      ok: false,
      status: 400,
      msg: "This drop requires in-store QR verification. Complete GPS check, then scan the business QR.",
    };
  }

  const collectible = assertEventCollectible(event);
  if (!collectible.ok) return { ok: false, ...collectible };

  const inRange = assertWithinCollectRadius(event, userLat, userLng);
  if (!inRange.ok) return { ok: false, ...inRange };

  const existingClaim = await prisma.liveEventClaim.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (existingClaim) {
    return { ok: false, status: 400, msg: "alreadyClaimed" };
  }

  const gpsStreetCoinsOnly =
    requireSilent &&
    isSilentMapDrop(event) &&
    event.collectionMethod === LIVE_EVENT_COLLECTION.GPS_INSTANT;

  const assignedCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  const xpAwarded = gpsStreetCoinsOnly ? 0 : event.xpReward || 0;
  const levelInfo = await applyXpLevelUpdate(userId, xpAwarded);

  const userStatsUpdate =
    xpAwarded > 0
      ? {
          xp_earned: { increment: xpAwarded },
          xp_progress: levelInfo.bank,
          level: levelInfo.lv,
          rewards_claimed: { increment: 1 },
        }
      : { rewards_claimed: { increment: 1 } };

  const [claimDoc] = await prisma.$transaction([
    prisma.liveEventClaim.create({
      data: {
        eventId,
        userId,
        code: assignedCode,
        xpEarned: xpAwarded,
        lat: parseFloat(userLat),
        lng: parseFloat(userLng),
        isRedeemed: true,
        redeemedAt: new Date(),
      },
    }),
    prisma.liveEvent.update({
      where: { id: eventId },
      data: { remainingQty: { decrement: 1 } },
    }),
    prisma.user.update({
      where: { id: userId },
      data: userStatsUpdate,
    }),
  ]);

  const economy = await getEconomyConfig(prisma);
  let coinsAwarded = 0;
  const coinSource = gpsStreetCoinsOnly
    ? "silent_drop_gps_collect"
    : "live_event_redeem";
  if (gpsStreetCoinsOnly) {
    const configured = event.coinReward;
    coinsAwarded =
      configured != null && configured > 0
        ? configured
        : economy.liveEventRedeemCoins;
  } else if (economy.liveEventRedeemCoins > 0) {
    coinsAwarded = economy.liveEventRedeemCoins;
  }
  if (coinsAwarded > 0) {
    await awardRaidrCoins(prisma, userId, coinsAwarded, coinSource);
  }

  if (!gpsStreetCoinsOnly) {
    tryCompleteReferralQualifyingActivity(userId).catch((err) =>
      console.error("Referral qualifying activity (live event claim):", err)
    );
  }

  if (xpAwarded > 0) {
    publishToUser(userId, {
      type: "user_stats_updated",
      xpAdded: xpAwarded,
      newXpProgress: levelInfo.bank,
      newLevel: levelInfo.lv,
      leveledUp: levelInfo.leveledUp,
    });
  }

  return {
    ok: true,
    status: 200,
    msg: "success",
    code: assignedCode,
    xpEarned: xpAwarded,
    claimId: claimDoc.id,
    coinsAwarded,
    payoutType: gpsStreetCoinsOnly ? "COINS_ONLY" : "PARTNER_REWARD",
  };
};

export const executeBusinessQrClaim = async ({
  eventId,
  userId,
  qrCodeData,
  userLat,
  userLng,
  proximityArmed,
}) => {
  const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    return { ok: false, status: 404, msg: "Drop not found" };
  }
  if (!isSilentMapDrop(event)) {
    return { ok: false, status: 400, msg: "Invalid drop type for this action." };
  }
  if (event.collectionMethod !== LIVE_EVENT_COLLECTION.BUSINESS_QR) {
    return { ok: false, status: 400, msg: "This drop does not use QR verification." };
  }
  if (!qrCodeData || event.qrCode !== qrCodeData) {
    return { ok: false, status: 400, msg: "Invalid QR Code scanned for this drop" };
  }

  const collectible = assertEventCollectible(event);
  if (!collectible.ok) return { ok: false, ...collectible };

  if (!proximityArmed) {
    if (userLat === undefined || userLng === undefined) {
      return {
        ok: false,
        status: 400,
        msg: "Complete GPS verification before scanning, or scan near the drop.",
      };
    }
    const inRange = assertWithinCollectRadius(event, userLat, userLng);
    if (!inRange.ok) return { ok: false, ...inRange };
  }

  const existingClaim = await prisma.liveEventClaim.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (existingClaim?.isRedeemed) {
    return { ok: false, status: 400, msg: "alreadyClaimed" };
  }
  if (existingClaim) {
    return {
      ok: true,
      status: 200,
      msg: "success",
      claimId: existingClaim.id,
      code: existingClaim.code,
      xpEarned: existingClaim.xpEarned,
      isRedeemed: existingClaim.isRedeemed,
    };
  }

  const assignedCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  const xpAwarded = event.xpReward || 0;
  const levelInfo = await applyXpLevelUpdate(userId, xpAwarded);
  const economy = await getEconomyConfig(prisma);
  const redeemCoins = economy.liveEventRedeemCoins;

  const [claimDoc] = await prisma.$transaction([
    prisma.liveEventClaim.create({
      data: {
        eventId,
        userId,
        code: assignedCode,
        xpEarned: xpAwarded,
        lat: userLat != null ? parseFloat(userLat) : null,
        lng: userLng != null ? parseFloat(userLng) : null,
        isRedeemed: true,
        redeemedAt: new Date(),
      },
    }),
    prisma.liveEvent.update({
      where: { id: eventId },
      data: { remainingQty: { decrement: 1 } },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        xp_earned: { increment: xpAwarded },
        xp_progress: levelInfo.bank,
        level: levelInfo.lv,
        rewards_claimed: { increment: 1 },
      },
    }),
  ]);

  let coinsAwarded = 0;
  if (redeemCoins > 0) {
    coinsAwarded = redeemCoins;
    await awardRaidrCoins(prisma, userId, coinsAwarded, "live_event_redeem");
  }

  tryCompleteReferralQualifyingActivity(userId).catch((err) =>
    console.error("Referral qualifying activity (silent QR claim):", err)
  );

  return {
    ok: true,
    status: 200,
    msg: "success",
    claimId: claimDoc.id,
    code: assignedCode,
    xpEarned: xpAwarded,
    coinsAwarded,
    isRedeemed: true,
    payoutType: "PARTNER_REWARD",
  };
};

/** Admin/merchant: `imageUrl` = map pin asset; `commanderAvatar` = reward / product art. */
export const resolveSilentDropMapIconUrl = (event) => {
  const pin = typeof event?.imageUrl === "string" ? event.imageUrl.trim() : "";
  const fallback =
    typeof event?.commanderAvatar === "string" ? event.commanderAvatar.trim() : "";
  return pin || fallback || null;
};

/** Product / reward image on detail screens (not the map pin). */
export const resolveSilentDropProductImageUrl = (event) => {
  const product =
    typeof event?.commanderAvatar === "string" ? event.commanderAvatar.trim() : "";
  const fallback = typeof event?.imageUrl === "string" ? event.imageUrl.trim() : "";
  return product || fallback || null;
};

/** Dashboard map pin only — full detail: GET /single-player/silent-drops/:id */
export const formatSilentDropMapPin = (event, userLat, userLng, claim) => {
  let distanceMeters = null;
  if (userLat != null && userLng != null) {
    distanceMeters = Math.round(
      haversineDistance(userLat, userLng, event.latitude, event.longitude)
    );
  }
  const isGps =
    event.collectionMethod === LIVE_EVENT_COLLECTION.GPS_INSTANT;
  return {
    type: isGps ? "SILENT_DROP_GPS" : "SILENT_DROP_QR",
    id: event.id,
    title: event.title,
    latitude: event.latitude,
    longitude: event.longitude,
    mapIconUrl: resolveSilentDropMapIconUrl(event),
    distanceMeters,
    hasClaimed: Boolean(claim),
    ...(isGps ? { coinReward: event.coinReward ?? null } : {}),
  };
};

export const formatSilentDropForClient = (event, userLat, userLng, claim) => {
  let distanceMeters = null;
  if (userLat != null && userLng != null) {
    distanceMeters = Math.round(
      haversineDistance(userLat, userLng, event.latitude, event.longitude)
    );
  }
  const isGps =
    event.collectionMethod === LIVE_EVENT_COLLECTION.GPS_INSTANT;
  return {
    type: isGps ? "SILENT_DROP_GPS" : "SILENT_DROP_QR",
    id: event.id,
    title: event.title,
    description: event.description,
    address: event.address,
    latitude: event.latitude,
    longitude: event.longitude,
    imageUrl: resolveSilentDropProductImageUrl(event),
    mapIconUrl: resolveSilentDropMapIconUrl(event),
    reward: event.reward,
    remainingQty: event.remainingQty,
    rewardQuantity: event.rewardQuantity,
    startTime: event.startTime,
    endTime: event.endTime,
    status: event.status,
    displayMode: event.displayMode,
    collectionMethod: event.collectionMethod,
    collectRadiusM: event.collectRadiusM ?? 20,
    xpReward: event.xpReward,
    distanceMeters,
    isClaimed: Boolean(claim),
    hasClaimed: Boolean(claim),
    claimId: claim?.id ?? null,
    payoutType:
      event.collectionMethod === LIVE_EVENT_COLLECTION.BUSINESS_QR
        ? "PARTNER_REWARD"
        : "COINS_ONLY",
    coinReward:
      event.collectionMethod === LIVE_EVENT_COLLECTION.GPS_INSTANT
        ? event.coinReward ?? null
        : null,
  };
};
