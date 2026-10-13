import crypto from "crypto";
import { prisma } from "../config/db.js";
import {
  computeB2bHoldProgress,
  userOwnsSinglePlayerZone,
} from "../utils/singlePlayerZone.js";
import {
  notifyUserIfAllowed,
  SP_NOTIFICATION_CATEGORIES,
} from "../utils/singlePlayerNotify.js";

/**
 * @Description Claim B2B hold-to-win reward after hold duration is complete
 * @Route POST /api/single-player/zones/:id/b2b/claim
 * @Access Private
 */
export const claimB2bReward = async (req, res) => {
  const userId = req.user.id;
  const { id: zoneId } = req.params;
  const now = new Date();

  try {
    const zone = await prisma.singlePlayerZone.findUnique({ where: { id: zoneId } });
    if (!zone || zone.zoneType !== "B2B" || zone.approvalStatus !== "approved") {
      return res.status(404).json({ status: false, msg: "B2B zone not found" });
    }

    if (!userOwnsSinglePlayerZone(zone, userId)) {
      return res.status(403).json({ status: false, msg: "You must own this zone to claim" });
    }

    if (!zone.holdStartedAt) {
      return res.status(400).json({ status: false, msg: "Hold has not started for this zone" });
    }

    const hold = computeB2bHoldProgress(zone, now);
    if (!hold?.holdComplete) {
      return res.status(400).json({
        status: false,
        msg: "Hold requirement not complete yet",
        data: hold,
      });
    }

    const existing = await prisma.singlePlayerB2bClaim.findUnique({
      where: {
        zoneId_userId_holdStartedAt: {
          zoneId,
          userId,
          holdStartedAt: zone.holdStartedAt,
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        status: false,
        msg: "Reward already claimed for this hold streak",
        data: existing,
      });
    }

    let claimCode = zone.b2bRewardRedemptionCode || null;
    if (zone.b2bRewardType === "DIGITAL_COUPON" && !claimCode) {
      claimCode = `RAIDR-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    }

    const claim = await prisma.singlePlayerB2bClaim.create({
      data: {
        userId,
        zoneId,
        holdStartedAt: zone.holdStartedAt,
        rewardType: zone.b2bRewardType,
        rewardTitle: zone.b2bRewardTitle,
        rewardDescription: zone.b2bRewardDescription,
        claimCode,
      },
    });

    await notifyUserIfAllowed(
      prisma,
      userId,
      SP_NOTIFICATION_CATEGORIES.REWARDS,
      "B2B reward ready",
      `You claimed: ${zone.b2bRewardTitle}`
    );

    res.status(200).json({
      status: true,
      msg: "B2B reward claimed successfully",
      data: claim,
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description List user's B2B campaign claims
 * @Route GET /api/single-player/b2b/claims
 * @Access Private
 */
export const listMyB2bClaims = async (req, res) => {
  try {
    const claims = await prisma.singlePlayerB2bClaim.findMany({
      where: { userId: req.user.id },
      include: {
        zone: {
          select: {
            id: true,
            name: true,
            b2bRewardImageUrl: true,
            brandLogoUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ status: true, data: claims });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Mark a B2B claim as redeemed (e.g. at merchant)
 * @Route POST /api/single-player/b2b/claims/:claimId/redeem
 * @Access Private
 */
export const redeemB2bClaim = async (req, res) => {
  const userId = req.user.id;
  const { claimId } = req.params;

  try {
    const claim = await prisma.singlePlayerB2bClaim.findFirst({
      where: { id: claimId, userId },
    });

    if (!claim) {
      return res.status(404).json({ status: false, msg: "Claim not found" });
    }

    if (claim.isRedeemed) {
      return res.status(400).json({ status: false, msg: "Already redeemed" });
    }

    const updated = await prisma.singlePlayerB2bClaim.update({
      where: { id: claimId },
      data: { isRedeemed: true, redeemedAt: new Date() },
    });

    res.status(200).json({
      status: true,
      msg: "Claim marked as redeemed",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};
