import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Redis } from "@upstash/redis";
import type { ReminderSubscription } from "@/core/reminder/subscription-store";
import { UpstashSubscriptionStore } from "./store";

interface FakeState {
  hashes: Map<string, Map<string, string>>;
  zsets: Map<string, Map<string, number>>;
  kv: Map<string, string>;
  commands: unknown[][];
}

/** Redis en memoria que entiende solo los comandos que usa el store. */
function createFakeUpstash() {
  const state: FakeState = { hashes: new Map(), zsets: new Map(), kv: new Map(), commands: [] };

  const execute = (command: unknown[]): unknown => {
    const [name, ...args] = command;
    switch (String(name)) {
      case "hset": {
        const [key, field, value] = args as [string, string, string];
        const hash = state.hashes.get(key) ?? new Map<string, string>();
        state.hashes.set(key, hash);
        const added = hash.has(field) ? 0 : 1;
        hash.set(field, value);
        return added;
      }
      case "hget": {
        const [key, field] = args as [string, string];
        return state.hashes.get(key)?.get(field) ?? null;
      }
      case "hmget": {
        const [key, ...fields] = args as [string, ...string[]];
        const hash = state.hashes.get(key);
        return fields.map((field) => hash?.get(field) ?? null);
      }
      case "hdel": {
        const [key, field] = args as [string, string];
        return state.hashes.get(key)?.delete(field) ? 1 : 0;
      }
      case "zadd": {
        const [key, score, member] = args as [string, number, string];
        const zset = state.zsets.get(key) ?? new Map<string, number>();
        state.zsets.set(key, zset);
        const added = zset.has(member) ? 0 : 1;
        zset.set(member, score);
        return added;
      }
      case "zrem": {
        const [key, member] = args as [string, string];
        return state.zsets.get(key)?.delete(member) ? 1 : 0;
      }
      case "zrange": {
        const [key, min, max] = args as [string, number, number, string];
        const zset = state.zsets.get(key);
        if (!zset) return [];
        return [...zset.entries()]
          .filter(([, score]) => score >= min && score <= max)
          .sort((a, b) => a[1] - b[1])
          .map(([member]) => member);
      }
      case "set": {
        const [key, value, ...options] = args as [string, string, ...(string | number)[]];
        if (options.includes("nx") && state.kv.has(key)) return null;
        state.kv.set(key, value);
        return "OK";
      }
      case "eval": {
        const key = String(args[2]);
        const token = String(args[3]);
        if (state.kv.get(key) === token) {
          state.kv.delete(key);
          return 1;
        }
        return 0;
      }
      default:
        throw new Error(`comando no soportado en el fetch falso: ${String(name)}`);
    }
  };

  const fetchFake = async (_input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as unknown;
    const isPipeline = Array.isArray(body) && Array.isArray(body[0]);
    const commands = (isPipeline ? body : [body]) as unknown[][];
    const results = commands.map((command) => {
      state.commands.push(command);
      return execute(command);
    });
    const payload = isPipeline ? results.map((result) => ({ result })) : { result: results[0] };
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  };

  return { state, fetchFake };
}

function createClient(): Redis {
  return new Redis({
    url: "https://fake.upstash.io",
    token: "token-de-prueba",
    retry: false,
    enableAutoPipelining: false,
    automaticDeserialization: false,
  });
}

describe("UpstashSubscriptionStore", () => {
  let fake: ReturnType<typeof createFakeUpstash>;
  let store: UpstashSubscriptionStore;
  const base: ReminderSubscription = {
    keys: { p256dh: "p256dh-de-prueba", auth: "auth-de-prueba" },
    time: "07:00",
    timezone: "America/Lima",
    failCount: 0,
  };

  beforeEach(() => {
    fake = createFakeUpstash();
    vi.stubGlobal("fetch", fake.fetchFake);
    store = new UpstashSubscriptionStore(createClient());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("put guarda el registro con su próxima entrega y hace upsert sin duplicar", async () => {
    await store.put("https://push/1", base, 1_000);
    await store.put("https://push/1", { ...base, time: "07:30", readDate: "2026-11-10", failCount: 2 }, 2_000);

    expect(await store.get("https://push/1")).toEqual({ ...base, time: "07:30", readDate: "2026-11-10", failCount: 2 });
    const due = fake.state.zsets.get("chequera:due");
    expect([...(due?.keys() ?? [])]).toEqual(["https://push/1"]);
    expect(due?.get("https://push/1")).toBe(2_000);
  });

  it("get devuelve null cuando no existe o el registro está corrupto", async () => {
    expect(await store.get("https://push/ausente")).toBeNull();
    fake.state.hashes.set(
      "chequera:subs",
      new Map([
        ["https://push/malo", "no-es-json"],
        ["https://push/incompleto", '{"foo":1}'],
        ["https://push/sin-keys", '{"time":"07:00","timezone":"America/Lima","failCount":0}'],
      ]),
    );
    expect(await store.get("https://push/malo")).toBeNull();
    expect(await store.get("https://push/incompleto")).toBeNull();
    expect(await store.get("https://push/sin-keys")).toBeNull();
  });

  it("remove borra el registro y su candidata", async () => {
    await store.put("https://push/1", base, 1_000);
    await store.remove("https://push/1");

    expect(await store.get("https://push/1")).toBeNull();
    expect(await store.listDue(5_000)).toEqual([]);
  });

  it("listDue solo devuelve las vencidas, con flags intactas, y omite huérfanas", async () => {
    await store.put("https://push/1", { ...base, lastSentDate: "2026-11-09", failCount: 3 }, 1_000);
    await store.put("https://push/2", { ...base, readDate: "2026-11-10" }, 3_000);

    expect(await store.listDue(999)).toEqual([]);
    expect(await store.listDue(1_000)).toEqual([
      { endpoint: "https://push/1", record: { ...base, lastSentDate: "2026-11-09", failCount: 3 } },
    ]);
    expect(await store.listDue(3_000)).toHaveLength(2);

    // candidata huérfana: está en el ZSET pero no en el hash
    fake.state.zsets.get("chequera:due")?.set("https://push/huerfana", 500);
    const endpoints = (await store.listDue(3_000)).map((candidate) => candidate.endpoint);
    expect(endpoints).not.toContain("https://push/huerfana");
  });

  it("el lock solo lo obtiene un adquirente y se libera con su propio token", async () => {
    const token = await store.acquireLock();
    expect(token).toEqual(expect.any(String));
    expect(await store.acquireLock()).toBeNull();

    await store.releaseLock("token-de-otro");
    expect(await store.acquireLock()).toBeNull();

    await store.releaseLock(String(token));
    expect(await store.acquireLock()).not.toBeNull();
    expect(fake.state.commands).toContainEqual(["set", "chequera:dispatch-lock", token, "nx", "px", 600_000]);
  });

  it("propaga el error de red", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("fetch failed")));

    await expect(store.get("https://push/1")).rejects.toThrow();
    await expect(store.put("https://push/1", base, 1_000)).rejects.toThrow();
    await expect(store.listDue(1_000)).rejects.toThrow();
    await expect(store.acquireLock()).rejects.toThrow();
  });

  it("propaga un error devuelto por Upstash", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ error: "WRONGTYPE" }), { status: 200, headers: { "content-type": "application/json" } }),
    );

    await expect(store.get("https://push/1")).rejects.toThrow();
  });
});
