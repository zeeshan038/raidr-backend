import { prisma } from "../config/db.js";
import { redis } from "../config/redis.js";
import {
  captureAttemptRedisKey,
  computeRequiredCaptureSeconds,
  userOwnsSinglePlayerZone,
} from "../utils/singlePlayerZone.js";
import { getSpGameConfig, gameplayFromConfig } from "../utils/singlePlayerConfig.js";
import {
  CAPTURE_SESSION_BUFFER_SEC,
  isZoneUnderAttack,
  normalizeCaptureAttempt,
  resolveCaptureAttemptForGuardAction,
  zoneForSessionCaptureTimer,
} from "../utils/singlePlayerCapture.js";
import { publishGuardEliminatedToOwner } from "../sockets/singlePlayerPublisher.js";

const refreshCaptureAttemptTimer = async (userId, zone, configGameplay, attemptOverride = null) => {
  const attemptKey = captureAttemptRedisKey(userId, zone.id);
  const raw = await redis.get(attemptKey);
  if (!raw) return null;

  const attempt = attemptOverride ?? JSON.parse(raw);
  const zoneForTimer = zoneForSessionCaptureTimer(zone, attempt);
  const captureTimeSec = computeRequiredCaptureSeconds(zoneForTimer, new Date(), configGameplay);
  attempt.captureTimeSec = captureTimeSec;
  await redis.set(
    attemptKey,
    JSON.stringify(attempt),
    "EX",
    captureTimeSec + CAPTURE_SESSION_BUFFER_SEC
  );
  return { captureTimeSec, attemptKey, attempt };
};

/**
 * @Description Get guard inventory and store pricing from game config
 * @Route GET /api/single-player/guards/inventory
 * @Access Private
 */
