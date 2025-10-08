import Redis, { RedisOptions } from "ioredis";
import "dotenv/config";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

function createClient(): Redis {
  // Use explicit options for TLS endpoints to avoid URL parsing pitfalls
  if (REDIS_URL.startsWith("rediss://")) {
    const u = new URL(REDIS_URL);
    const opts: RedisOptions = {
      host: u.hostname,
      port: Number(u.port || 6380),
      password: u.password ? decodeURIComponent(u.password) : undefined,
      username: u.username || undefined, // often empty for default user
      tls: {}, // enable TLS; use system CAs
      maxRetriesPerRequest: 5,
      retryStrategy: (times) => Math.min(times * 200, 2000)
    };
    return new Redis(opts);
  }

  // Non-TLS/local
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: 5,
    retryStrategy: (times) => Math.min(times * 200, 2000)
  });
}

export function makePub() {
  return createClient();
}

export function makeSub() {
  return createClient();
}

export const CHANNELS = {
  INGESTION: "messages-ingestion",
  DELIVERY: "messages-delivery"
} as const;
