import { redis } from "../config/redis.js";

/** Active snatch attempts on a zone (owners cannot reassign guards while set is non-empty). */
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
