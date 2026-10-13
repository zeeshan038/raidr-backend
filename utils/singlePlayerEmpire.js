import { getSpGameConfig } from "./singlePlayerConfig.js";

export const countOwnedZones = async (prisma, userId) => {
  return prisma.singlePlayerZone.count({
    where: {
      isActive: true,
      currentOwnerId: userId,
    },
  });
};

export const getEmpireStatus = async (prisma, userId) => {
  const [ownedZonesCount, configRow] = await Promise.all([
    countOwnedZones(prisma, userId),
    getSpGameConfig(prisma),
  ]);

  const vipMin = configRow.empireVipMinOwnedZones ?? 5;
  const isVip = ownedZonesCount >= vipMin;

  return {
    ownedZonesCount,
    empireVipMinOwnedZones: vipMin,
    isVip,
    vipRewardMultiplier: configRow.vipRewardMultiplier ?? 1.0,
  };
};

export const userMeetsZoneEligibility = (ownedZonesCount, zone) => {
  const required = zone?.minOwnedZonesRequired;
  if (required == null || required <= 0) return true;
  return ownedZonesCount >= required;
};

/** True when player cannot capture another zone (config maxOwnedZonesPerPlayer). */
export const userAtOwnedZoneCap = (ownedZonesCount, maxOwnedZonesPerPlayer) => {
  if (maxOwnedZonesPerPlayer == null || maxOwnedZonesPerPlayer <= 0) {
    return false;
  }
  return ownedZonesCount >= maxOwnedZonesPerPlayer;
};
