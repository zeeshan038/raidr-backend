import { prisma } from '../config/db.js';
import { publishEventStatusChanged } from '../sockets/eventPublisher.js';

export const startEventStatusCron = () => {
    setInterval(async () => {
        try {
            const now = new Date();
            const eventsToStart = await prisma.liveEvent.findMany({
                where: {
                    status: 'scheduled',
                    startTime: { lte: now }
                }
            });

            for (const event of eventsToStart) {
                await prisma.liveEvent.update({
                    where: { id: event.id },
                    data: { status: 'live' }
                });
                console.log(`[Cron] Event ${event.id} is now LIVE`);
                publishEventStatusChanged(event.id, 'live');
            }

            const eventsToComplete = await prisma.liveEvent.findMany({
                where: {
                    status: 'live',
                    endTime: { lte: now }
                }
            }); 

            for (const event of eventsToComplete) {
                await prisma.liveEvent.update({
                    where: { id: event.id },
                    data: { status: 'completed' }
                });
                console.log(`[Cron] Event ${event.id} is now COMPLETED`);
                publishEventStatusChanged(event.id, 'completed');
            }

        } catch (error) {
            console.error('[Cron] Error updating event statuses:', error);
        }
    }, 60000); // Check every minute
};
 