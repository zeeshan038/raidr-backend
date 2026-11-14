import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Fail fast on bad REDIS_URL (e.g. localhost inside Docker) — avoids nginx 504 on silent-drop /proximity.
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  connectTimeout: 10_000,
  commandTimeout: 5_000,
  enableOfflineQueue: false,
  retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2_000)),
});

redis.on("connect", () => {
  console.log(" Connected to Redis successfully!");
});

redis.on("error", (error) => {
  console.error(" Redis connection error:", error);
});
