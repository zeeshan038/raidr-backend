import { prisma } from '../config/db.js';
import { publishEventStatusChanged } from '../sockets/eventPublisher.js';
import { sendNotification } from '../utils/Notification.js';
import { calculateRadiusForUserLiveEvent } from '../utils/methods/methods.js';

export const startEventStatusCron = () => {
    setInterval(async () => {
        try {
            const now = new Date();

            const min20_start = new Date(now.getTime() + 19 * 60000);
            const min20_end = new Date(now.getTime() + 20 * 60000);

            const min10_start = new Date(now.getTime() + 9 * 60000);
            const min10_end = new Date(now.getTime() + 10 * 60000);

            // --- 20 minutes before: Notify participants ---
            const events20Mins = await prisma.liveEvent.findMany({
                where: {
                    status: 'scheduled',
                    startTime: { gt: min20_start, lte: min20_end }
                },
                include: { participants: { include: { user: true } } }
            });

            for (const event of events20Mins) {
                for (const part of event.participants) {
                    if (part.user.fcmToken) {
                        sendNotification(part.user.fcmToken, "Event Starting Soon!", `Event "${event.title}" is starting in 20 minutes!`)
                            .catch(err => console.error(`Cron Notif Err for user ${part.user.id}:`, err));
                    }
                }
            }

            // --- 10 minutes before: Notify nearby users (not participants) ---
            const events10Mins = await prisma.liveEvent.findMany({
                where: {
                    status: 'scheduled',
                    startTime: { gt: min10_start, lte: min10_end }
                },
                include: { participants: { select: { userId: true } } }
            });

            if (events10Mins.length > 0) {
                const allUsersWithTokens = await prisma.user.findMany({
                    where: { fcmToken: { not: null } },
                    select: { id: true, fcmToken: true, lat: true, long: true }
                });

                for (const event of events10Mins) {
                    const participantIds = event.participants.map(p => p.userId);
                    const nearbyUsers = calculateRadiusForUserLiveEvent(allUsersWithTokens, event.latitude, event.longitude, 20);
                    
                    for (const user of nearbyUsers) {
                        if (!participantIds.includes(user.id)) {
                            sendNotification(user.fcmToken, "Event Starting Soon!", `An event "${event.title}" near you is starting in 10 minutes!`)
                                .catch(err => console.error(`Cron Notif Err for user ${user.id}:`, err));
                        }
                    }
                }
            }

            // --- Event goes Live ---
            const eventsToStart = await prisma.liveEvent.findMany({
                where: {
                    status: 'scheduled',
                    startTime: { lte: now }
                }
            });

            if (eventsToStart.length > 0) {
                const allUsersWithTokens = await prisma.user.findMany({
                    where: { fcmToken: { not: null } },
                    select: { id: true, fcmToken: true }
                });

                for (const event of eventsToStart) {
                    await prisma.liveEvent.update({
                        where: { id: event.id },
                        data: { status: 'live' }
                    });
                    console.log(`[Cron] Event ${event.id} is now LIVE`);
                    publishEventStatusChanged(event.id, 'live');

                    for (const user of allUsersWithTokens) {
                        sendNotification(user.fcmToken, "Event is Live!", `Event "${event.title}" is now LIVE! Join in!`)
                            .catch(err => console.error(`Cron Notif Err for user ${user.id}:`, err));
                    }
                }
            }

            // --- Event gets Completed ---
            const eventsToComplete = await prisma.liveEvent.findMany({
                where: {
                    status: 'live',
                    endTime: { lte: now }
                }
            }); 

            if (eventsToComplete.length > 0) {
                const allUsersWithTokens = await prisma.user.findMany({
                    where: { fcmToken: { not: null } },
                    select: { id: true, fcmToken: true }
                });

                for (const event of eventsToComplete) {
                    await prisma.liveEvent.update({
                        where: { id: event.id },
                        data: { status: 'completed' }
                    });
                    console.log(`[Cron] Event ${event.id} is now COMPLETED`);
                    publishEventStatusChanged(event.id, 'completed');

                    for (const user of allUsersWithTokens) {
                        sendNotification(user.fcmToken, "Event Completed", `Event "${event.title}" has successfully ended.`)
                            .catch(err => console.error(`Cron Notif Err for user ${user.id}:`, err));
                    }
                }
            }

        } catch (error) {
            console.error('[Cron] Error updating event statuses:', error);
        }
    }, 60000); // Check every minute
};
 