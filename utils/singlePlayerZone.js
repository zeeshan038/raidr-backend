/**
 * Single Player Phase 2 — zone state, capture duration, API shaping.
 */

import { haversineDistance } from "./methods/methods.js";

export const SP_DEFAULTS = {
  baseCaptureTimeSec: 30,
  shieldDurationMin: 60,
  ownershipDefenseSecPerDay: 10,
  secondsPerGuard: 30,
  maxGuardsPerZone: 5,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const isShieldActive = (zone, now = new Date()) => {
  if (!zone?.shieldExpiresAt) return false;
  return new Date(zone.shieldExpiresAt) > now;
};

/** Player is the current owner (ownership persists after shield expires). */
export const userOwnsSinglePlayerZone = (zone, userId) => {
  return Boolean(userId && zone?.currentOwnerId && zone.currentOwnerId === userId);
};

export const isZoneAttackable = (zone, now = new Date()) => {
  if (!zone?.currentOwnerId) return true;
  return !isShieldActive(zone, now);
};

export const computeOwnershipDefenseSeconds = (ownedAt, now = new Date(), secPerDay = SP_DEFAULTS.ownershipDefenseSecPerDay) => {
  if (!ownedAt) return 0;
  const ownedMs = now.getTime() - new Date(ownedAt).getTime();
  if (ownedMs <= 0) return 0;
  const fullDays = Math.floor(ownedMs / MS_PER_DAY);
  return fullDays * secPerDay;
};

export const computeRequiredCaptureSeconds = (zone, now = new Date(), config = SP_DEFAULTS) => {
  const base = config.baseCaptureTimeSec ?? SP_DEFAULTS.baseCaptureTimeSec;
  const defense = computeOwnershipDefenseSeconds(
    zone?.ownedAt,
    now,
    config.ownershipDefenseSecPerDay ?? SP_DEFAULTS.ownershipDefenseSecPerDay
  );
  const guardCount = Math.min(
    zone?.guardCount ?? 0,
    config.maxGuardsPerZone ?? SP_DEFAULTS.maxGuardsPerZone
  );
  const guardPenalty = guardCount * (config.secondsPerGuard ?? SP_DEFAULTS.secondsPerGuard);
  return base + defense + guardPenalty;
};

export const deriveZonePlayerStatus = (zone, userId, now = new Date()) => {
  if (!zone?.currentOwnerId) {
    return "available";
  }
  if (userId && zone.currentOwnerId === userId) {
    return "conquered_by_me";
  }
  return "conquered_by_others";
};

export const computeB2bHoldProgress = (zone, now = new Date()) => {
  if (zone?.zoneType !== "B2B" || !zone.holdDurationHours || !zone.holdStartedAt) {
    return null;
  }
  const targetMs = zone.holdDurationHours * 60 * 60 * 1000;
  const elapsedMs = Math.max(0, now.getTime() - new Date(zone.holdStartedAt).getTime());
  const holdRemainingMs = Math.max(0, targetMs - elapsedMs);
  const progressPercent =
    targetMs > 0 ? Math.min(100, Math.round((elapsedMs / targetMs) * 100)) : 0;

  return {
    holdDurationHours: zone.holdDurationHours,
    holdElapsedHours: Math.min(zone.holdDurationHours, elapsedMs / (60 * 60 * 1000)),
    holdComplete: elapsedMs >= targetMs,
    holdStartedAt: zone.holdStartedAt,
    progressPercent,
    holdRemainingSeconds: Math.ceil(holdRemainingMs / 1000),
  };
};

/** Map legend pin type for discovery UI (Figma main map). */
export const deriveMapPinType = (zone, userId, now = new Date()) => {
  if (zone?.zoneType === "B2B") {
    return "B2B";
  }
  const status = deriveZonePlayerStatus(zone, userId, now);
  if (status === "conquered_by_me") {
    return "YOUR_ZONE";
  }
  if (status === "available") {
    return "NEUTRAL";
  }
  if (status === "conquered_by_others") {
    return isZoneAttackable(zone, now) ? "VULNERABLE" : "ENEMY_SHIELDED";
  }
  return "NEUTRAL";
};

export const computeCaptureTimeBreakdown = (zone, now = new Date(), config = SP_DEFAULTS) => {
  const maxGuards = config.maxGuardsPerZone ?? SP_DEFAULTS.maxGuardsPerZone;
  const guardCount = Math.min(zone?.guardCount ?? 0, maxGuards);
  const secondsPerGuard = config.secondsPerGuard ?? SP_DEFAULTS.secondsPerGuard;
  return {
    baseSec: config.baseCaptureTimeSec ?? SP_DEFAULTS.baseCaptureTimeSec,
    ownershipDefenseSec: computeOwnershipDefenseSeconds(
      zone?.ownedAt,
      now,
      config.ownershipDefenseSecPerDay ?? SP_DEFAULTS.ownershipDefenseSecPerDay
    ),
    guardPenaltySec: guardCount * secondsPerGuard,
    guardCount,
  };
};

export const formatSinglePlayerZoneForClient = (
  zone,
  userId,
  now = new Date(),
  config = SP_DEFAULTS,
  ownedZonesCount = null
) => {
  const shieldActive = isShieldActive(zone, now);
  const attackable = isZoneAttackable(zone, now);
  const status = deriveZonePlayerStatus(zone, userId, now);
  const mapPinType = deriveMapPinType(zone, userId, now);

  const captureTimeBreakdown = zone.currentOwnerId
    ? computeCaptureTimeBreakdown(zone, now, config)
    : computeCaptureTimeBreakdown(
        { ...zone, ownedAt: null, guardCount: 0 },
        now,
        config
      );
  const requiredCaptureSeconds =
    captureTimeBreakdown.baseSec +
    captureTimeBreakdown.ownershipDefenseSec +
    captureTimeBreakdown.guardPenaltySec;

  const b2bHold = computeB2bHoldProgress(zone, now);
  const minRequired = zone.minOwnedZonesRequired ?? 0;
  const meetsEligibility =
    ownedZonesCount == null
      ? null
      : minRequired <= 0 || ownedZonesCount >= minRequired;

  return {
    ...zone,
    status,
    isShieldActive: shieldActive,
    isAttackable: attackable,
    ownedAt: zone.ownedAt ?? null,
    guardCount: zone.guardCount ?? 0,
    maxGuardsPerZone: config.maxGuardsPerZone ?? SP_DEFAULTS.maxGuardsPerZone,
    mapPinType,
    captureTimeSec: requiredCaptureSeconds,
    captureTimeBreakdown,
    defenseBonusSec:
      captureTimeBreakdown.ownershipDefenseSec + captureTimeBreakdown.guardPenaltySec,
    minOwnedZonesRequired: zone.minOwnedZonesRequired ?? null,
    eligibilityNote: zone.eligibilityNote ?? null,
    brandLogoUrl: zone.brandLogoUrl ?? null,
    meetsEligibility,
    b2b:
      zone.zoneType === "B2B"
        ? {
            rewardType: zone.b2bRewardType,
            rewardTitle: zone.b2bRewardTitle,
            rewardDescription: zone.b2bRewardDescription,
            rewardImageUrl: zone.b2bRewardImageUrl,
            hold: b2bHold,
            canClaim: Boolean(
              b2bHold?.holdComplete &&
                userId &&
                zone.currentOwnerId === userId
            ),
          }
        : null,
  };
};

export const captureAttemptRedisKey = (userId, zoneId) => `single_player:capture:${userId}:${zoneId}`;

export const validateCaptureLocation = (zone, latitude, longitude) => {
  const distance = haversineDistance(
    parseFloat(zone.latitude),
    parseFloat(zone.longitude),
    parseFloat(latitude),
    parseFloat(longitude)
  );
  if (distance > zone.radius) {
    return {
      ok: false,
      msg: `You must be within ${zone.radius}m of the zone.`,
    };
  }
  return { ok: true };
};
