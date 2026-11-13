import crypto from "crypto";
import { prisma } from "../config/db.js";
import { getEconomyConfig } from "./economyConfig.js";
import { haversineDistance } from "./methods/methods.js";
import {
  LIVE_EVENT_COLLECTION,
  LIVE_EVENT_DISPLAY,
} from "./liveEventModes.js";
import { formatSilentDropForClient } from "./liveEventClaim.js";

const silentDropWindowWhere = (now = new Date()) => ({
  displayMode: LIVE_EVENT_DISPLAY.SILENT_MAP_DROP,
  status: { in: ["scheduled", "live"] },
  startTime: { lte: now },
  endTime: { gt: now },
  remainingQty: { gt: 0 },
});

export const resolveSilentDropStatus = (startTime, now = new Date()) => {
  const start = new Date(startTime);
  return start <= now ? "live" : "scheduled";
};

export const createSilentDropRecord = async ({
  merchantId,
  title,
  description,
  address,
  latitude,
  longitude,
  startTime,
  endTime,
  reward,
  rewardQuantity,
  imageUrl,
  commanderAvatar,
  collectionMethod,
  collectRadiusM,
  skipCredits,
}) => {
  const parsedStart = new Date(startTime);
  const parsedEnd = new Date(endTime);
  if (parsedEnd <= parsedStart) {
    throw new Error("End time must be after the start time");
  }

  const economy = await getEconomyConfig(prisma);
  const qrCodeToken = `event-qr-${crypto.randomBytes(16).toString("hex")}`;
  const qty = parseInt(rewardQuantity, 10);
  const now = new Date();
  const status = resolveSilentDropStatus(parsedStart, now);
  const method =
    collectionMethod === LIVE_EVENT_COLLECTION.BUSINESS_QR
      ? LIVE_EVENT_COLLECTION.BUSINESS_QR
      : LIVE_EVENT_COLLECTION.GPS_INSTANT;

  const data = {
    title,
    description,
    address: address || "",
    merchantId,
    commanderAvatar: commanderAvatar || "",
    imageUrl: imageUrl || "",
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    startTime: parsedStart,
    endTime: parsedEnd,
    reward,
    rewardQuantity: qty,
    remainingQty: qty,
    status,
    size: "small",
    qrCode: qrCodeToken,
    xpReward: economy.liveEventXpReward,
    displayMode: LIVE_EVENT_DISPLAY.SILENT_MAP_DROP,
    collectionMethod: method,
    collectRadiusM: collectRadiusM ?? 20,
  };

  if (skipCredits) {
    return prisma.liveEvent.create({ data });
  }

  const EVENT_COST = 10;
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw new Error("Merchant not found");
  if (merchant.credits < EVENT_COST) {
    throw new Error(
      `Insufficient credits. Silent drop requires ${EVENT_COST} credits.`
    );
  }

  const [updatedMerchant, newEvent] = await prisma.$transaction([
    prisma.merchant.update({
      where: { id: merchantId },
      data: { credits: { decrement: EVENT_COST } },
    }),
    prisma.liveEvent.create({ data }),
  ]);

  await prisma.merchantCreditLog.create({
    data: {
      merchantId,
      amount: -EVENT_COST,
      type: "silent_drop_creation",
      description: `Created silent drop "${title}" (${EVENT_COST} credits)`,
      eventId: newEvent.id,
    },
  });

  void updatedMerchant;
  return newEvent;
};

export const listSilentDropsForAdmin = async ({ page = 1, limit = 20, merchantId }) => {
  const skip = (page - 1) * limit;
  const where = {
    displayMode: LIVE_EVENT_DISPLAY.SILENT_MAP_DROP,
    ...(merchantId ? { merchantId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.liveEvent.findMany({
      where,
      include: {
        merchant: {
          select: { id: true, name: true, businessName: true },
        },
        _count: { select: { claims: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.liveEvent.count({ where }),
  ]);
  return { items, total, page, limit };
};

export const findNearbySilentDrops = async (userId, userLat, userLng, radiusMeters = 15000) => {
  const now = new Date();
  const events = await prisma.liveEvent.findMany({
    where: silentDropWindowWhere(now),
    orderBy: { startTime: "asc" },
  });

  const claims = await prisma.liveEventClaim.findMany({
    where: {
      userId,
      eventId: { in: events.map((e) => e.id) },
    },
  });
  const claimByEvent = new Map(claims.map((c) => [c.eventId, c]));

  const nearby = [];
  for (const event of events) {
    const dist = haversineDistance(userLat, userLng, event.latitude, event.longitude);
    if (dist <= radiusMeters) {
      nearby.push(
        formatSilentDropForClient(event, userLat, userLng, claimByEvent.get(event.id))
      );
    }
  }
  nearby.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  return nearby;
};
