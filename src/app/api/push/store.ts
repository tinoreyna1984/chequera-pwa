import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { DueSubscription, ReminderSubscription, SubscriptionStore } from "@/core/reminder/subscription-store";

const SUBSCRIPTIONS_KEY = "chequera:subs";
const DUE_KEY = "chequera:due";
const LOCK_KEY = "chequera:dispatch-lock";
const LOCK_TTL_MS = 10 * 60_000;
const RELEASE_LOCK_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

function createRedisClient(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Faltan UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN; ver README.md (Recordatorio diario: preparación).");
  }
  // enableAutoPipelining/retry/deserialización apagados: comandos individuales
  // predecibles y respuestas crudas (guardamos JSON de texto en el hash).
  return new Redis({ url, token, retry: false, enableAutoPipelining: false, automaticDeserialization: false });
}

function parseSubscription(raw: unknown): ReminderSubscription | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ReminderSubscription>;
    if (typeof parsed.time !== "string" || typeof parsed.timezone !== "string") return null;
    if (typeof parsed.keys?.p256dh !== "string" || typeof parsed.keys?.auth !== "string") return null;
    return {
      keys: { p256dh: parsed.keys.p256dh, auth: parsed.keys.auth },
      time: parsed.time,
      timezone: parsed.timezone,
      ...(typeof parsed.lastSentDate === "string" ? { lastSentDate: parsed.lastSentDate } : {}),
      ...(typeof parsed.readDate === "string" ? { readDate: parsed.readDate } : {}),
      failCount: typeof parsed.failCount === "number" ? parsed.failCount : 0,
    };
  } catch {
    return null;
  }
}

export class UpstashSubscriptionStore implements SubscriptionStore {
  private readonly redis: Redis;

  constructor(redis: Redis = createRedisClient()) {
    this.redis = redis;
  }

  async put(endpoint: string, record: ReminderSubscription, dueMs: number): Promise<void> {
    await this.redis
      .pipeline()
      .hset(SUBSCRIPTIONS_KEY, { [endpoint]: JSON.stringify(record) })
      .zadd(DUE_KEY, { score: dueMs, member: endpoint })
      .exec();
  }

  async get(endpoint: string): Promise<ReminderSubscription | null> {
    return parseSubscription(await this.redis.hget(SUBSCRIPTIONS_KEY, endpoint));
  }

  async remove(endpoint: string): Promise<void> {
    await this.redis.pipeline().hdel(SUBSCRIPTIONS_KEY, endpoint).zrem(DUE_KEY, endpoint).exec();
  }

  async listDue(nowMs: number): Promise<DueSubscription[]> {
    // Los scores son epoch-ms (> 0), así que 0 equivale a -inf y evita el "-inf" de JSON.
    const endpoints = await this.redis.zrange<string[]>(DUE_KEY, 0, nowMs, { byScore: true });
    if (endpoints.length === 0) return [];
    // Con automaticDeserialization: false, hmget devuelve un arreglo en orden de campos (null si falta).
    const values = (await this.redis.hmget(SUBSCRIPTIONS_KEY, ...endpoints)) as unknown as (string | null)[];
    const due: DueSubscription[] = [];
    for (const [index, endpoint] of endpoints.entries()) {
      const record = parseSubscription(values[index]);
      if (record) due.push({ endpoint, record });
    }
    return due;
  }

  async acquireLock(): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redis.set(LOCK_KEY, token, { nx: true, px: LOCK_TTL_MS });
    return result === "OK" ? token : null;
  }

  async releaseLock(token: string): Promise<void> {
    await this.redis.eval(RELEASE_LOCK_SCRIPT, [LOCK_KEY], [token]);
  }
}
