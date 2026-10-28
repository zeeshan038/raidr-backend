import { redis } from "../config/redis.js";
import { prisma } from "../config/db.js";
import {
  captureAttemptRedisKey,
  computeCaptureTimeBreakdown,
  computeRequiredCaptureSeconds,
  isZoneAttackable,
  userOwnsSinglePlayerZone,
  validateCaptureLocation,
} from "./singlePlayerZone.js";
import {
  countOwnedZones,
  userAtOwnedZoneCap,
  userMeetsZoneEligibility,
} from "./singlePlayerEmpire.js";

export const CAPTURE_SESSION_BUFFER_SEC = 120;

export const zoneAttackersRedisKey = (zoneId) => `single_player:zone:${zoneId}:attackers`;

export const registerZoneAttacker = async (zoneId, userId, ttlSec) => {
  const key = zoneAttackersRedisKey(zoneId);
  await redis.sadd(key, userId);
  await redis.expire(key, Math.max(ttlSec, 60));
};

export const unregisterZoneAttacker = async (zoneId, userId) => {
  await redis.srem(zoneAttackersRedisKey(zoneId), userId);
};

export const clearZoneAttackers = async (zoneId) => {
  await redis.del(zoneAttackersRedisKey(zoneId));
};

export const isZoneUnderAttack = async (zoneId) => {
  const count = await redis.scard(zoneAttackersRedisKey(zoneId));
  return count > 0;
};

/** Snapshot at capture/start — each attacker eliminates their own copy, not a shared pool. */
export const normalizeCaptureAttempt = (attempt, zoneGuardCount = 0) => {
  if (attempt.initialGuardCount == null) {
    attempt.initialGuardCount = zoneGuardCount;
  }
  if (attempt.sessionGuardsRemaining == null) {
    attempt.sessionGuardsRemaining = attempt.initialGuardCount;
  }
  if (attempt.guardsEliminatedInSession == null) {
    attempt.guardsEliminatedInSession = 0;
  }
  return attempt;
};

export const zoneForSessionCaptureTimer = (zone, attempt) => ({
  ...zone,
  guardCount: attempt.sessionGuardsRemaining ?? zone.guardCount ?? 0,
});

/** Active capture attempt in Redis (guard elimination is session-only; zone.guardCount in DB is unchanged). */
export const persistCaptureAttempt = async (userId, zoneId, attempt, captureTimeSec) => {
  const sessionTtl = captureTimeSec + CAPTURE_SESSION_BUFFER_SEC;
  await redis.set(captureAttemptRedisKey(userId, zoneId), JSON.stringify(attempt), "EX", sessionTtl);
  await registerZoneAttacker(zoneId, userId, sessionTtl);
};

/**
 * Load Redis capture session, or recover / lazy-start when the app calls eliminate-guards
 * without a session (e.g. AR opened before start, or Redis key lost while attacker set remains).
 */
const buildFreshCaptureAttempt = (userId, zoneId, zone, gameplay, zoneGuardCount) => {
  const now = Date.now();
  const captureTimeSec = computeRequiredCaptureSeconds(zone, new Date(now), gameplay);
  const attempt = normalizeCaptureAttempt(
    {
      zoneId,
      userId,
      startedAt: now,
      captureTimeSec,
      targetOwnerId: zone.currentOwnerId ?? null,
      initialGuardCount: zoneGuardCount,
      sessionGuardsRemaining: zoneGuardCount,
      guardsEliminatedInSession: 0,
    },
    zoneGuardCount
  );
  return { attempt, captureTimeSec };
};

