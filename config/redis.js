import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Bounded waits: avoids nginx 504 hangs, but queues briefly while Redis reconnects (proximity/capture).
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  connectTimeout: 10_000,
  commandTimeout: 10_000,
  enableOfflineQueue: true,
  retryStrategy: (times) => (times > 10 ? null : Math.min(times * 200, 2_000)),
});

redis.on("connect", () => {
  console.log(" Connected to Redis successfully!");
});

redis.on("error", (error) => {
  console.error(" Redis connection error:", error);
});
