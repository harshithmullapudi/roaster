import { Redis, type RedisOptions } from "ioredis";

export type RedisClient = Redis;

export type ConnectionProfile = "producer" | "worker" | "subscriber";

export function hasRedis(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export function redisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL is not set. Roster needs Redis for the work queues, the " +
        "session command lists, and host-link ownership. Start it with " +
        "`pnpm dev:db` and copy REDIS_URL from .env.example.",
    );
  }
  return url;
}

function options(profile: ConnectionProfile): RedisOptions {
  return {
    maxRetriesPerRequest: null,
    enableOfflineQueue: profile !== "producer",
    lazyConnect: false,
  };
}

export function createRedis(profile: ConnectionProfile): RedisClient {
  return new Redis(redisUrl(), options(profile));
}

const clients = new Map<ConnectionProfile, RedisClient>();

export function redis(profile: ConnectionProfile): RedisClient {
  const existing = clients.get(profile);
  if (existing) return existing;

  const client = createRedis(profile);
  client.on("error", (cause: Error) => {
    console.warn(`[redis] ${profile} connection error: ${cause.message}`);
  });
  clients.set(profile, client);
  return client;
}

export async function closeRedis(): Promise<void> {
  const open = [...clients.values()];
  clients.clear();
  await Promise.all(
    open.map(async (client) => {
      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
    }),
  );
}

const RENEW = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end`;

const RELEASE = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

export async function acquireLease(
  client: RedisClient,
  key: string,
  holder: string,
  ttlMs: number,
): Promise<boolean> {
  const taken = await client.set(key, holder, "PX", ttlMs, "NX");
  return taken === "OK";
}

export async function renewLease(
  client: RedisClient,
  key: string,
  holder: string,
  ttlMs: number,
): Promise<boolean> {
  const renewed = await client.eval(RENEW, 1, key, holder, String(ttlMs));
  return renewed === 1;
}

export async function releaseLease(
  client: RedisClient,
  key: string,
  holder: string,
): Promise<boolean> {
  const released = await client.eval(RELEASE, 1, key, holder);
  return released === 1;
}
