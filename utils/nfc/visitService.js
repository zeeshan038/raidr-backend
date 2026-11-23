import { prisma } from "../../config/db.js";
import { awardRaidrCoins } from "../economyConfig.js";
import { awardUserXp } from "../awardUserXp.js";
import {
  NFC_COIN_SOURCE,
  NFC_VISIT_REWARD_COINS,
  NFC_VISIT_REWARD_XP,
} from "./constants.js";
import { createNfcToken, formatTagForClient, parseNfcPayload } from "./payload.js";

const startOfUtcDay = (date = new Date()) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * Ensure the merchant has at least one active counter tag (idempotent).
 */
export const ensureDefaultMerchantNfcTag = async (
  merchantId,
  { label = "Counter" } = {}
) => {
  const existing = await prisma.merchantNfcTag.findFirst({
    where: { merchantId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    return existing;
  }

  return prisma.merchantNfcTag.create({
    data: {
      merchantId,
      token: createNfcToken(),
      label,
      isActive: true,
    },
  });
};

export const createMerchantNfcTag = async (
  merchantId,
  { label = "Counter", chipUid = null } = {}
) => {
  return prisma.merchantNfcTag.create({
    data: {
      merchantId,
      token: createNfcToken(),
      label: label || "Counter",
      chipUid: chipUid || null,
      isActive: true,
    },
  });
};

export const listMerchantNfcTags = async (merchantId) => {
  const tags = await prisma.merchantNfcTag.findMany({
    where: { merchantId },
    orderBy: { createdAt: "asc" },
  });
  return tags.map((t) => formatTagForClient(t));
};

/**
 * Resolve an active tag from a scanned payload.
 */
export const resolveActiveTagFromPayload = async (payloadInput) => {
  const parsed = parseNfcPayload(payloadInput);
  if (!parsed.ok) {
    return { ok: false, status: 400, msg: parsed.error };
  }

  const tag = await prisma.merchantNfcTag.findUnique({
    where: { token: parsed.token },
    include: {
      merchant: {
        select: {
          id: true,
          name: true,
          businessName: true,
          photoUrl: true,
          status: true,
          address: true,
        },
      },
    },
  });

  if (!tag || !tag.isActive) {
    return { ok: false, status: 404, msg: "NFC tag not found or inactive" };
  }

  if (parsed.merchantId && parsed.merchantId !== tag.merchantId) {
    return { ok: false, status: 400, msg: "NFC payload merchant mismatch" };
  }

  if (!tag.merchant) {
    return { ok: false, status: 404, msg: "Merchant not found for this NFC tag" };
  }

  return { ok: true, tag, parsed };
};

const hasEarnedVisitRewardToday = async (userId, merchantId) => {
  const since = startOfUtcDay();
  const existing = await prisma.nfcVisit.findFirst({
    where: {
      userId,
      merchantId,
      missionCompleted: true,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  return Boolean(existing);
};

/**
 * Log visit + optionally award once-per-day mission reward.
 * Receipt photo flow is Phase 2 — we only return promptReceipt: true.
 */
export const verifyNfcVisit = async ({
  userId,
  payload,
  latitude = null,
  longitude = null,
  chipUid = null,
}) => {
  const resolved = await resolveActiveTagFromPayload(payload);
  if (!resolved.ok) {
    return resolved;
  }

  const { tag } = resolved;

  if (chipUid && !tag.chipUid) {
    // Bind hardware UID on first successful tap (optional hardening)
    await prisma.merchantNfcTag.update({
      where: { id: tag.id },
      data: { chipUid: String(chipUid) },
    });
  } else if (chipUid && tag.chipUid && tag.chipUid !== String(chipUid)) {
    return {
      ok: false,
      status: 400,
      msg: "NFC chip UID does not match registered tag",
    };
  }

  const alreadyRewardedToday = await hasEarnedVisitRewardToday(
    userId,
    tag.merchantId
  );

  let coinsAwarded = 0;
  let xpAwarded = 0;
  let missionCompleted = false;
  let xpResult = null;

  if (!alreadyRewardedToday) {
    coinsAwarded = Math.max(0, Math.floor(NFC_VISIT_REWARD_COINS));
    xpAwarded = Math.max(0, Math.floor(NFC_VISIT_REWARD_XP));
    missionCompleted = true;

    if (coinsAwarded > 0) {
      await awardRaidrCoins(prisma, userId, coinsAwarded, NFC_COIN_SOURCE);
    }
    if (xpAwarded > 0) {
      xpResult = await awardUserXp(prisma, userId, xpAwarded, {
        skipBrandMonth: false,
        brandMonthCoords:
          latitude != null && longitude != null
            ? { lat: Number(latitude), lng: Number(longitude) }
            : null,
      });
    }
  }

  const visit = await prisma.nfcVisit.create({
    data: {
      userId,
      merchantId: tag.merchantId,
      tagId: tag.id,
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
      missionCompleted,
      coinsAwarded,
      xpAwarded,
    },
  });

  return {
    ok: true,
    data: {
      visitId: visit.id,
      tappedAt: visit.createdAt,
      missionCompleted,
      alreadyVisitedToday: alreadyRewardedToday,
      coinsAwarded,
      xpAwarded,
      brandMonth: xpResult?.brandMonth ?? null,
      /** Flutter should show receipt-photo CTA after a successful tap */
      promptReceipt: true,
      receiptUploadReady: false, // Phase 2
      merchant: {
        id: tag.merchant.id,
        name: tag.merchant.name,
        businessName: tag.merchant.businessName,
        photoUrl: tag.merchant.photoUrl,
        address: tag.merchant.address,
      },
      tag: formatTagForClient(tag),
    },
  };
};

export const listNfcVisits = async ({
  merchantId,
  userId,
  page = 1,
  limit = 20,
} = {}) => {
  const take = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;
  const where = {
    ...(merchantId ? { merchantId } : {}),
    ...(userId ? { userId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.nfcVisit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        user: { select: { id: true, name: true, email: true, photoUrl: true } },
        merchant: {
          select: { id: true, name: true, businessName: true },
        },
        tag: { select: { id: true, label: true, token: true } },
      },
    }),
    prisma.nfcVisit.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: Math.max(1, Number(page) || 1),
      limit: take,
      total,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
};
