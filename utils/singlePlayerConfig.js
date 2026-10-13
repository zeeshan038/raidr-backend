import { SP_DEFAULTS } from "./singlePlayerZone.js";

let cachedConfig = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

/**
 * Load gameplay config from DB (singleton row id=default), with short in-memory cache.
 */
export const getSpGameConfig = async (prisma) => {
  const now = Date.now();
  if (cachedConfig && now - cachedAt < CACHE_MS) {
    return cachedConfig;
  }

  let row = await prisma.singlePlayerGameConfig.findUnique({
    where: { id: "default" },
  });

  if (!row) {
    row = await prisma.singlePlayerGameConfig.create({
      data: { id: "default" },
    });
  }

  cachedConfig = row;
  cachedAt = now;
  return row;
};

export const clearSpGameConfigCache = () => {
  cachedConfig = null;
  cachedAt = 0;
};

/** null in DB = no cap; missing column / undefined defaults to 5. */
export const resolveMaxOwnedZonesPerPlayer = (row) => {
  if (!row || !("maxOwnedZonesPerPlayer" in row)) {
    return 5;
  }
  if (row.maxOwnedZonesPerPlayer === null) {
    return null;
  }
  return row.maxOwnedZonesPerPlayer;
};

/** Map DB config to capture/shield helper shape. */
export const gameplayFromConfig = (row) => ({
  baseCaptureTimeSec: row?.baseCaptureTimeSec ?? SP_DEFAULTS.baseCaptureTimeSec,
  shieldDurationMin: row?.shieldDurationMin ?? SP_DEFAULTS.shieldDurationMin,
  ownershipDefenseSecPerDay:
    row?.ownershipDefenseSecPerDay ?? SP_DEFAULTS.ownershipDefenseSecPerDay,
  secondsPerGuard: row?.secondsPerGuard ?? SP_DEFAULTS.secondsPerGuard,
  maxGuardsPerZone: row?.maxGuardsPerZone ?? SP_DEFAULTS.maxGuardsPerZone,
  guardPurchaseCoinPrice: row?.guardPurchaseCoinPrice ?? 100,
  guardEliminationCoinPrice: row?.guardEliminationCoinPrice ?? 50,
  empireVipMinOwnedZones: row?.empireVipMinOwnedZones ?? 5,
  vipRewardMultiplier: row?.vipRewardMultiplier ?? 1.0,
  rivalryMilestoneHours: row?.rivalryMilestoneHours,
  allowedHoldDurationHours: row?.allowedHoldDurationHours,
  shieldWarningMinutesBefore: row?.shieldWarningMinutesBefore ?? 15,
  maxOwnedZonesPerPlayer: resolveMaxOwnedZonesPerPlayer(row),
});

/**
 * Merchant B2B submissions start pending + inactive until Super Admin approves.
 * Set SP_B2B_AUTO_APPROVE=true in .env for local/staging to skip approval (goes live immediately).
 */
export const isB2bAutoApproveEnabled = () =>
  String(process.env.SP_B2B_AUTO_APPROVE || "").toLowerCase() === "true";

/** Zones visible on the user map (approved B2B or normal admin zones). */
export const userVisibleZoneFilter = {
  isActive: true,
  OR: [
    { zoneType: "NORMAL" },
    { zoneType: "B2B", approvalStatus: "approved" },
  ],
};
