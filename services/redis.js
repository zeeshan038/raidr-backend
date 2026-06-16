import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

// Create Redis instance
// In a real environment, this should point to your Hetzner Redis URL
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
        // Prevent infinite fast retries from crashing the app if Redis is offline locally
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redis.on('error', (err) => {
    // Only log the error once to avoid console spam
    if (!redis.hasLoggedError) {
        console.error('Redis connection error (is Redis running?):', err.message);
        redis.hasLoggedError = true;
    }
});

redis.on('connect', () => {
    console.log('Successfully connected to Redis!');
    redis.hasLoggedError = false;
});

// A separate connection for Pub/Sub (Redis requires a dedicated connection for subscribing)
const redisSubscriber = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
        return Math.min(times * 50, 2000);
    }
});

redisSubscriber.on('error', () => {}); // Suppress duplicate errors

export { redis, redisSubscriber };
