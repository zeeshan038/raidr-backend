import { prisma } from '../config/db.js';
import { publishEventStatusChanged, publishCommanderMessage } from '../sockets/eventPublisher.js';
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
                        sendNotification(part.user.fcmToken, "⏳ Your Raid Starts Soon!", `"${event.title}" begins in 20 minutes. Get ready and be there from the start to maximize your rewards!`)
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
                            sendNotification(user.fcmToken, "🚨 Raid Begins in 10 Minutes!", `Just 10 minutes until "${event.title}" goes live. Get ready to jump into the adventure!`)
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
                        sendNotification(user.fcmToken, "🚀 The Raid Is Live!", `"${event.title}" has officially started. Head there now and secure your rewards before others do!`)
                            .catch(err => console.error(`Cron Notif Err for user ${user.id}:`, err));
                    }
                }
            }

            // --- 5 minutes before ending: Broadcast Commander Message ---
            const min5_start = new Date(now.getTime() + 4 * 60000);
            const min5_end = new Date(now.getTime() + 5 * 60000);
            const eventsEndingSoon = await prisma.liveEvent.findMany({
                where: {
                    status: 'live',
                    endTime: { gt: min5_start, lte: min5_end }
                }
            });
            for (const event of eventsEndingSoon) {
                publishCommanderMessage(event.id, '⏳ Hurry up! Only 5 minutes left in the event! Claim your rewards! 🎁', 'system');
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
                    publishCommanderMessage(event.id, '🛑 The event has ended! Thank you for participating! 🎉', 'system');

                    for (const user of allUsersWithTokens) {
                        sendNotification(user.fcmToken, "✅ Raid Completed!", `"${event.title}" has officially ended. Thanks for joining us, and we'll see you at the next adventure!`)
                            .catch(err => console.error(`Cron Notif Err for user ${user.id}:`, err));
                    }
                }
            }

        } catch (error) {
            console.error('[Cron] Error updating event statuses:', error);
        }
    }, 60000); // Check every minute
};
 