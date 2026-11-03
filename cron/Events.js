import { prisma } from '../config/db.js';
import { publishEventStatusChanged, publishCommanderMessage } from '../sockets/eventPublisher.js';
import { publishToCoinRush } from '../sockets/coinRushPublisher.js';
import {
    notifyUserIfAllowed,
    notifyUserIfMasterEnabled,
    SP_NOTIFICATION_CATEGORIES,
} from '../utils/singlePlayerNotify.js';
import { buildPushData, EVENT_KIND, PUSH_TYPE } from '../utils/pushNotificationPayload.js';
import { calculateRadiusForUserLiveEvent } from '../utils/methods/methods.js';

const liveRaidData = (type, eventId) =>
    buildPushData({
        type,
        eventId,
        eventKind: EVENT_KIND.LIVE_RAID,
    });

const coinRushData = (type, eventId) =>
    buildPushData({
        type,
        eventId,
        eventKind: EVENT_KIND.COIN_RUSH,
    });

export const startEventStatusCron = () => {
    setInterval(async () => {
        try {
            const now = new Date();

            const min20_start = new Date(now.getTime() + 19 * 60000);
            const min20_end = new Date(now.getTime() + 20 * 60000);

            const min10_start = new Date(now.getTime() + 9 * 60000);
            const min10_end = new Date(now.getTime() + 10 * 60000);

            const events20Mins = await prisma.liveEvent.findMany({
                where: {
                    status: 'scheduled',
                    startTime: { gt: min20_start, lte: min20_end }
                },
                include: { participants: { include: { user: true } } }
            });

            for (const event of events20Mins) {
                for (const part of event.participants) {
                    await notifyUserIfMasterEnabled(
                        prisma,
                        part.userId,
                        "⏳ Your Raid Starts Soon!",
                        `"${event.title}" begins in 20 minutes. Get ready and be there from the start to maximize your rewards!`,
                        liveRaidData(PUSH_TYPE.LIVE_RAID_STARTS_20M, event.id)
                    );
                }
            }

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
                            await notifyUserIfAllowed(
                                prisma,
                                user.id,
                                SP_NOTIFICATION_CATEGORIES.PROMO,
                                "🚨 Raid Begins in 10 Minutes!",
                                `Just 10 minutes until "${event.title}" goes live. Get ready to jump into the adventure!`,
                                liveRaidData(PUSH_TYPE.LIVE_RAID_STARTS_10M, event.id)
                            );
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
                    select: { id: true, fcmToken: true, lat: true, long: true }
                });

                for (const event of eventsToStart) {
                    await prisma.liveEvent.update({
                        where: { id: event.id },
                        data: { status: 'live' }
                    });
                    console.log(`[Cron] Event ${event.id} is now LIVE`);
                    publishEventStatusChanged(event.id, 'live');

                    const nearbyUsers = calculateRadiusForUserLiveEvent(allUsersWithTokens, event.latitude, event.longitude, 20);
                    for (const user of nearbyUsers) {
                        await notifyUserIfAllowed(
                            prisma,
                            user.id,
                            SP_NOTIFICATION_CATEGORIES.PROMO,
                            "🚀 The Raid Is Live!",
                            `"${event.title}" has officially started. Head there now and secure your rewards before others do!`,
                            liveRaidData(PUSH_TYPE.LIVE_RAID_LIVE, event.id)
                        );
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
                },
                include: {
                    participants: {
                        include: {
                            user: {
                                select: { id: true, fcmToken: true }
                            }
                        }
                    }
                }
            }); 

            if (eventsToComplete.length > 0) {
                for (const event of eventsToComplete) {
                    await prisma.liveEvent.update({
                        where: { id: event.id },
                        data: { status: 'completed' }
                    });
                    console.log(`[Cron] Event ${event.id} is now COMPLETED`);
                    publishEventStatusChanged(event.id, 'completed');
                    publishCommanderMessage(event.id, '🛑 The event has ended! Thank you for participating! 🎉', 'system');

                    for (const part of event.participants) {
                        if (part.user) {
                            await notifyUserIfMasterEnabled(
                                prisma,
                                part.userId,
                                "✅ Raid Completed!",
                                `"${event.title}" has officially ended. Thanks for joining us, and we'll see you at the next adventure!`,
                                liveRaidData(PUSH_TYPE.LIVE_RAID_COMPLETED, event.id)
                            );
                        }
                    }
                }
            }


            const coinRush20Mins = await prisma.coinRushEvent.findMany({
                where: {
                    status: 'scheduled',
                    startTime: { gt: min20_start, lte: min20_end }
                },
                include: { participants: { include: { user: true } } }
            });

            for (const event of coinRush20Mins) {
                for (const part of event.participants) {
                    await notifyUserIfAllowed(
                        prisma,
                        part.userId,
                        SP_NOTIFICATION_CATEGORIES.COIN_RUSH,
                        "⏳ Coin Rush Starts Soon!",
                        `"${event.title}" begins in 20 minutes. Warm up and get ready to collect coins!`,
                        coinRushData(PUSH_TYPE.COIN_RUSH_STARTS_20M, event.id)
                    );
                }
            }

            // --- Coin Rush: 10 minutes before — push notification to all users ---
            const coinRush10Mins = await prisma.coinRushEvent.findMany({
                where: {
                    status: 'scheduled',
                    startTime: { gt: min10_start, lte: min10_end }
                },
                include: { participants: { select: { userId: true } } }
            });

            if (coinRush10Mins.length > 0) {
                const allUsersWithTokens = await prisma.user.findMany({
                    where: { fcmToken: { not: null } },
                    select: { id: true, fcmToken: true, lat: true, long: true }
                });

                for (const event of coinRush10Mins) {
                    if (!event.centerLat || !event.centerLng) continue;
                    const participantIds = event.participants.map(p => p.userId);
                    const nearbyUsers = calculateRadiusForUserLiveEvent(allUsersWithTokens, event.centerLat, event.centerLng, 600);
                    for (const user of nearbyUsers) {
                        if (!participantIds.includes(user.id)) {
                            await notifyUserIfAllowed(
                                prisma,
                                user.id,
                                SP_NOTIFICATION_CATEGORIES.COIN_RUSH,
                                "🪙 Coin Rush in 10 Minutes!",
                                `"${event.title}" is starting soon. Join now and race to collect coins!`,
                                coinRushData(PUSH_TYPE.COIN_RUSH_STARTS_10M, event.id)
                            );
                        }
                    }
                }
            }

            // --- Coin Rush: goes Live (scheduled → live) ---
            const coinRushToStart = await prisma.coinRushEvent.findMany({
                where: {
                    status: 'scheduled',
                    startTime: { lte: now }
                }
            });

            if (coinRushToStart.length > 0) {
                const allUsersWithTokens = await prisma.user.findMany({
                    where: { fcmToken: { not: null } },
                    select: { id: true, fcmToken: true, lat: true, long: true }
                });

                for (const event of coinRushToStart) {
                    await prisma.coinRushEvent.update({
                        where: { id: event.id },
                        data: { status: 'live' }
                    });
                    console.log(`[CoinRush Cron] CoinRush event ${event.id} (${event.eventType}) is now LIVE`);

                    publishToCoinRush(event.id, {
                        type: 'event_status_changed',
                        status: 'live'
                    });

                    if (event.centerLat && event.centerLng) {
                        const nearbyUsers = calculateRadiusForUserLiveEvent(allUsersWithTokens, event.centerLat, event.centerLng, 600);
                        for (const user of nearbyUsers) {
                            await notifyUserIfAllowed(
                                prisma,
                                user.id,
                                SP_NOTIFICATION_CATEGORIES.COIN_RUSH,
                                "🪙 Coin Rush Is Live!",
                                `"${event.title}" has started! Race to hit checkpoints and grab the reward before anyone else!`,
                                coinRushData(PUSH_TYPE.COIN_RUSH_LIVE, event.id)
                            );
                        }
                    }
                }
            }


            // --- Coin Rush: gets Completed (live → completed) ---
            const coinRushToComplete = await prisma.coinRushEvent.findMany({
                where: {
                    status: 'live',
                    endTime: { lte: now }
                },
                include: {
                    participants: {
                        include: {
                            user: {
                                select: { id: true, fcmToken: true }
                            }
                        }
                    }
                }
            });

            if (coinRushToComplete.length > 0) {
                for (const event of coinRushToComplete) {
                    await prisma.coinRushEvent.update({
                        where: { id: event.id },
                        data: { status: 'completed' }
                    });
                    console.log(`[CoinRush Cron] CoinRush event ${event.id} (${event.eventType}) is now COMPLETED`);

                    publishToCoinRush(event.id, {
                        type: 'event_status_changed',
                        status: 'completed'
                    });

                    for (const part of event.participants) {
                        if (part.user) {
                            await notifyUserIfAllowed(
                                prisma,
                                part.userId,
                                SP_NOTIFICATION_CATEGORIES.COIN_RUSH,
                                "✅ Coin Rush Completed!",
                                `"${event.title}" has ended. See if you made it to the top and claimed a reward!`,
                                coinRushData(PUSH_TYPE.COIN_RUSH_COMPLETED, event.id)
                            );
                        }
                    }
                }
            }

        } catch (error) {
            console.error('[Cron] Error updating event statuses:', error);
        }
    }, 60000); // Check every minute
};
