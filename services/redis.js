import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();


const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redis.on('error', (err) => {
    if (!redis.hasLoggedError) {
        console.error('Redis connection error (is Redis running?):', err.message);
        redis.hasLoggedError = true;
    }
});

redis.on('connect', () => {
    console.log('Successfully connected to Redis!');
    redis.hasLoggedError = false;
});

const redisSubscriber = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
        return Math.min(times * 50, 2000);
    }
});

redisSubscriber.on('error', () => {}); 

export { redis, redisSubscriber };
