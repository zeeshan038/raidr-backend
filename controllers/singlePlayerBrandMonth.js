import { prisma } from "../config/db.js";
import {
  formatBrandMonthForClient,
  getBrandMonthStateForUser,
  tryClaimBrandMonthPrize,
} from "../utils/brandMonth.js";

/**
 * @Description Get active Brand Month progression (XP bar, voucher inventory, user prize state)
 * @Route GET /api/single-player/brand-month/active
 * @Access Private
 */
export const getActiveBrandMonth = async (req, res) => {
  try {
    const brandMonth = await getBrandMonthStateForUser(prisma, req.user.id);
    res.status(200).json({
      status: true,
      data: brandMonth,
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description List user's Brand Month participation history
 * @Route GET /api/single-player/brand-month/history
 * @Access Private
 */
export const getBrandMonthHistory = async (req, res) => {
  const userId = req.user.id;

  try {
    const rows = await prisma.brandMonthProgress.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        campaign: { include: { commercialVoucher: true } },
        userVoucher: { include: { voucher: true } },
      },
    });

    const data = rows.map((row) =>
      formatBrandMonthForClient(row.campaign, row, row.userVoucher)
    );

    res.status(200).json({ status: true, data });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Claim Brand Month grand prize after reaching xpTarget (FCFS voucher inventory)
 * @Route POST /api/single-player/brand-month/:campaignId/claim
 * @Access Private
 */
export const claimBrandMonthReward = async (req, res) => {
  const userId = req.user.id;
  const { campaignId } = req.params;

  try {
    const result = await tryClaimBrandMonthPrize(prisma, userId, campaignId, {
      notifyOnPrize: true,
    });

    const loadClientState = async (campaign, progress) => {
      let userVoucher = null;
      if (progress?.userVoucherId) {
        userVoucher = await prisma.userVoucher.findUnique({
          where: { id: progress.userVoucherId },
          include: { voucher: true },
        });
      }
      return formatBrandMonthForClient(campaign, progress, userVoucher);
    };

    if (result.claimed) {
      const data = await loadClientState(result.campaign, result.progress);
      return res.status(200).json({
        status: true,
        msg: "Brand Month reward claimed",
        data,
      });
    }

    const reason = result.reason;

    if (reason === "CAMPAIGN_NOT_FOUND") {
      return res.status(404).json({ status: false, msg: "Brand Month campaign not found" });
    }

    if (reason === "ALREADY_CLAIMED") {
      const campaign = await prisma.brandMonthCampaign.findUnique({
        where: { id: campaignId },
        include: { commercialVoucher: true },
      });
      const data =
        campaign && result.progress
          ? await loadClientState(campaign, result.progress)
          : null;
      return res.status(409).json({
        status: false,
        msg: "Brand Month reward already claimed",
        data,
      });
    }

    if (reason === "SOLD_OUT") {
      const campaign = await prisma.brandMonthCampaign.findUnique({
        where: { id: campaignId },
        include: { commercialVoucher: true },
      });
      const progress = await prisma.brandMonthProgress.findUnique({
        where: { userId_campaignId: { userId, campaignId } },
      });
      const data =
        campaign && progress ? await loadClientState(campaign, progress) : null;
      return res.status(400).json({
        status: false,
        msg: "All Brand Month vouchers have been claimed",
        data,
      });
    }

    if (reason === "BELOW_TARGET") {
      return res.status(400).json({
        status: false,
        msg: "Campaign XP target not reached yet",
      });
    }

    if (reason === "NO_PROGRESS") {
      return res.status(400).json({
        status: false,
        msg: "No progress on this Brand Month campaign",
      });
    }

    if (reason === "CAMPAIGN_NOT_ACTIVE") {
      return res.status(400).json({
        status: false,
        msg: "Brand Month campaign is not active",
      });
    }

    return res.status(400).json({ status: false, msg: "Unable to claim Brand Month reward" });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};
