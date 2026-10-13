import { prisma } from '../config/db.js';
import { getSpGameConfig } from '../utils/singlePlayerConfig.js';

/**
 * @Description Job that awards passive income to players who own a shielded Single Player Zone
 */
export const startPassiveCoinsCron = () => {
    // Run every 5 minutes (5 * 60 * 1000)
    const CRON_INTERVAL_MS = 5 * 60 * 1000;
    const CRON_INTERVAL_HOURS = 5 / 60;

    const runPassiveCoins = async () => {
        try {
            const now = new Date();
            
            // Passive income for all owned zones (Phase 2 — not limited to shield window)
            const shieldedZones = await prisma.singlePlayerZone.findMany({
                where: {
                    isActive: true,
                    currentOwnerId: { not: null },
                }
            });

            if (shieldedZones.length === 0) return;

            // Group coins by owner to avoid multiple database calls for the same user
            const ownerCoins = {};
            for (const zone of shieldedZones) {
                const coinsToAward = Math.floor(zone.coinsPerHour * CRON_INTERVAL_HOURS);
                if (coinsToAward > 0) {
                    ownerCoins[zone.currentOwnerId] = (ownerCoins[zone.currentOwnerId] || 0) + coinsToAward;
                }
            }

            // Fetch users to check for active boosts
            const userIds = Object.keys(ownerCoins);
            const [users, configRow] = await Promise.all([
                prisma.user.findMany({
                    where: { id: { in: userIds } },
                    select: { id: true, coinBoostMultiplier: true, coinBoostExpiresAt: true }
                }),
                getSpGameConfig(prisma),
            ]);

            const vipMin = configRow.empireVipMinOwnedZones ?? 5;
            const vipMultiplier = configRow.vipRewardMultiplier ?? 1.0;

            const ownedCounts = {};
            for (const z of shieldedZones) {
                ownedCounts[z.currentOwnerId] = (ownedCounts[z.currentOwnerId] || 0) + 1;
            }
            
            const userMap = {};
            for (const user of users) {
                userMap[user.id] = user;
            }

            // Update user wallets concurrently
            const updatePromises = Object.entries(ownerCoins).map(([ownerId, baseCoins]) => {
                const user = userMap[ownerId];
                let finalCoins = baseCoins;
                
                // Apply multiplier if boost is active
                if (user && user.coinBoostExpiresAt && user.coinBoostExpiresAt > now) {
                    const multiplier = user.coinBoostMultiplier || 1.0;
                    finalCoins = Math.floor(finalCoins * multiplier);
                }

                if ((ownedCounts[ownerId] || 0) >= vipMin && vipMultiplier > 1) {
                    finalCoins = Math.floor(finalCoins * vipMultiplier);
                }

                return prisma.user.update({
                    where: { id: ownerId },
                    data: { raidrCoins: { increment: finalCoins } }
                });
            });

            await Promise.all(updatePromises);
            console.log(`[Cron] Passive coins awarded to ${updatePromises.length} players.`);
        } catch (error) {
            console.error('[Cron] Error running passive coins job:', error);
        }
    };

    // Run first iteration after the interval
    setInterval(runPassiveCoins, CRON_INTERVAL_MS);
};
