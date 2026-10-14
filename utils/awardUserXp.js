import { xpRequiredForLevel, userLevelProgressFields } from "./userLevel.js";
import { applyBrandMonthXp } from "./brandMonth.js";

/** Apply XP to level bank and return new level + remainder (same rules as live events / trip). */
export const computeLevelStateAfterXp = (level, xpProgress, xpToAdd) => {
  let lv = Math.max(1, level ?? 1);
  let bank = Math.max(0, xpProgress ?? 0) + Math.max(0, xpToAdd);
  while (bank >= xpRequiredForLevel(lv)) {
    bank -= xpRequiredForLevel(lv);
    lv += 1;
  }
  return { level: lv, xp_progress: bank };
};

/**
 * Award lifetime XP (monotonic xp_earned + level loop) and campaign XP when a Brand Month is active.
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} userId
 * @param {number} amount
 * @param {{ skipBrandMonth?: boolean, notifyOnPrize?: boolean }} [options]
 */
export const awardUserXp = async (prisma, userId, amount, options = {}) => {
  const xpAwarded = Math.max(0, Math.floor(amount ?? 0));

  const userForLevel = await prisma.user.findUnique({
    where: { id: userId },
    select: { level: true, xp_progress: true, xp_earned: true },
  });

  if (!userForLevel) {
    throw new Error("USER_NOT_FOUND");
  }

  if (xpAwarded === 0) {
    return {
      xpAwarded: 0,
      lifetime: {
        level: userForLevel.level,
        xp_earned: userForLevel.xp_earned,
        xp_progress: userForLevel.xp_progress,
        ...userLevelProgressFields(userForLevel),
      },
      brandMonth: null,
    };
  }

  const { level, xp_progress } = computeLevelStateAfterXp(
    userForLevel.level,
    userForLevel.xp_progress,
    xpAwarded
  );

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      xp_earned: { increment: xpAwarded },
      xp_progress,
      level,
    },
  });

  let brandMonth = null;
  if (!options.skipBrandMonth) {
    brandMonth = await applyBrandMonthXp(prisma, userId, xpAwarded, {
      notifyOnPrize: options.notifyOnPrize !== false,
    });
  }

  return {
    xpAwarded,
    lifetime: {
      level: updatedUser.level,
      xp_earned: updatedUser.xp_earned,
      xp_progress: updatedUser.xp_progress,
      ...userLevelProgressFields(updatedUser),
    },
    brandMonth,
  };
};
