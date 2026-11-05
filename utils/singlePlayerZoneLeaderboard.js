import { computeB2bHoldProgress } from "./singlePlayerZone.js";
import { publishToSinglePlayerZone } from "../sockets/singlePlayerZonePublisher.js";

const mapLedgerRowsToRankedEntries = (rows, avatarById, viewerUserId) => {
  const sorted = [...rows].sort((a, b) => {
    if (b.coinsEarned !== a.coinsEarned) {
      return b.coinsEarned - a.coinsEarned;
    }
    return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
  });

  return sorted.map((row, index) => {
    let avatarUrl = "";
    const avatarId = row.user?.selectedAvatarId;
    if (avatarId && avatarById[avatarId]) {
      avatarUrl = avatarById[avatarId];
    }

    return {
      rank: index + 1,
      userId: row.userId,
      name: row.user?.name || "A player",
      photoUrl: row.user?.photoUrl || "",
      avatarUrl,
      coins: row.coinsEarned,
      isWinner: false,
      isYou: Boolean(viewerUserId && row.userId === viewerUserId),
    };
  });
};

const resolveB2bWinner = async (prisma, zone, entries, now) => {
  const hold = computeB2bHoldProgress(zone, now);
  if (!hold?.holdComplete || !zone.holdStartedAt) {
    return { winnerAnnounced: false, winnerUserId: null };
  }

  let claimUserId = null;
  try {
    const claim = await prisma.singlePlayerB2bClaim.findFirst({
      where: {
        zoneId: zone.id,
        holdStartedAt: zone.holdStartedAt,
      },
      orderBy: { createdAt: "desc" },
      select: { userId: true },
    });
    claimUserId = claim?.userId ?? null;
  } catch (err) {
    if (err?.code !== "P2021") throw err;
  }

  const leaderUserId = entries[0]?.userId ?? null;
  const winnerUserId = claimUserId ?? leaderUserId;

  return {
    winnerAnnounced: Boolean(winnerUserId),
    winnerUserId,
  };
};

/**
 * Per-zone coin leaderboard (NORMAL + B2B). Rank by passive ledger coinsEarned on this zone.
 */
export const buildZoneLeaderboard = async (prisma, zone, viewerUserId = null) => {
  if (!zone?.id) return null;
  if (zone.zoneType !== "NORMAL" && zone.zoneType !== "B2B") return null;

  let rows;
  try {
    rows = await prisma.singlePlayerZonePassiveLedger.findMany({
      where: { zoneId: zone.id, coinsEarned: { gt: 0 } },
      include: {
        user: {
          select: { id: true, name: true, photoUrl: true, selectedAvatarId: true },
        },
      },
    });
  } catch (err) {
    if (err?.code === "P2021") return null;
    throw err;
  }

  const avatarIds = [
    ...new Set(
      rows
        .map((r) => r.user?.selectedAvatarId)
        .filter((id) => id && String(id).trim() !== "")
    ),
  ];

  let avatarById = {};
  if (avatarIds.length > 0) {
    try {
      const avatars = await prisma.store.findMany({
        where: { id: { in: avatarIds } },
        select: { id: true, frontUrl: true },
      });
      avatarById = Object.fromEntries(
        avatars.map((a) => [a.id, a.frontUrl || ""])
      );
    } catch (err) {
      if (err?.code !== "P2021") throw err;
    }
  }

  const entries = mapLedgerRowsToRankedEntries(rows, avatarById, viewerUserId);
  const now = new Date();

  let winnerAnnounced = false;
  let winnerUserId = null;
  if (zone.zoneType === "B2B") {
    const winner = await resolveB2bWinner(prisma, zone, entries, now);
    winnerAnnounced = winner.winnerAnnounced;
    winnerUserId = winner.winnerUserId;
  }

  if (winnerAnnounced && winnerUserId) {
    for (const entry of entries) {
      entry.isWinner = entry.userId === winnerUserId;
    }
  }

  const top = entries.slice(0, 3);
  let viewer = null;
  if (viewerUserId) {
    const mine = entries.find((e) => e.userId === viewerUserId);
    if (mine && mine.rank > 3) {
      viewer = { ...mine };
    }
  }

  return {
    zoneId: zone.id,
    zoneType: zone.zoneType,
    sortBy: "coins_from_zone",
    top,
    viewer,
    entries,
    winnerAnnounced,
    winnerUserId,
  };
};

/** REST / snapshot payload (omit full entries list). */
export const toClientLeaderboardPayload = (leaderboard) => {
  if (!leaderboard) return null;
  const { entries, ...rest } = leaderboard;
  return rest;
};

export const enrichZoneLeaderboardOnFormattedZones = async (
  prisma,
  formattedZones,
  rawZones,
  viewerUserId
) => {
  if (!formattedZones?.length) return;

  await Promise.all(
    formattedZones.map(async (formatted, i) => {
      const raw = rawZones[i];
      if (raw?.zoneType !== "NORMAL" && raw?.zoneType !== "B2B") return;
      const built = await buildZoneLeaderboard(prisma, raw, viewerUserId);
      if (built) {
        formatted.leaderboard = toClientLeaderboardPayload(built);
      }
    })
  );
};

/**
 * Push live leaderboard to spzone:{zoneId} subscribers.
 */
export const broadcastSinglePlayerZoneLeaderboard = async (prisma, zoneId) => {
  if (!zoneId) return;

  try {
    const zone = await prisma.singlePlayerZone.findUnique({ where: { id: zoneId } });
    if (!zone || (zone.zoneType !== "NORMAL" && zone.zoneType !== "B2B")) {
      return;
    }

    const built = await buildZoneLeaderboard(prisma, zone, null);
    if (!built) return;

    const entries = built.entries.map(({ isYou, ...entry }) => entry);

    publishToSinglePlayerZone(zoneId, {
      type: "single_player_zone_leaderboard_updated",
      zoneType: built.zoneType,
      sortBy: built.sortBy,
      top: built.top.map(({ isYou, ...entry }) => entry),
      entries,
      winnerAnnounced: built.winnerAnnounced,
      winnerUserId: built.winnerUserId,
    });
  } catch (err) {
    if (err?.code === "P2021") return;
    console.error("[SinglePlayerZoneLeaderboard] broadcast failed:", err.message);
  }
};

export const publishSinglePlayerZoneWinnerAnnounced = (zoneId, winnerUserId) => {
  if (!zoneId || !winnerUserId) return;
  publishToSinglePlayerZone(zoneId, {
    type: "single_player_zone_winner_announced",
    winnerUserId,
  });
};
