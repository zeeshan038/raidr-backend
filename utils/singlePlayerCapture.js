import { redis } from "../config/redis.js";
import { prisma } from "../config/db.js";
import {
  captureAttemptRedisKey,
  computeCaptureTimeBreakdown,
  computeZonePassiveIncomePreview,
  computeRequiredCaptureSeconds,
  isZoneAttackable,
  SP_DEFAULTS,
  userOwnsSinglePlayerZone,
  validateCaptureLocation,
} from "./singlePlayerZone.js";
import {
  countOwnedZones,
  userAtOwnedZoneCap,
  userMeetsZoneEligibility,
} from "./singlePlayerEmpire.js";

/** Extra Redis TTL after capture timer so AR / leave-screen / retry eliminate still sees session state. */
export const CAPTURE_SESSION_BUFFER_SEC = 600;

/** Valid taps per second in a 1s window to reach max capture speed (2×). */
export const CAPTURE_TAP_RATE_FOR_2X = 4;
export const CAPTURE_TAP_WINDOW_MS = 1000;
export const CAPTURE_TAP_MAX_PER_REQUEST = 8;
export const CAPTURE_TAP_MIN_INTERVAL_MS = 50;
export const CAPTURE_TAP_MIN_REQUEST_INTERVAL_MS = 25;
export const CAPTURE_TICK_MAX_GAP_SEC = 5;
const CAPTURE_TAP_TIMESTAMP_CAP = 40;

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
  ensureCaptureAccelState(attempt);
  return attempt;
};

/** Tap-acceleration fields on Redis capture attempts (server is source of truth). */
export const ensureCaptureAccelState = (attempt, nowMs = Date.now()) => {
  if (attempt.tapCount == null) attempt.tapCount = 0;
  if (attempt.tapRate == null) attempt.tapRate = 0;
  if (attempt.speedMultiplier == null) attempt.speedMultiplier = 1;
  if (!Array.isArray(attempt.recentTapTimestamps)) attempt.recentTapTimestamps = [];
  if (attempt.lastUpdateAt == null) {
    attempt.lastUpdateAt = attempt.startedAt ?? nowMs;
  }
  if (attempt.effectiveElapsedSec == null && attempt.startedAt != null) {
    attempt.effectiveElapsedSec = Math.max(0, (nowMs - attempt.startedAt) / 1000);
  } else if (attempt.effectiveElapsedSec == null) {
    attempt.effectiveElapsedSec = 0;
  }
  return attempt;
};

const pruneTapTimestamps = (attempt, nowMs) => {
  const cutoff = nowMs - CAPTURE_TAP_WINDOW_MS;
  attempt.recentTapTimestamps = (attempt.recentTapTimestamps ?? []).filter((t) => t > cutoff);
  if (attempt.recentTapTimestamps.length > CAPTURE_TAP_TIMESTAMP_CAP) {
    attempt.recentTapTimestamps = attempt.recentTapTimestamps.slice(-CAPTURE_TAP_TIMESTAMP_CAP);
  }
};

export const computeTapRateFromAttempt = (attempt, nowMs = Date.now()) => {
  pruneTapTimestamps(attempt, nowMs);
  return attempt.recentTapTimestamps.length;
};

export const computeSpeedMultiplierFromTapRate = (tapRate) => {
  const rate = Math.max(0, tapRate ?? 0);
  return 1 + Math.min(1, rate / CAPTURE_TAP_RATE_FOR_2X);
};

/**
 * Advance effective capture elapsed by (now - lastUpdateAt) × current speedMultiplier.
 * Recomputes tapRate / speedMultiplier for the *next* interval from recent taps.
 */
export const advanceCaptureElapsed = (attempt, nowMs = Date.now()) => {
  ensureCaptureAccelState(attempt, nowMs);
  const last = attempt.lastUpdateAt ?? attempt.startedAt ?? nowMs;
  let deltaSec = (nowMs - last) / 1000;
  if (deltaSec < 0) deltaSec = 0;
  if (deltaSec > CAPTURE_TICK_MAX_GAP_SEC) deltaSec = CAPTURE_TICK_MAX_GAP_SEC;

  const mult = attempt.speedMultiplier ?? 1;
  attempt.effectiveElapsedSec = (attempt.effectiveElapsedSec ?? 0) + deltaSec * mult;
  attempt.lastUpdateAt = nowMs;

  attempt.tapRate = computeTapRateFromAttempt(attempt, nowMs);
  attempt.speedMultiplier = computeSpeedMultiplierFromTapRate(attempt.tapRate);
  return attempt;
};

/**
 * Record validated taps (rate-limited). Call advanceCaptureElapsed first or rely on this to tick once.
 * Returns { accepted, rejected, throttled }.
 */
export const applyCaptureTaps = (attempt, nowMs = Date.now(), requestedTaps = 1) => {
  ensureCaptureAccelState(attempt, nowMs);

  if (attempt.lastTapRequestAt != null && nowMs - attempt.lastTapRequestAt < CAPTURE_TAP_MIN_REQUEST_INTERVAL_MS) {
    advanceCaptureElapsed(attempt, nowMs);
    return { accepted: 0, rejected: requestedTaps, throttled: true };
  }
  attempt.lastTapRequestAt = nowMs;

  advanceCaptureElapsed(attempt, nowMs);

  const want = Math.min(Math.max(1, requestedTaps), CAPTURE_TAP_MAX_PER_REQUEST);
  let accepted = 0;
  for (let i = 0; i < want; i++) {
    const tapAt = nowMs - (want - 1 - i) * CAPTURE_TAP_MIN_INTERVAL_MS;
    const lastTap = attempt.recentTapTimestamps[attempt.recentTapTimestamps.length - 1];
    if (lastTap != null && tapAt - lastTap < CAPTURE_TAP_MIN_INTERVAL_MS) {
      break;
    }
    attempt.recentTapTimestamps.push(tapAt);
    attempt.tapCount += 1;
    accepted += 1;
  }

  attempt.tapRate = computeTapRateFromAttempt(attempt, nowMs);
  attempt.speedMultiplier = computeSpeedMultiplierFromTapRate(attempt.tapRate);

  return { accepted, rejected: want - accepted, throttled: false };
};

