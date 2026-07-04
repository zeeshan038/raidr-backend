//NPM Packages
import { Worker, Queue } from 'bullmq';

//config
import { prisma } from '../config/db.js';
import { redis } from '../services/redis.js';

// The queue name
const queueName = 'gps_events_queue';

/**
 * @Descripton Initializes the GPS worker
 */
export const startGpsWorker = () => {
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
        console.log('[BullMQ] Redis is offline, skipping worker initialization.');
        return;
    }

    // Set up the cron job for true batching
    const batchQueue = new Queue(queueName, { connection: redis });
    batchQueue.add('process_gps_batch', {}, {
        repeat: { every: 10000 },
        jobId: 'gps_batch_cron_job',
        removeOnComplete: true,
        removeOnFail: 100
    });

    const worker = new Worker(queueName, async (job) => {
        if (job.name === 'process_gps_batch') {
            const multi = redis.multi();
            multi.lrange('gps_batch_list', 0, -1);
            multi.del('gps_batch_list');
            const results = await multi.exec();

            const rawItems = results[0][1];
            if (!rawItems || rawItems.length === 0) return;

            const trips = rawItems.map(item => JSON.parse(item));
            console.log(`[BullMQ] Bulk writing batch of ${trips.length} GPS updates...`);

            try {
                await Promise.all(trips.map(update => 
                    prisma.trip.update({
                        where: { id: update.tripId },
                        data: {
                            currentLatitude: update.lat,
                            currentLongitude: update.lng,
                            ...(update.heading !== undefined && { heading: update.heading }),
                            lastLocationUpdatedAt: new Date()
                        }
                    })
                ));
            } catch (error) {
                console.error('[BullMQ] Batch update failed:', error.message);
            }
        } 
        else if (job.name === 'box_collected') {
            const { userId, boxType, xpAmount, distanceCoveredKm, source, lat, lng, adData } = job.data;
            if (!userId || !boxType || typeof xpAmount !== 'number') return;

            console.log(`[BullMQ] Processing box collection for ${userId} (${boxType}: +${xpAmount} XP, +${distanceCoveredKm}km, source: ${source})`);

            try {
                await prisma.$transaction(async (tx) => {
                    const user = await tx.user.findUnique({
                        where: { id: userId },
                        select: { level: true, xp_progress: true }
                    });

                    if (!user) return;

                    let lv = Math.max(1, user.level);
                    let bank = Math.max(0, user.xp_progress) + Math.max(0, xpAmount);
                    
                    // The level up formula: 100 * level * level
                    const xpRequired = (level) => 100 * level * level;

                    while (bank >= xpRequired(lv)) {
                        bank -= xpRequired(lv);
                        lv += 1;
                    }

                    // Prepare update payload
                    const updateData = {
                        xp_earned: { increment: xpAmount },
                        xp_progress: bank,
                        level: lv
                    };

                    if (distanceCoveredKm > 0) {
                        updateData.distance_covered_km = { increment: distanceCoveredKm };
                    }

                    if (boxType === 'green') updateData.green_boxes_count = { increment: 1 };
                    else if (boxType === 'golden') updateData.golden_boxes_count = { increment: 1 };
                    else if (boxType === 'purple') updateData.purple_boxes_count = { increment: 1 };

                    await tx.user.update({
                        where: { id: userId },
                        data: updateData
                    });

                    await tx.boxCollectionLog.create({
                        data: {
                            userId,
                            boxType,
                            xpEarned: xpAmount,
                            distanceCoveredKm: distanceCoveredKm || 0,
                            source,
                            lat,
                            lng,
                            adData: adData || null,
                            isClaimed: false
                        }
                    });

                    if (lv > user.level) {
                        console.log(`[BullMQ] User ${userId} leveled up to ${lv}!`);
                    }
                });
            } catch (error) {
                console.error('[BullMQ] Box collection update failed:', error.message);
            }
        }
        else if (job.name === 'sync_distance') {
            const { userId, distanceCoveredKm } = job.data;
            if (!userId || typeof distanceCoveredKm !== 'number') return;

            console.log(`[BullMQ] Processing distance sync for ${userId} (+${distanceCoveredKm}km)`);

            try {
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        distance_covered_km: { increment: distanceCoveredKm }
                    }
                });
            } catch (error) {
                console.error('[BullMQ] Distance sync update failed:', error.message);
            }
        }
    }, {
        connection: redis
    });

    worker.on('failed', (job, err) => {
        console.error(`[BullMQ] Job ${job.id} failed with error: ${err.message}`);
    });

    console.log('[BullMQ] GPS Worker started and listening to', queueName);
};
