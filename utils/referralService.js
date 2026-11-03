import crypto from "crypto";
import { prisma } from "../config/db.js";
import { notifyUserIfMasterEnabled } from "./singlePlayerNotify.js";
import { buildPushData, PUSH_TYPE } from "./pushNotificationPayload.js";
import { awardUserXp } from "./awardUserXp.js";
import { awardRaidrCoins, ECONOMY_DEFAULTS, getEconomyConfig } from "./economyConfig.js";

/** @deprecated Use getEconomyConfig().referralRewardCoins */
export const REFERRAL_REWARD_COINS = ECONOMY_DEFAULTS.referralRewardCoins;
const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CODE_GENERATION_ATTEMPTS = 12;

export function normalizeInviteCodeInput(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const legacyInvitePath = trimmed.match(/\/invite\/([A-Za-z0-9]+)\/?$/i);
  if (legacyInvitePath) {
    return legacyInvitePath[1].toUpperCase();
  }

  // https://raidr.app/EDX6YR or https://raidr.app/EDX6YR/
  const shortLinkPath = trimmed.match(/^https?:\/\/[^/?#]+\/([A-Za-z0-9]{4,32})\/?(?:[?#].*)?$/i);
  if (shortLinkPath) {
    return shortLinkPath[1].toUpperCase();
  }

  return trimmed.toUpperCase();
}

export function buildInviteShareUrl(inviteCode) {
  const base = (process.env.RAIDR_INVITE_BASE_URL || "https://raidr.app").replace(/\/$/, "");
  const code = String(inviteCode || "").trim();
  return `${base}/${code}`;
}

function generateInviteCodeCandidate() {
  const bytes = crypto.randomBytes(INVITE_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

export async function generateUniqueInviteCode(db = prisma) {
  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
    const candidate = generateInviteCodeCandidate();
    const existing = await db.user.findUnique({
      where: { inviteCode: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }
  throw new Error("Unable to generate a unique invite code");
}

export async function ensureUserInviteCode(userId, db = prisma) {
  const current = await db.user.findUnique({
    where: { id: userId },
    select: { inviteCode: true },
  });
  if (current?.inviteCode) {
    return current.inviteCode;
  }

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
    const candidate = await generateUniqueInviteCode(db);
    try {
      const updated = await db.user.updateMany({
        where: { id: userId, inviteCode: null },
        data: { inviteCode: candidate },
      });
      if (updated.count === 1) {
        return candidate;
      }
      const raced = await db.user.findUnique({
        where: { id: userId },
        select: { inviteCode: true },
      });
      if (raced?.inviteCode) {
        return raced.inviteCode;
      }
    } catch (error) {
      if (error?.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  const finalUser = await db.user.findUnique({
    where: { id: userId },
    select: { inviteCode: true },
  });
  if (finalUser?.inviteCode) {
    return finalUser.inviteCode;
  }
  throw new Error("Unable to assign invite code to user");
}

export async function resolveInviterFromInviteCode(rawCode, db = prisma) {
  const normalized = normalizeInviteCodeInput(rawCode);
  if (!normalized || normalized.length < 4 || normalized.length > 32) {
    return null;
  }

  return db.user.findUnique({
    where: { inviteCode: normalized },
    select: { id: true, name: true },
  });
}

/**
 * Validates an invite code for signup. Invalid codes are ignored at signup (no error).
 */
export async function resolveReferrerIdForNewUser(rawCode, { excludeUserId } = {}, db = prisma) {
  const inviter = await resolveInviterFromInviteCode(rawCode, db);
  if (!inviter) {
    return null;
  }
  if (excludeUserId && inviter.id === excludeUserId) {
    return null;
  }
  return inviter.id;
}

export async function validateInviteCodeForClient(rawCode, db = prisma) {
  const normalized = normalizeInviteCodeInput(rawCode);
  if (!normalized) {
    return { valid: false, msg: "Invite code is required" };
  }

  const inviter = await resolveInviterFromInviteCode(normalized, db);
  if (!inviter) {
    return { valid: false, msg: "Invalid invite code" };
  }

  return {
    valid: true,
    inviteCode: normalized,
    inviterName: inviter.name,
  };
}

/**
 * Awards referral coins to the inviter. Idempotent per invited user.
 * Expects invitee.referredByUserId to already be set.
 */
export async function completeReferralReward(invitedUserId, db = prisma) {
  const invitee = await db.user.findUnique({
    where: { id: invitedUserId },
    select: { id: true, referredByUserId: true },
  });

  if (!invitee?.referredByUserId) {
    return { completed: false, reason: "no_referrer" };
  }

  const inviterId = invitee.referredByUserId;
  if (inviterId === invitedUserId) {
    return { completed: false, reason: "self_referral" };
  }

  const existingReward = await db.referralReward.findUnique({
    where: { invitedUserId },
    select: { id: true, status: true, inviterId: true, rewardCoins: true },
  });

  if (existingReward?.status === "completed") {
    return {
      completed: true,
      alreadyCompleted: true,
      inviterId: existingReward.inviterId,
      rewardCoins: existingReward.rewardCoins,
    };
  }

  const inviter = await db.user.findUnique({
    where: { id: inviterId },
    select: { id: true, fcmToken: true },
  });

  if (!inviter) {
    return { completed: false, reason: "inviter_not_found" };
  }

  const economy = await getEconomyConfig(db);
  const rewardCoins = economy.referralRewardCoins;
  const rewardXp = economy.referralRewardXp;

  try {
    const reward = await db.referralReward.create({
      data: {
        inviterId,
        invitedUserId,
        rewardCoins,
        status: "completed",
      },
    });

    await awardRaidrCoins(db, inviterId, rewardCoins, "referral", {
      linkedReferralId: reward.id,
    });

    if (rewardXp > 0) {
      await awardUserXp(db, inviterId, rewardXp, { skipBrandMonth: true });
    }

    return {
      completed: true,
      alreadyCompleted: false,
      inviterId,
      inviterFcmToken: inviter.fcmToken,
      rewardCoins,
      rewardXp,
    };
  } catch (error) {
    if (error?.code === "P2002") {
      const raced = await db.referralReward.findUnique({
        where: { invitedUserId },
        select: { inviterId: true, rewardCoins: true, status: true },
      });
      if (raced?.status === "completed") {
        return {
          completed: true,
          alreadyCompleted: true,
          inviterId: raced.inviterId,
          rewardCoins: raced.rewardCoins,
        };
      }
    }
    throw error;
  }
}

export async function createUserWithReferral(userCreateData, rawInviteCode, db = prisma) {
  const referredByUserId = rawInviteCode
    ? await resolveReferrerIdForNewUser(rawInviteCode, {}, db)
    : null;

  const data = referredByUserId
    ? { ...userCreateData, referredByUserId }
    : userCreateData;

  return db.$transaction(async (tx) => {
    const user = await tx.user.create({ data });
    await ensureUserInviteCode(user.id, tx);
    return { user, referralResult: null, referredByUserId };
  });
}

/**
 * Inviter reward after invitee completes a qualifying in-app action (not at signup).
 */
export async function tryCompleteReferralQualifyingActivity(invitedUserId, db = prisma) {
  const referralResult = await completeReferralReward(invitedUserId, db);
  if (referralResult?.completed && !referralResult.alreadyCompleted) {
    await processReferralRewardAfterSignup(referralResult);
  }
  return referralResult;
}

export async function processReferralRewardAfterSignup(referralResult) {
  if (
    !referralResult?.completed ||
    referralResult.alreadyCompleted ||
    !referralResult.inviterId
  ) {
    return;
  }

  try {
    await notifyUserIfMasterEnabled(
      prisma,
      referralResult.inviterId,
      "Referral reward",
      `You've earned ${referralResult.rewardCoins} coins${referralResult.rewardXp ? ` and ${referralResult.rewardXp} XP` : ""}!`,
      buildPushData({ type: PUSH_TYPE.REFERRAL_REWARD })
    );
  } catch (error) {
    console.error("Referral push notification failed:", error?.message || error);
  }
}

export function extractInviteCodeFromRequestBody(body) {
  if (!body || typeof body !== "object") return null;
  return body.inviteCode ?? body.invite_code ?? null;
}
