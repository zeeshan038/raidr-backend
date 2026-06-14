import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// Create a robust Redis connection pool
export const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

redis.on("connect", () => {
  console.log("🔥 Connected to Redis successfully!");
});

redis.on("error", (error) => {
  console.error("❌ Redis connection error:", error);
});