export const getGuardInventory = async (req, res) => {
  const userId = req.user.id;
  try {
    const [user, configRow] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { spGuardInventory: true, raidrCoins: true },
      }),
      getSpGameConfig(prisma),
    ]);
    const config = gameplayFromConfig(configRow);

    res.status(200).json({
      status: true,
      data: {
        inventory: user?.spGuardInventory ?? 0,
        raidrCoins: user?.raidrCoins ?? 0,
        guardPurchaseCoinPrice: config.guardPurchaseCoinPrice,
        guardEliminationCoinPrice: config.guardEliminationCoinPrice,
        maxGuardsPerZone: config.maxGuardsPerZone,
      },
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Purchase guards with RAIDR Coins (legacy — prefer POST /api/store/purchase with itemType GUARD)
 * @Route POST /api/single-player/guards/purchase
 * @Access Private
 * @deprecated Use Store guard SKUs via GET /api/store/all-items?itemType=GUARD and POST /api/store/purchase
 */
export const purchaseGuards = async (_req, res) => {
  res.set("Deprecation", "true");
  res.set("Link", '</api/store/all-items?itemType=GUARD>; rel="successor-version"');
  return res.status(410).json({
    status: false,
    msg: "Guard purchase moved to the Store. Use GET /api/store/all-items?itemType=GUARD and POST /api/store/purchase.",
    storeItemsPath: "/api/store/all-items?itemType=GUARD",
    storePurchasePath: "/api/store/purchase",
  });
};

/**
 * @Description Assign guards from inventory to an owned zone
 * @Route POST /api/single-player/zones/:id/guards/assign
 * @Access Private
 */
export const assignGuardsToZone = async (req, res) => {
  const userId = req.user.id;
  const { id: zoneId } = req.params;
  const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);

  try {
    const configRow = await getSpGameConfig(prisma);
    const config = gameplayFromConfig(configRow);

    if (await isZoneUnderAttack(zoneId)) {
      return res.status(409).json({
        status: false,
        msg: "Cannot assign guards while your zone is under attack.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const zone = await tx.singlePlayerZone.findUnique({ where: { id: zoneId } });
      if (!zone || !zone.isActive) {
        throw new Error("NOT_FOUND");
      }
      if (!userOwnsSinglePlayerZone(zone, userId)) {
        throw new Error("NOT_OWNER");
      }
      if (zone.guardCount + quantity > config.maxGuardsPerZone) {
        throw new Error("MAX_GUARDS");
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if ((user?.spGuardInventory ?? 0) < quantity) {
        throw new Error("NO_INVENTORY");
      }

      const [updatedZone, updatedUser] = await Promise.all([
        tx.singlePlayerZone.update({
          where: { id: zoneId },
          data: { guardCount: { increment: quantity } },
        }),
        tx.user.update({
          where: { id: userId },
          data: { spGuardInventory: { decrement: quantity } },
          select: { spGuardInventory: true },
        }),
      ]);

      return { zone: updatedZone, inventory: updatedUser.spGuardInventory };
    });

    res.status(200).json({
      status: true,
      msg: "Guards assigned to zone",
      data: {
        zoneId,
        guardCount: result.zone.guardCount,
        inventory: result.inventory,
      },
    });
  } catch (error) {
    if (error.message === "NOT_FOUND") {
      return res.status(404).json({ status: false, msg: "Zone not found or inactive" });
    }
    if (error.message === "NOT_OWNER") {
      return res.status(403).json({ status: false, msg: "You must own this zone to assign guards" });
    }
    if (error.message === "MAX_GUARDS") {
      return res.status(400).json({ status: false, msg: "Maximum guards per zone reached" });
    }
    if (error.message === "NO_INVENTORY") {
      return res.status(400).json({ status: false, msg: "Not enough guards in inventory" });
    }
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Return guards from zone back to inventory (owner only)
 * @Route POST /api/single-player/zones/:id/guards/unassign
 * @Access Private
 */
export const unassignGuardsFromZone = async (req, res) => {
  const userId = req.user.id;
  const { id: zoneId } = req.params;
  const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);

  try {
    if (await isZoneUnderAttack(zoneId)) {
      return res.status(409).json({
        status: false,
        msg: "Cannot change guards while your zone is under attack.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const zone = await tx.singlePlayerZone.findUnique({ where: { id: zoneId } });
      if (!zone || !zone.isActive) {
        throw new Error("NOT_FOUND");
      }
      if (!userOwnsSinglePlayerZone(zone, userId)) {
        throw new Error("NOT_OWNER");
      }
      if (zone.guardCount < quantity) {
        throw new Error("NOT_ENOUGH_ON_ZONE");
      }

      const [updatedZone, updatedUser] = await Promise.all([
        tx.singlePlayerZone.update({
          where: { id: zoneId },
          data: { guardCount: { decrement: quantity } },
        }),
        tx.user.update({
          where: { id: userId },
          data: { spGuardInventory: { increment: quantity } },
          select: { spGuardInventory: true },
        }),
      ]);

      return { zone: updatedZone, inventory: updatedUser.spGuardInventory };
    });

    res.status(200).json({
      status: true,
      msg: "Guards returned to inventory",
      data: {
        zoneId,
        guardCount: result.zone.guardCount,
        inventory: result.inventory,
      },
    });
  } catch (error) {
    if (error.message === "NOT_FOUND") {
      return res.status(404).json({ status: false, msg: "Zone not found or inactive" });
    }
    if (error.message === "NOT_OWNER") {
      return res.status(403).json({ status: false, msg: "You must own this zone to unassign guards" });
    }
    if (error.message === "NOT_ENOUGH_ON_ZONE") {
      return res.status(400).json({ status: false, msg: "Zone does not have that many guards" });
    }
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description During capture, spend coins to eliminate guards for THIS attempt only (not shared with other attackers)
 * @Route POST /api/single-player/zones/:id/capture/eliminate-guards
 * @Access Private
 */
export const eliminateGuardsDuringCapture = async (req, res) => {
  const userId = req.user.id;
  const { id: zoneId } = req.params;
  const requestedCount = req.body.count != null ? parseInt(req.body.count, 10) : null;
  const { latitude, longitude } = req.body;

  try {
    const configRow = await getSpGameConfig(prisma);
    const config = gameplayFromConfig(configRow);

    const zone = await prisma.singlePlayerZone.findUnique({ where: { id: zoneId } });
    if (!zone) {
      return res.status(404).json({ status: false, msg: "Zone not found" });
    }

    const resolved = await resolveCaptureAttemptForGuardAction(userId, zoneId, zone, config, {
      latitude,
      longitude,
      autoStartForEliminate: true,
    });

    if (resolved?.error) {
      const { status, msg, ...rest } = resolved.error;
      return res.status(status).json({ status: false, msg, ...rest });
    }

    if (!resolved?.attempt) {
      return res.status(400).json({
        status: false,
        code: "NO_CAPTURE_SESSION",
        msg: "No active capture attempt. Call POST .../capture/start first, or include latitude and longitude in this request while in the zone.",
      });
    }

    let attempt = resolved.attempt;

    if (attempt.sessionGuardsRemaining <= 0) {
      return res.status(400).json({
        status: false,
        msg: "You have already eliminated all guards for your capture attempt.",
      });
    }

    const eliminateCount =
      requestedCount != null && !Number.isNaN(requestedCount)
        ? Math.min(Math.max(1, requestedCount), attempt.sessionGuardsRemaining)
        : attempt.sessionGuardsRemaining;

    const coinsSpent = eliminateCount * config.guardEliminationCoinPrice;

    const { eliminated } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if ((user?.raidrCoins ?? 0) < coinsSpent) {
        throw new Error("INSUFFICIENT_COINS");
      }

      await tx.user.update({
        where: { id: userId },
        data: { raidrCoins: { decrement: coinsSpent } },
      });

      return { eliminated: eliminateCount };
    });

    attempt.sessionGuardsRemaining -= eliminated;
    attempt.guardsEliminatedInSession += eliminated;

    const timer = await refreshCaptureAttemptTimer(userId, zone, config, attempt);

    const [userAfter, attacker] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { raidrCoins: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, photoUrl: true },
      }),
    ]);

    const ownerId = zone.currentOwnerId;
    if (ownerId && ownerId !== userId) {
      publishGuardEliminatedToOwner(ownerId, {
        zoneId: zone.id,
        zoneName: zone.name,
        zoneGuardCount: zone.guardCount,
        attacker: {
          id: attacker?.id ?? userId,
          name: attacker?.name ?? "Player",
          photoUrl: attacker?.photoUrl ?? null,
        },
        guardsEliminatedThisAction: eliminated,
        guardsEliminatedInSession: attempt.guardsEliminatedInSession,
        sessionGuardsRemaining: attempt.sessionGuardsRemaining,
        initialGuardCount: attempt.initialGuardCount,
        allGuardsClearedInSession: attempt.sessionGuardsRemaining === 0,
        at: new Date().toISOString(),
      });
    }

    res.status(200).json({
      status: true,
      msg: "Guards eliminated",
      data: {
        guardsEliminated: eliminated,
        coinsSpent,
        initialGuardCount: attempt.initialGuardCount,
        sessionGuardsRemaining: attempt.sessionGuardsRemaining,
        guardsEliminatedInSession: attempt.guardsEliminatedInSession,
        /** Guards left for this capture — bind AR / map UI to this (not deployedGuardCount). */
        guardCount: attempt.sessionGuardsRemaining,
        deployedGuardCount: zone.guardCount ?? 0,
        zoneGuardCount: zone.guardCount,
        captureTimeSec: timer?.captureTimeSec,
        raidrCoins: userAfter?.raidrCoins,
      },
    });
  } catch (error) {
    if (error.message === "INSUFFICIENT_COINS") {
      return res.status(400).json({ status: false, msg: "Insufficient RAIDR Coins" });
    }
    res.status(500).json({ status: false, msg: error.message });
  }
};
