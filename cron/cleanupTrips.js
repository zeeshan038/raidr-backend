import { prisma } from '../config/db.js';


/**
 * @Description Job that will clean all of the trips that are not saved
 */
export const startCleanupCron = () => {
    // Run immediately on startup, then every 12 hours (12 * 60 * 60 * 1000)
    const runCleanup = async () => {
        try {
            console.log('Running automated cleanup job for abandoned trips...');

            // Find time 24 hours ago
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            // Delete trips older than 24h where routeTitle is null
            const deletedTrips = await prisma.trip.deleteMany({
                where: {
                    routeTitle: null,
                    createdAt: {
                        lt: oneDayAgo
                    }
                }
            });

            console.log(`Cleanup complete. Deleted ${deletedTrips.count} abandoned trips.`);
        } catch (error) {
            console.error('Error running cleanup job:', error);
        }
    };
    
    runCleanup();
    setInterval(runCleanup, 12 * 60 * 60 * 1000);
};
