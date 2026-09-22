import { prisma } from '../config/db.js';

/**
 * @Description Job that resets Single Player Zones to available once their shield expires
 */
export const startResetZonesCron = () => {
    // Run every 1 minute
    const CRON_INTERVAL_MS = 60 * 1000;

    const runResetZones = async () => {
        try {
            const now = new Date();
            
            // Find and update zones where shield has expired
            const result = await prisma.singlePlayerZone.updateMany({
                where: {
                    currentOwnerId: { not: null },
                    shieldExpiresAt: { lte: now }
                },
                data: {
                    currentOwnerId: null,
                    shieldExpiresAt: null
                }
            });

            if (result.count > 0) {
                console.log(`[Cron] Reset ${result.count} zones to available as their shields expired.`);
            }
        } catch (error) {
            console.error('[Cron] Error running reset zones job:', error);
        }
    };

    // Run first iteration after the interval
    setInterval(runResetZones, CRON_INTERVAL_MS);
};
