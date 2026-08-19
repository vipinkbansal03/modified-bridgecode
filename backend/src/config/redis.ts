import Redis from "ioredis";
import { logger } from "./logger";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

declare global {
  // eslint-disable-next-line no-var
  var redis: Redis | undefined;
}

export const redis =
  global.redis ||
  new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    maxRetriesPerRequest: null, // Required by BullMQ
  });

if (process.env.NODE_ENV !== "production") {
  global.redis = redis;
}

redis.on("connect", () => {
  logger.info(`Redis client connected to ${REDIS_HOST}:${REDIS_PORT}`);
});

redis.on("error", (err) => {
  logger.error("Redis client connection error", err);
});
