import { Worker } from 'bullmq';
import { prisma } from '../config/db.js';
import { redis } from '../services/redis.js';

// The queue name
const queueName = 'gps_events_queue';

export const startGpsWorker = () => {
    // We only start the worker if Redis is actually connected to avoid crashing
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
        console.log('[BullMQ] Redis is offline, skipping worker initialization.');
        return;
    }

    const worker = new Worker(queueName, async (job) => {
        const { trips } = job.data;
        // trips is an array of { tripId, lat, lng, heading }
        
        if (!trips || trips.length === 0) return;

        console.log(`[BullMQ] Processing batch of ${trips.length} GPS updates...`);

        try {
            // In a hyper-scale environment, you might use raw SQL for a single bulk UPSERT.
            // For thousands of users, Promise.all on indexed updates is extremely fast.
            await Promise.all(trips.map(update => 
                prisma.trip.update({
                    where: { id: update.tripId },
                    data: {
                        currentLatitude: update.lat,
                        currentLongitude: update.lng,
                        heading: update.heading,
                        lastLocationUpdatedAt: new Date()
                    }
                })
            ));
        } catch (error) {
            console.error('[BullMQ] Batch update failed:', error.message);
        }
    }, {
        connection: redis
    });

    worker.on('failed', (job, err) => {
        console.error(`[BullMQ] Job ${job.id} failed with error: ${err.message}`);
    });

    console.log('[BullMQ] GPS Worker started and listening to', queueName);
};
