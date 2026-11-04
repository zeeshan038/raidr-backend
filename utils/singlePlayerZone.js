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

/** Must match `cron/passiveCoins.js` interval (5 minutes). */
export const PASSIVE_COINS_CRON_INTERVAL_MS = 5 * 60 * 1000;
export const PASSIVE_COINS_CRON_INTERVAL_HOURS = 5 / 60;

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

/**
 * NORMAL zone passive bar: progress vs top earner on this zone (100% = leader's coins from zone).
 * @param {object} ledgerStats - { yourCoins, leaderCoins, leaderUserId? }
 */
export const computeNormalPassiveCoinProgress = (zone, ledgerStats = {}) => {
  if (zone?.zoneType !== "NORMAL" || !zone.ownedAt) {
    return null;
  }

  const coinsPerHour = zone.coinsPerHour ?? 0;
  const yourCoins = Math.max(0, Math.floor(ledgerStats.yourCoins ?? 0));
  const leaderCoins = Math.max(0, Math.floor(ledgerStats.leaderCoins ?? 0));
  const barMax = Math.max(leaderCoins, yourCoins);
  const progressPercent =
    barMax <= 0 ? 0 : Math.min(100, Math.round((yourCoins / barMax) * 100));

  return {
    coinsPerHour,
    yourCoinsFromZone: yourCoins,
    leaderCoinsFromZone: leaderCoins,
    progressPercent,
    isLeader: yourCoins > 0 && yourCoins >= leaderCoins,
    leaderUserId: ledgerStats.leaderUserId ?? null,
    ownedAt: zone.ownedAt instanceof Date ? zone.ownedAt.toISOString() : zone.ownedAt,
  };
};

/** Shown during snatch — passive rate after capture completes (NORMAL + B2B). */
export const computeZonePassiveIncomePreview = (zone) => {
  if (zone?.zoneType !== "NORMAL" && zone?.zoneType !== "B2B") return null;
  const coinsPerHour = zone.coinsPerHour ?? 0;
  return {
    coinsPerHour,
    coinsPerAccrualCycle: Math.floor(coinsPerHour * PASSIVE_COINS_CRON_INTERVAL_HOURS),
    accrualCycleMinutes: PASSIVE_COINS_CRON_INTERVAL_MS / (60 * 1000),
  };
};

/** NORMAL snatch preview only (legacy callers). */
export const computeNormalPassiveIncomePreview = (zone) =>
  zone?.zoneType === "NORMAL" ? computeZonePassiveIncomePreview(zone) : null;

/**
 * B2B owned during hold: coin bar vs max for this hold window.
 * maxCoinsFromHold = holdDurationHours × coinsPerHour.
 * coinsEarnedInHold = passive ledger total for this user+zone (cron increments).
 */
export const computeB2bPassiveCoinProgress = (zone, coinsEarnedFromZone = 0) => {
  if (zone?.zoneType !== "B2B" || !zone.holdDurationHours || !zone.holdStartedAt) {
    return null;
  }
  const coinsPerHour = zone.coinsPerHour ?? 0;
  const maxCoinsFromHold = Math.floor(zone.holdDurationHours * coinsPerHour);
  const coinsEarnedInHold = Math.max(0, Math.floor(coinsEarnedFromZone ?? 0));
  const coinProgressPercent =
    maxCoinsFromHold <= 0
      ? 0
      : Math.min(100, Math.round((coinsEarnedInHold / maxCoinsFromHold) * 100));

  return {
    coinsPerHour,
    maxCoinsFromHold,
    coinsEarnedInHold,
    coinProgressPercent,
  };
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
    normal: null,
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
