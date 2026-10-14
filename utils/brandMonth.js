import {
  notifyUserIfAllowed,
  SP_NOTIFICATION_CATEGORIES,
} from "./singlePlayerNotify.js";

export const BRAND_MONTH_REWARD_TYPE = {
  INLINE: "INLINE",
  COMMERCIAL_VOUCHER: "COMMERCIAL_VOUCHER",
};

export const BRAND_MONTH_PRIZE_STATUS = {
  NONE: "NONE",
  CLAIMED: "CLAIMED",
  SOLD_OUT: "SOLD_OUT",
};

const campaignInWindowWhere = (now) => ({
  isActive: true,
  startDate: { lte: now },
  endDate: { gte: now },
});

/** Active Brand Month campaign (most recently created if several overlap). */
export const findActiveBrandMonthCampaign = async (prisma, now = new Date()) => {
  return prisma.brandMonthCampaign.findFirst({
    where: campaignInWindowWhere(now),
    orderBy: { createdAt: "desc" },
    include: {
      commercialVoucher: true,
      sponsoredTheme: true,
    },
  });
};

export const getOrCreateBrandMonthProgress = async (prisma, userId, campaignId) => {
  return prisma.brandMonthProgress.upsert({
    where: {
      userId_campaignId: { userId, campaignId },
    },
    create: { userId, campaignId, campaignXp: 0 },
    update: {},
  });
};

const rewardDisplayFromCampaign = (campaign) => {
  if (campaign.rewardType === BRAND_MONTH_REWARD_TYPE.COMMERCIAL_VOUCHER && campaign.commercialVoucher) {
    const v = campaign.commercialVoucher;
    return {
      title: v.title,
      sponsorName: v.sponsorName,
      description: v.description,
      imageUrl: v.imageUrl,
      redemptionCode: v.redemptionCode,
    };
  }
  return {
    title: campaign.rewardTitle,
    sponsorName: campaign.rewardSponsorName,
    description: campaign.rewardDescription,
    imageUrl: campaign.rewardImageUrl,
    redemptionCode: campaign.rewardRedemptionCode,
  };
};

/** Client payload for progression UI (map bar, detail screen). */
export const formatBrandMonthForClient = (campaign, progress, userVoucher = null) => {
  if (!campaign) {
    return null;
  }

  const campaignXp = progress?.campaignXp ?? 0;
  const xpTarget = campaign.xpTarget;
  const progressPercent =
    xpTarget > 0 ? Math.min(100, Math.round((campaignXp / xpTarget) * 100)) : 0;
  const xpRemaining = Math.max(0, xpTarget - campaignXp);
  const inventoryRemaining = campaign.inventoryRemaining;
  const inventoryTotal = campaign.inventoryTotal;
  const vouchersSoldOut = inventoryRemaining <= 0;
  const prizeStatus = progress?.prizeStatus ?? BRAND_MONTH_PRIZE_STATUS.NONE;

  let prize = null;
  if (prizeStatus === BRAND_MONTH_PRIZE_STATUS.CLAIMED) {
    const base = rewardDisplayFromCampaign(campaign);
    prize = {
      ...base,
      userVoucherId: progress.userVoucherId ?? null,
      claimedAt: progress.claimedAt,
      redemptionCode:
        userVoucher?.voucher?.redemptionCode ?? base.redemptionCode ?? null,
    };
  }

  return {
    campaignId: campaign.id,
    name: campaign.name,
    description: campaign.description,
    brandLogoUrl: campaign.brandLogoUrl,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    xpTarget,
    campaignXp,
    xpRemaining,
    progressPercent,
    inventoryRemaining,
    inventoryTotal,
    vouchersSoldOut,
    allVouchersClaimed: vouchersSoldOut,
    prizeStatus,
    canStillWinPrize:
      !vouchersSoldOut &&
      prizeStatus !== BRAND_MONTH_PRIZE_STATUS.CLAIMED &&
      prizeStatus !== BRAND_MONTH_PRIZE_STATUS.SOLD_OUT,
    rewardPreview: rewardDisplayFromCampaign(campaign),
    prize,
    sponsoredThemeId: campaign.sponsoredThemeId,
  };
};

/**
 * Attempt FCFS prize claim when user reaches xpTarget. Safe under concurrency via conditional inventory decrement.
 */
