import { randomUUID } from "crypto";
import {
  computeB2bPassiveCoinProgress,
  computeNormalPassiveCoinProgress,
} from "./singlePlayerZone.js";

/**
 * Increment passive coins attributed to a user for a specific zone (after cron payout split).
 */
/** Ensures a ledger row exists so leaderboard can show the owner (0 coins until cron credits). */
export const ensureZonePassiveLedgerRow = async (prisma, zoneId, userId) => {
  if (!zoneId || !userId) return;

  try {
    await prisma.singlePlayerZonePassiveLedger.upsert({
      where: {
        zoneId_userId: { zoneId, userId },
      },
      create: {
        id: randomUUID(),
        zoneId,
        userId,
        coinsEarned: 0,
      },
      update: {},
    });
  } catch (err) {
    if (err?.code === "P2021") return;
    throw err;
  }
};

export const incrementZonePassiveLedger = async (prisma, zoneId, userId, amount) => {
  const delta = Math.floor(amount ?? 0);
  if (!zoneId || !userId || delta <= 0) return;

  try {
    await prisma.singlePlayerZonePassiveLedger.upsert({
      where: {
        zoneId_userId: { zoneId, userId },
      },
      create: {
        id: randomUUID(),
        zoneId,
        userId,
        coinsEarned: delta,
      },
      update: {
        coinsEarned: { increment: delta },
      },
    });
  } catch (err) {
    if (err?.code === "P2021") return;
    throw err;
  }
};

/**
 * Leader + viewer totals per zone for competitive bar (max earner on zone = 100%).
 */
export const fetchPassiveLedgerStatsByZoneIds = async (prisma, zoneIds) => {
  if (!zoneIds?.length) return {};

  const rows = await prisma.singlePlayerZonePassiveLedger.findMany({
    where: { zoneId: { in: zoneIds } },
    select: { zoneId: true, userId: true, coinsEarned: true },
  });

  const byZone = {};
  for (const row of rows) {
    const prev = byZone[row.zoneId];
    if (!prev || row.coinsEarned > prev.leaderCoins) {
      byZone[row.zoneId] = {
        leaderCoins: row.coinsEarned,
        leaderUserId: row.userId,
      };
    }
  }

  return byZone;
};

export const fetchYourPassiveLedgerByZoneIds = async (prisma, zoneIds, userId) => {
  if (!zoneIds?.length || !userId) return {};

  const rows = await prisma.singlePlayerZonePassiveLedger.findMany({
    where: { zoneId: { in: zoneIds }, userId },
    select: { zoneId: true, coinsEarned: true },
  });

  const map = {};
  for (const row of rows) {
    map[row.zoneId] = row.coinsEarned;
  }
  return map;
};

/** Attach normal.passiveEarning to formatted zones you own (NORMAL only). */
export const enrichNormalPassiveEarningOnFormattedZones = async (
  prisma,
  formattedZones,
  rawZones,
  userId
) => {
  if (!userId || !formattedZones?.length) return;

  const ownedNormal = [];
  for (let i = 0; i < formattedZones.length; i++) {
    const raw = rawZones[i];
    if (
      raw?.zoneType === "NORMAL" &&
      raw.currentOwnerId === userId &&
      raw.ownedAt
    ) {
      ownedNormal.push({ index: i, zoneId: raw.id, zone: raw });
    }
  }
  if (ownedNormal.length === 0) return;

  const zoneIds = ownedNormal.map((z) => z.zoneId);
  let leaderByZone;
  let yoursByZone;
  try {
    [leaderByZone, yoursByZone] = await Promise.all([
      fetchPassiveLedgerStatsByZoneIds(prisma, zoneIds),
      fetchYourPassiveLedgerByZoneIds(prisma, zoneIds, userId),
    ]);
  } catch (err) {
    if (err?.code === "P2021") return;
    throw err;
  }

  for (const { index, zoneId, zone } of ownedNormal) {
    const leader = leaderByZone[zoneId];
    const yourCoins = yoursByZone[zoneId] ?? 0;
    const leaderCoins = leader?.leaderCoins ?? 0;
    const passiveEarning = computeNormalPassiveCoinProgress(zone, {
      yourCoins,
      leaderCoins,
      leaderUserId: leader?.leaderUserId ?? null,
    });
    formattedZones[index].normal = {
      ...(formattedZones[index].normal ?? {}),
      passiveEarning,
    };
  }
};

/** Attach b2b.passiveIncome for owned B2B zones during an active hold. */
export const enrichB2bPassiveIncomeOnFormattedZones = async (
  prisma,
  formattedZones,
  rawZones,
  userId
) => {
  if (!userId || !formattedZones?.length) return;

  const ownedB2b = [];
  for (let i = 0; i < formattedZones.length; i++) {
    const raw = rawZones[i];
    if (
      raw?.zoneType === "B2B" &&
      raw.currentOwnerId === userId &&
      raw.holdStartedAt &&
      raw.holdDurationHours
    ) {
      ownedB2b.push({ index: i, zoneId: raw.id, zone: raw });
    }
  }
  if (ownedB2b.length === 0) return;

  const zoneIds = ownedB2b.map((z) => z.zoneId);
  let yoursByZone;
  try {
    yoursByZone = await fetchYourPassiveLedgerByZoneIds(prisma, zoneIds, userId);
  } catch (err) {
    if (err?.code === "P2021") return;
    throw err;
  }

  for (const { index, zoneId, zone } of ownedB2b) {
    const passiveIncome = computeB2bPassiveCoinProgress(
      zone,
      yoursByZone[zoneId] ?? 0
    );
    if (!passiveIncome) continue;
    formattedZones[index].b2b = {
      ...(formattedZones[index].b2b ?? {}),
      passiveIncome,
    };
  }
};

export const buildB2bPassiveIncomeForZone = async (prisma, zone, userId) => {
  if (
    zone?.zoneType !== "B2B" ||
    !userId ||
    zone.currentOwnerId !== userId ||
    !zone.holdStartedAt ||
    !zone.holdDurationHours
  ) {
    return null;
  }

  try {
    const yoursByZone = await fetchYourPassiveLedgerByZoneIds(prisma, [zone.id], userId);
    return computeB2bPassiveCoinProgress(zone, yoursByZone[zone.id] ?? 0);
  } catch (err) {
    if (err?.code === "P2021") {
      return computeB2bPassiveCoinProgress(zone, 0);
    }
    throw err;
  }
};

export const buildNormalPassiveEarningForZone = async (prisma, zone, userId) => {
  if (
    zone?.zoneType !== "NORMAL" ||
    !userId ||
    zone.currentOwnerId !== userId ||
    !zone.ownedAt
  ) {
    return null;
  }

  let leaderByZone;
  let yoursByZone;
  try {
    [leaderByZone, yoursByZone] = await Promise.all([
      fetchPassiveLedgerStatsByZoneIds(prisma, [zone.id]),
      fetchYourPassiveLedgerByZoneIds(prisma, [zone.id], userId),
    ]);
  } catch (err) {
    if (err?.code === "P2021") {
      return computeNormalPassiveCoinProgress(zone, {
        yourCoins: 0,
        leaderCoins: 0,
        leaderUserId: null,
      });
    }
    throw err;
  }
  const leader = leaderByZone[zone.id];
  return computeNormalPassiveCoinProgress(zone, {
    yourCoins: yoursByZone[zone.id] ?? 0,
    leaderCoins: leader?.leaderCoins ?? 0,
    leaderUserId: leader?.leaderUserId ?? null,
  });
};