export const getCaptureTimerMetrics = (attempt, nowMs = Date.now()) => {
  advanceCaptureElapsed(attempt, nowMs);
  const captureTimeSec = attempt.captureTimeSec ?? 0;
  const effectiveElapsedSec = Math.max(0, attempt.effectiveElapsedSec ?? 0);
  const remainingSec = Math.max(0, Math.ceil(captureTimeSec - effectiveElapsedSec));
  const eligibleToComplete = remainingSec <= 0;
  const captureProgressPercent =
    captureTimeSec > 0
      ? Math.min(100, Math.round((effectiveElapsedSec / captureTimeSec) * 100))
      : 0;
  const showGuardElimination =
    !eligibleToComplete && (attempt.sessionGuardsRemaining ?? 0) > 0;

  return {
    remainingSec,
    eligibleToComplete,
    canComplete: eligibleToComplete,
    captureProgressPercent,
    elapsedSec: Math.max(0, Math.floor(effectiveElapsedSec)),
    effectiveElapsedSec,
    tapCount: attempt.tapCount ?? 0,
    tapRate: attempt.tapRate ?? 0,
    speedMultiplier: attempt.speedMultiplier ?? 1,
    showGuardElimination,
  };
};

export const zoneForSessionCaptureTimer = (zone, attempt) => ({
  ...zone,
  guardCount: attempt.sessionGuardsRemaining ?? zone.guardCount ?? 0,
});

/**
 * After guard elimination: shorten capture time by secondsPerGuard × eliminated.
 * Never increases total or remaining vs before this action (avoids lazy-start / recompute spikes).
 */
export const recomputeCaptureTimeAfterGuardElimination = (
  attempt,
  zone,
  config,
  eliminatedCount,
  now = new Date()
) => {
  const secondsPerGuard = config.secondsPerGuard ?? SP_DEFAULTS.secondsPerGuard;
  advanceCaptureElapsed(attempt, now.getTime());
  const elapsedSec = Math.max(0, attempt.effectiveElapsedSec ?? 0);
  const zoneForTimer = zoneForSessionCaptureTimer(zone, attempt);
  const formulaTotal = computeRequiredCaptureSeconds(zoneForTimer, now, config);
  const previousTotal = attempt.captureTimeSec ?? formulaTotal;
  const previousRemaining = Math.max(0, previousTotal - elapsedSec);
  const remainingAfterElim = Math.max(0, previousRemaining - eliminatedCount * secondsPerGuard);
  const totalFromRemaining = elapsedSec + remainingAfterElim;

  const floorTotal = computeRequiredCaptureSeconds(
    zoneForSessionCaptureTimer(zone, { ...attempt, sessionGuardsRemaining: 0 }),
    now,
    config
  );

  attempt.captureTimeSec = Math.max(
    floorTotal,
    Math.min(formulaTotal, totalFromRemaining, previousTotal)
  );
  return attempt.captureTimeSec;
};

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
  const breakdownTotal =
    captureTimeBreakdown.baseSec +
    captureTimeBreakdown.ownershipDefenseSec +
    captureTimeBreakdown.guardPenaltySec;
  zoneData.captureTimeSec = activeCaptureSession.captureTimeSec ?? breakdownTotal;
  zoneData.defenseBonusSec =
    captureTimeBreakdown.ownershipDefenseSec + captureTimeBreakdown.guardPenaltySec;

  const passivePreview = computeZonePassiveIncomePreview(zone);
  if (passivePreview) {
    if (zone.zoneType === "B2B") {
      zoneData.b2b = {
        ...(zoneData.b2b ?? {}),
        passiveIncomePreview: passivePreview,
      };
    } else {
      zoneData.normal = { passiveIncomePreview: passivePreview };
    }
  }

  return zoneData;
};

export const formatActiveCaptureSessionFromAttempt = (attempt) => {
  if (!attempt?.startedAt) return null;
  const captureTimeSec = attempt.captureTimeSec ?? 0;
  const timer = getCaptureTimerMetrics(attempt);

  return {
    initialGuardCount: attempt.initialGuardCount,
    sessionGuardsRemaining: attempt.sessionGuardsRemaining,
    guardsEliminatedInSession: attempt.guardsEliminatedInSession,
    captureTimeSec,
    startedAt: new Date(attempt.startedAt).toISOString(),
    remainingSec: timer.remainingSec,
    elapsedSec: timer.elapsedSec,
    captureProgressPercent: timer.captureProgressPercent,
    eligibleToComplete: timer.eligibleToComplete,
    canComplete: timer.canComplete,
    tapCount: timer.tapCount,
    tapRate: timer.tapRate,
    speedMultiplier: timer.speedMultiplier,
    showGuardElimination: timer.showGuardElimination,
  };
};

export const getActiveCaptureSessionForUser = async (userId, zoneId, zoneGuardCount = 0) => {
  if (!userId || !zoneId) return null;

  const raw = await redis.get(captureAttemptRedisKey(userId, zoneId));
  if (!raw) return null;

  const attempt = normalizeCaptureAttempt(JSON.parse(raw), zoneGuardCount);
  return formatActiveCaptureSessionFromAttempt(attempt);
};