export const resolveCaptureAttemptForGuardAction = async (
  userId,
  zoneId,
  zone,
  gameplay,
  { latitude = null, longitude = null, autoStartForEliminate = false } = {}
) => {
  const zoneGuardCount = zone.guardCount ?? 0;
  const raw = await redis.get(captureAttemptRedisKey(userId, zoneId));
  if (raw) {
    return { attempt: normalizeCaptureAttempt(JSON.parse(raw), zoneGuardCount) };
  }

  const isRegisteredAttacker = Number(await redis.sismember(zoneAttackersRedisKey(zoneId), userId)) === 1;
  if (isRegisteredAttacker) {
    const { attempt, captureTimeSec } = buildFreshCaptureAttempt(userId, zoneId, zone, gameplay, zoneGuardCount);
    await persistCaptureAttempt(userId, zoneId, attempt, captureTimeSec);
    return { attempt, recovered: true };
  }

  const hasCoords = latitude != null && longitude != null;
  if (!hasCoords && !autoStartForEliminate) {
    return null;
  }

  const now = new Date();
  if (!zone?.isActive) {
    return { error: { status: 404, msg: "Zone not found or inactive" } };
  }
  if (zone.zoneType === "B2B" && zone.approvalStatus !== "approved") {
    return { error: { status: 400, msg: "This zone is not available yet." } };
  }
  if (userOwnsSinglePlayerZone(zone, userId)) {
    return { error: { status: 400, msg: "You already own this zone." } };
  }
  if (!isZoneAttackable(zone, now)) {
    return { error: { status: 400, msg: "Zone is currently shielded by another player." } };
  }

  if (autoStartForEliminate && zoneGuardCount <= 0) {
    return { error: { status: 400, msg: "This zone has no guards to eliminate." } };
  }

  if (hasCoords) {
    const locationCheck = validateCaptureLocation(zone, latitude, longitude);
    if (!locationCheck.ok) {
      return { error: { status: 400, msg: locationCheck.msg } };
    }
  }

  const ownedCount = await countOwnedZones(prisma, userId);
  if (!userMeetsZoneEligibility(ownedCount, zone)) {
    return {
      error: {
        status: 403,
        msg: `This campaign requires owning at least ${zone.minOwnedZonesRequired} zones.`,
        ownedZonesCount: ownedCount,
      },
    };
  }
  if (userAtOwnedZoneCap(ownedCount, gameplay.maxOwnedZonesPerPlayer)) {
    return {
      error: {
        status: 403,
        msg: `You can own at most ${gameplay.maxOwnedZonesPerPlayer} zones.`,
        ownedZonesCount: ownedCount,
        maxOwnedZonesPerPlayer: gameplay.maxOwnedZonesPerPlayer,
      },
    };
  }

  const { attempt, captureTimeSec } = buildFreshCaptureAttempt(userId, zoneId, zone, gameplay, zoneGuardCount);
  await persistCaptureAttempt(userId, zoneId, attempt, captureTimeSec);
  return { attempt, lazyStarted: true };
};

export const extendCaptureSessionTtl = async (userId, zoneId, captureTimeSec) => {
  const key = captureAttemptRedisKey(userId, zoneId);
  const raw = await redis.get(key);
  if (!raw) return false;
  const ttl = (captureTimeSec ?? 0) + CAPTURE_SESSION_BUFFER_SEC;
  await redis.set(key, raw, "EX", Math.max(ttl, 60));
  await registerZoneAttacker(zoneId, userId, ttl);
  return true;
};

/**
 * While a player is mid-capture, zone.guardCount (DB) is the owner's deployed defense.
 * Attackers must see sessionGuardsRemaining on the main guardCount field when they return to the screen.
 */
export const applyCaptureSessionToZoneClientView = (
  zoneData,
  activeCaptureSession,
  userOwnsZone,
  zone,
  config,
  now = new Date()
) => {
  if (!activeCaptureSession || userOwnsZone || !zone) {
    return zoneData;
  }

  zoneData.deployedGuardCount = zoneData.guardCount ?? zone.guardCount ?? 0;
  zoneData.guardCount = activeCaptureSession.sessionGuardsRemaining ?? 0;

  const zoneForTimer = {
    ...zone,
    guardCount: zoneData.guardCount,
  };
  const captureTimeBreakdown = zone.currentOwnerId
    ? computeCaptureTimeBreakdown(zoneForTimer, now, config)
    : computeCaptureTimeBreakdown({ ...zoneForTimer, ownedAt: null, guardCount: 0 }, now, config);

  zoneData.captureTimeBreakdown = captureTimeBreakdown;
  zoneData.captureTimeSec =
    captureTimeBreakdown.baseSec +
    captureTimeBreakdown.ownershipDefenseSec +
    captureTimeBreakdown.guardPenaltySec;
  zoneData.defenseBonusSec =
    captureTimeBreakdown.ownershipDefenseSec + captureTimeBreakdown.guardPenaltySec;

  return zoneData;
};

export const getActiveCaptureSessionForUser = async (userId, zoneId, zoneGuardCount = 0) => {
  if (!userId || !zoneId) return null;

  const raw = await redis.get(captureAttemptRedisKey(userId, zoneId));
  if (!raw) return null;

  const attempt = normalizeCaptureAttempt(JSON.parse(raw), zoneGuardCount);
  const elapsedSec = (Date.now() - attempt.startedAt) / 1000;
  const remainingSec = Math.max(0, Math.ceil(attempt.captureTimeSec - elapsedSec));

  return {
    initialGuardCount: attempt.initialGuardCount,
    sessionGuardsRemaining: attempt.sessionGuardsRemaining,
    guardsEliminatedInSession: attempt.guardsEliminatedInSession,
    captureTimeSec: attempt.captureTimeSec,
    startedAt: new Date(attempt.startedAt).toISOString(),
    remainingSec,
  };
};