export const tryClaimBrandMonthPrize = async (
  prisma,
  userId,
  campaignId,
  { notifyOnPrize = true } = {}
) => {
  return prisma.$transaction(async (tx) => {
    const progress = await tx.brandMonthProgress.findUnique({
      where: { userId_campaignId: { userId, campaignId } },
    });

    if (!progress) {
      return { claimed: false, reason: "NO_PROGRESS" };
    }

    if (progress.prizeStatus === BRAND_MONTH_PRIZE_STATUS.CLAIMED) {
      return { claimed: false, reason: "ALREADY_CLAIMED", progress };
    }

    const campaign = await tx.brandMonthCampaign.findUnique({
      where: { id: campaignId },
      include: { commercialVoucher: true },
    });

    if (!campaign) {
      return { claimed: false, reason: "CAMPAIGN_NOT_FOUND" };
    }

    const now = new Date();
    if (
      !campaign.isActive ||
      campaign.startDate > now ||
      campaign.endDate < now
    ) {
      return { claimed: false, reason: "CAMPAIGN_NOT_ACTIVE" };
    }

    if (progress.campaignXp < campaign.xpTarget) {
      return { claimed: false, reason: "BELOW_TARGET" };
    }

    if (progress.prizeStatus === BRAND_MONTH_PRIZE_STATUS.SOLD_OUT) {
      return { claimed: false, reason: "SOLD_OUT" };
    }

    const stockDec = await tx.brandMonthCampaign.updateMany({
      where: { id: campaignId, inventoryRemaining: { gt: 0 } },
      data: { inventoryRemaining: { decrement: 1 } },
    });

    if (stockDec.count === 0) {
      await tx.brandMonthProgress.update({
        where: { id: progress.id },
        data: { prizeStatus: BRAND_MONTH_PRIZE_STATUS.SOLD_OUT },
      });
      return { claimed: false, reason: "SOLD_OUT" };
    }

    let userVoucherId = null;

    if (campaign.rewardType === BRAND_MONTH_REWARD_TYPE.COMMERCIAL_VOUCHER) {
      if (!campaign.commercialVoucherId) {
        throw new Error("CAMPAIGN_VOUCHER_MISCONFIGURED");
      }
      const userVoucher = await tx.userVoucher.create({
        data: {
          userId,
          voucherId: campaign.commercialVoucherId,
        },
      });
      userVoucherId = userVoucher.id;

      await tx.user.update({
        where: { id: userId },
        data: { rewards_claimed: { increment: 1 } },
      });
    } else {
      await tx.user.update({
        where: { id: userId },
        data: { rewards_claimed: { increment: 1 } },
      });
    }

    const claimedAt = new Date();
    const updatedProgress = await tx.brandMonthProgress.update({
      where: { id: progress.id },
      data: {
        prizeStatus: BRAND_MONTH_PRIZE_STATUS.CLAIMED,
        claimedAt,
        userVoucherId,
      },
    });

    const updatedCampaign = await tx.brandMonthCampaign.findUnique({
      where: { id: campaignId },
      include: { commercialVoucher: true },
    });

    if (notifyOnPrize) {
      const reward = rewardDisplayFromCampaign(updatedCampaign);
      const title = reward.title || campaign.name;
      await notifyUserIfAllowed(
        tx,
        userId,
        SP_NOTIFICATION_CATEGORIES.REWARDS,
        "Brand Month reward unlocked!",
        `You earned: ${title}. Open RAIDR to view your voucher.`
      );
    }

    return {
      claimed: true,
      progress: updatedProgress,
      campaign: updatedCampaign,
    };
  });
};

/**
 * Increment campaign XP for the active Brand Month and auto-claim when eligible.
 */
export const applyBrandMonthXp = async (
  prisma,
  userId,
  xpDelta,
  { notifyOnPrize = true } = {}
) => {
  const amount = Math.max(0, Math.floor(xpDelta ?? 0));
  if (amount === 0) {
    return null;
  }

  const campaign = await findActiveBrandMonthCampaign(prisma);
  if (!campaign) {
    return null;
  }

  const progress = await prisma.brandMonthProgress.upsert({
    where: {
      userId_campaignId: { userId, campaignId: campaign.id },
    },
    create: {
      userId,
      campaignId: campaign.id,
      campaignXp: amount,
    },
    update: {
      campaignXp: { increment: amount },
    },
  });

  if (
    progress.campaignXp >= campaign.xpTarget &&
    progress.prizeStatus === BRAND_MONTH_PRIZE_STATUS.NONE
  ) {
    await tryClaimBrandMonthPrize(prisma, userId, campaign.id, { notifyOnPrize });
  }

  const freshCampaign = await prisma.brandMonthCampaign.findUnique({
    where: { id: campaign.id },
    include: { commercialVoucher: true },
  });
  const freshProgress = await prisma.brandMonthProgress.findUnique({
    where: { userId_campaignId: { userId, campaignId: campaign.id } },
  });

  let userVoucher = null;
  if (freshProgress?.userVoucherId) {
    userVoucher = await prisma.userVoucher.findUnique({
      where: { id: freshProgress.userVoucherId },
      include: { voucher: true },
    });
  }

  return formatBrandMonthForClient(freshCampaign, freshProgress, userVoucher);
};

/** Load active campaign + user progress for dashboard / dedicated endpoint. */
export const getBrandMonthStateForUser = async (prisma, userId, now = new Date()) => {
  const campaign = await prisma.brandMonthCampaign.findFirst({
    where: campaignInWindowWhere(now),
    orderBy: { createdAt: "desc" },
    include: { commercialVoucher: true },
  });

  if (!campaign) {
    return null;
  }

  const progress = await getOrCreateBrandMonthProgress(prisma, userId, campaign.id);

  if (
    progress.campaignXp >= campaign.xpTarget &&
    progress.prizeStatus === BRAND_MONTH_PRIZE_STATUS.NONE &&
    campaign.inventoryRemaining <= 0
  ) {
    const updated = await prisma.brandMonthProgress.update({
      where: { id: progress.id },
      data: { prizeStatus: BRAND_MONTH_PRIZE_STATUS.SOLD_OUT },
    });
    return formatBrandMonthForClient(campaign, updated, null);
  }

  if (
    progress.campaignXp >= campaign.xpTarget &&
    progress.prizeStatus === BRAND_MONTH_PRIZE_STATUS.NONE &&
    campaign.inventoryRemaining > 0
  ) {
    await tryClaimBrandMonthPrize(prisma, userId, campaign.id, {
      notifyOnPrize: false,
    });
  }

  let userVoucher = null;
  if (progress.userVoucherId) {
    userVoucher = await prisma.userVoucher.findUnique({
      where: { id: progress.userVoucherId },
      include: { voucher: true },
    });
  }

  const freshCampaign = await prisma.brandMonthCampaign.findUnique({
    where: { id: campaign.id },
    include: { commercialVoucher: true },
  });

  const freshProgress = await prisma.brandMonthProgress.findUnique({
    where: { userId_campaignId: { userId, campaignId: campaign.id } },
  });

  return formatBrandMonthForClient(
    freshCampaign,
    freshProgress ?? progress,
    userVoucher
  );
};
