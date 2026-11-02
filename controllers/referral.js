import { prisma } from "../config/db.js";
import { ValidateReferralSchema } from "../schema/Referral.js";
import {
  buildInviteShareUrl,
  completeReferralReward,
  ensureUserInviteCode,
  extractInviteCodeFromRequestBody,
  processReferralRewardAfterSignup,
  validateInviteCodeForClient,
} from "../utils/referralService.js";
import { getEconomyConfig } from "../utils/economyConfig.js";

/**
 * @Description Validate invite code (signup UI)
 * @Route POST /api/referral/validate
 * @Access Public
 */
export const validateReferralCode = async (req, res) => {
  const result = ValidateReferralSchema(req.body);
  if (result.error) {
    return res.status(400).json({ status: false, msg: result.error.message });
  }

  try {
    const rawCode = extractInviteCodeFromRequestBody(req.body);
    const validation = await validateInviteCodeForClient(rawCode);

    if (!validation.valid) {
      return res.status(200).json({
        status: true,
        data: { valid: false, msg: validation.msg },
      });
    }

    const economy = await getEconomyConfig(prisma);
    return res.status(200).json({
      status: true,
      data: {
        valid: true,
        inviteCode: validation.inviteCode,
        inviterName: validation.inviterName,
        rewardCoins: economy.referralRewardCoins,
        rewardXp: economy.referralRewardXp,
      },
    });
  } catch (error) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Get current user's invite code and share link
 * @Route GET /api/referral/my-code
 * @Access Private
 */
export const getMyReferralCode = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ status: false, msg: "Not authorized" });
  }

  try {
    const inviteCode = await ensureUserInviteCode(userId);
    const economy = await getEconomyConfig(prisma);

    return res.status(200).json({
      status: true,
      data: {
        inviteCode,
        shareUrl: buildInviteShareUrl(inviteCode),
        rewardCoins: economy.referralRewardCoins,
        rewardXp: economy.referralRewardXp,
      },
    });
  } catch (error) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Referral stats for inviter
 * @Route GET /api/referral/stats
 * @Access Private
 */
export const getReferralStats = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ status: false, msg: "Not authorized" });
  }

  try {
    await ensureUserInviteCode(userId);

    const [aggregate, recentRewards] = await Promise.all([
      prisma.referralReward.aggregate({
        where: { inviterId: userId, status: "completed" },
        _count: { _all: true },
        _sum: { rewardCoins: true },
      }),
      prisma.referralReward.findMany({
        where: { inviterId: userId, status: "completed" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          rewardCoins: true,
          createdAt: true,
          invitedUser: {
            select: { name: true },
          },
        },
      }),
    ]);

    const [user, economy] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { inviteCode: true },
      }),
      getEconomyConfig(prisma),
    ]);

    return res.status(200).json({
      status: true,
      data: {
        inviteCode: user?.inviteCode,
        shareUrl: user?.inviteCode ? buildInviteShareUrl(user.inviteCode) : null,
        friendsInvited: aggregate._count._all,
        totalCoinsEarned: aggregate._sum.rewardCoins ?? 0,
        rewardCoinsPerReferral: economy.referralRewardCoins,
        rewardXpPerReferral: economy.referralRewardXp,
        recentRewards: recentRewards.map((row) => ({
          id: row.id,
          rewardCoins: row.rewardCoins,
          createdAt: row.createdAt,
          invitedUserName: row.invitedUser?.name ?? "Friend",
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Idempotent referral payout for the authenticated invitee
 * @Route POST /api/referral/redeem
 * @Access Private
 */
export const redeemReferralReward = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ status: false, msg: "Not authorized" });
  }

  try {
    const referralResult = await prisma.$transaction(async (tx) =>
      completeReferralReward(userId, tx)
    );

    if (!referralResult.completed) {
      return res.status(200).json({
        status: true,
        msg: "No referral reward to redeem",
        data: { redeemed: false, reason: referralResult.reason },
      });
    }

    await processReferralRewardAfterSignup(referralResult);

    return res.status(200).json({
      status: true,
      msg: referralResult.alreadyCompleted
        ? "Referral reward already redeemed"
        : "Referral reward redeemed",
      data: {
        redeemed: !referralResult.alreadyCompleted,
        alreadyRedeemed: Boolean(referralResult.alreadyCompleted),
        rewardCoins: referralResult.rewardCoins,
      },
    });
  } catch (error) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};
