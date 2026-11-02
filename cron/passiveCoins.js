import { prisma } from '../config/db.js';
import { getSpGameConfig } from '../utils/singlePlayerConfig.js';
import { applyPassiveCoinsWithDailyCap, economyFromConfigRow } from '../utils/economyConfig.js';
import {
  isSinglePlayerZoneTableReady,
  logSinglePlayerCronSkippedOnce,
  handleSinglePlayerSchemaError,
} from '../utils/singlePlayerSchemaReady.js';

/**
 * @Description Job that awards passive income to players who own a shielded Single Player Zone
 */
export const startPassiveCoinsCron = () => {
    // Run every 5 minutes (5 * 60 * 1000)
    const CRON_INTERVAL_MS = 5 * 60 * 1000;
    const CRON_INTERVAL_HOURS = 5 / 60;

    const runPassiveCoins = async () => {
        try {
            if (!(await isSinglePlayerZoneTableReady(prisma))) {
                logSinglePlayerCronSkippedOnce('Passive coins');
                return;
            }

            const now = new Date();
            
            // Passive income for all owned zones (Phase 2 — not limited to shield window)
            const shieldedZones = await prisma.singlePlayerZone.findMany({
                where: {
                    isActive: true,
                    currentOwnerId: { not: null },
                }
            });

            if (shieldedZones.length === 0) return;

            const [configRow, users] = await Promise.all([
                getSpGameConfig(prisma),
                prisma.user.findMany({
                    where: {
                        id: {
                            in: [...new Set(shieldedZones.map((z) => z.currentOwnerId))],
                        },
                    },
                    select: { id: true, coinBoostMultiplier: true, coinBoostExpiresAt: true },
                }),
            ]);

            const economy = economyFromConfigRow(configRow);
            const vipMin = configRow.empireVipMinOwnedZones ?? 5;
            const vipMultiplier = configRow.vipRewardMultiplier ?? 1.25;
            const dailyCap = economy.passiveCoinsDailyCapPerUser;

            const ownedCounts = {};
            for (const z of shieldedZones) {
                ownedCounts[z.currentOwnerId] = (ownedCounts[z.currentOwnerId] || 0) + 1;
            }

            const ownerBaseCoins = {};
            for (const zone of shieldedZones) {
                const coinsToAward = Math.floor(zone.coinsPerHour * CRON_INTERVAL_HOURS);
                if (coinsToAward > 0) {
                    ownerBaseCoins[zone.currentOwnerId] =
                        (ownerBaseCoins[zone.currentOwnerId] || 0) + coinsToAward;
                }
            }

            const userMap = {};
            for (const user of users) {
                userMap[user.id] = user;
            }

            let awardedUsers = 0;
            for (const [ownerId, baseCoins] of Object.entries(ownerBaseCoins)) {
                const user = userMap[ownerId];
                let finalCoins = baseCoins;

                if (user && user.coinBoostExpiresAt && user.coinBoostExpiresAt > now) {
                    const multiplier = user.coinBoostMultiplier || 1.0;
                    finalCoins = Math.floor(finalCoins * multiplier);
                }

                if ((ownedCounts[ownerId] || 0) >= vipMin && vipMultiplier > 1) {
                    finalCoins = Math.floor(finalCoins * vipMultiplier);
                }

                if (finalCoins <= 0) continue;

                const { awarded } = await applyPassiveCoinsWithDailyCap(
                    prisma,
                    ownerId,
                    finalCoins,
                    dailyCap
                );
                if (awarded > 0) awardedUsers += 1;
            }

            console.log(`[Cron] Passive coins awarded to ${awardedUsers} players.`);
        } catch (error) {
            if (handleSinglePlayerSchemaError(error, 'Passive coins')) return;
            console.error('[Cron] Error running passive coins job:', error);
        }
    };

    setInterval(runPassiveCoins, CRON_INTERVAL_MS);
};
