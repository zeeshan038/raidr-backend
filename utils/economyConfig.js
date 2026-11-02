import { getSpGameConfig } from "./singlePlayerConfig.js";

/** PDF-approved defaults when DB columns are missing (pre-migration). */
export const ECONOMY_DEFAULTS = {
  dailyDropCoinsNormal: 10,
  rareDropBonusCoins: 25,
  coinRushCheckpointXpMin: 50,
  coinRushCheckpointXpMax: 100,
  coinRushCheckpointCoins: 1,
  liveEventXpReward: 200,
  liveEventRedeemCoins: 10,
  brandMonthActionCoins: 10,
  b2bHoldCompleteXp: 100,
  b2bHoldCompleteCoins: 20,
  merchantAdInteractionXp: 25,
  referralRewardXp: 100,
  referralRewardCoins: 25,
  defaultZoneCoinsPerHour: 10,
  passiveCoinsDailyCapPerUser: 240,
};

export const economyFromConfigRow = (row) => ({
  dailyDropCoinsNormal: row?.dailyDropCoinsNormal ?? ECONOMY_DEFAULTS.dailyDropCoinsNormal,
  rareDropBonusCoins: row?.rareDropBonusCoins ?? ECONOMY_DEFAULTS.rareDropBonusCoins,
  coinRushCheckpointXpMin:
    row?.coinRushCheckpointXpMin ?? ECONOMY_DEFAULTS.coinRushCheckpointXpMin,
  coinRushCheckpointXpMax:
    row?.coinRushCheckpointXpMax ?? ECONOMY_DEFAULTS.coinRushCheckpointXpMax,
  coinRushCheckpointCoins:
    row?.coinRushCheckpointCoins ?? ECONOMY_DEFAULTS.coinRushCheckpointCoins,
  liveEventXpReward: row?.liveEventXpReward ?? ECONOMY_DEFAULTS.liveEventXpReward,
  liveEventRedeemCoins: row?.liveEventRedeemCoins ?? ECONOMY_DEFAULTS.liveEventRedeemCoins,
  brandMonthActionCoins: row?.brandMonthActionCoins ?? ECONOMY_DEFAULTS.brandMonthActionCoins,
  b2bHoldCompleteXp: row?.b2bHoldCompleteXp ?? ECONOMY_DEFAULTS.b2bHoldCompleteXp,
  b2bHoldCompleteCoins: row?.b2bHoldCompleteCoins ?? ECONOMY_DEFAULTS.b2bHoldCompleteCoins,
  merchantAdInteractionXp:
    row?.merchantAdInteractionXp ?? ECONOMY_DEFAULTS.merchantAdInteractionXp,
  referralRewardXp: row?.referralRewardXp ?? ECONOMY_DEFAULTS.referralRewardXp,
  referralRewardCoins: row?.referralRewardCoins ?? ECONOMY_DEFAULTS.referralRewardCoins,
  defaultZoneCoinsPerHour: row?.defaultZoneCoinsPerHour ?? ECONOMY_DEFAULTS.defaultZoneCoinsPerHour,
  passiveCoinsDailyCapPerUser:
    row?.passiveCoinsDailyCapPerUser ?? ECONOMY_DEFAULTS.passiveCoinsDailyCapPerUser,
});

export const getEconomyConfig = async (prisma) => {
  const row = await getSpGameConfig(prisma);
  return economyFromConfigRow(row);
};

export const randomIntInclusive = (min, max) => {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
};

export const randomCoinRushCheckpointXp = (economy) =>
  randomIntInclusive(economy.coinRushCheckpointXpMin, economy.coinRushCheckpointXpMax);

/** UTC date key YYYY-MM-DD for passive coin daily cap. */
export const utcDayKey = (date = new Date()) =>
  date.toISOString().slice(0, 10);

/**
 * Credit coins and log transaction. Amount must be positive.
 * @param {import("@prisma/client").PrismaClient | import("@prisma/client").Prisma.TransactionClient} db
 */
export const awardRaidrCoins = async (
  db,
  userId,
  amount,
  source,
  { linkedReferralId = null } = {}
) => {
  const coins = Math.max(0, Math.floor(amount ?? 0));
  if (coins === 0) {
    return { coinsAwarded: 0 };
  }

  await db.user.update({
    where: { id: userId },
    data: { raidrCoins: { increment: coins } },
  });

  await db.coinTransaction.create({
    data: {
      userId,
      amount: coins,
      source,
      linkedReferralId,
    },
  });

  return { coinsAwarded: coins };
};

/**
 * Apply passive coin grant respecting per-user daily cap (UTC day).
 * @returns {{ awarded: number, capped: boolean }}
 */
export const applyPassiveCoinsWithDailyCap = async (
  db,
  userId,
  baseCoins,
  dailyCap
) => {
  const want = Math.max(0, Math.floor(baseCoins ?? 0));
  if (want === 0 || dailyCap <= 0) {
    return { awarded: 0, capped: false };
  }

  const dayKey = utcDayKey();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { passiveCoinsAccruedToday: true, passiveCoinsAccrualDay: true },
  });

  if (!user) {
    return { awarded: 0, capped: false };
  }

  let accrued = user.passiveCoinsAccrualDay === dayKey ? user.passiveCoinsAccruedToday : 0;
  const room = Math.max(0, dailyCap - accrued);
  const awarded = Math.min(want, room);
  if (awarded === 0) {
    if (user.passiveCoinsAccrualDay !== dayKey) {
      await db.user.update({
        where: { id: userId },
        data: { passiveCoinsAccrualDay: dayKey, passiveCoinsAccruedToday: 0 },
      });
    }
    return { awarded: 0, capped: true };
  }

  await db.user.update({
    where: { id: userId },
    data: {
      raidrCoins: { increment: awarded },
      passiveCoinsAccrualDay: dayKey,
      passiveCoinsAccruedToday: accrued + awarded,
    },
  });

  await db.coinTransaction.create({
    data: {
      userId,
      amount: awarded,
      source: "passive_zone",
    },
  });

  return { awarded, capped: awarded < want };
};

/** Public subset for mobile game-config labels. */
export const economyForClient = (economy) => ({
  dailyDropCoinsNormal: economy.dailyDropCoinsNormal,
  rareDropBonusCoins: economy.rareDropBonusCoins,
  coinRushCheckpointCoins: economy.coinRushCheckpointCoins,
  liveEventXpReward: economy.liveEventXpReward,
  liveEventRedeemCoins: economy.liveEventRedeemCoins,
  referralRewardXp: economy.referralRewardXp,
  referralRewardCoins: economy.referralRewardCoins,
});
