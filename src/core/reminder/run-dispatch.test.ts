import { describe, expect, it } from "vitest";
import { runDispatch } from "./run-dispatch";
import type { DispatchReport, PushSender, PushTarget, ReminderPayload, SendOutcome } from "./run-dispatch";
import type { ReminderSubscription, SubscriptionStore } from "./subscription-store";

const EP = "https://push.example.com/ep-1";
const DUE = Date.UTC(2026, 10, 5, 12, 0); // 07:00 America/Lima
const NEXT_DAY_DUE = Date.UTC(2026, 10, 6, 12, 0);

function base(overrides: Partial<ReminderSubscription> = {}): ReminderSubscription {
  return {
    keys: { p256dh: "p256dh-de-prueba", auth: "auth-de-prueba" },
    time: "07:00",
    timezone: "America/Lima",
    failCount: 0,
    ...overrides,
  };
}

function createFakeStore(entries: Array<{ endpoint: string; record: ReminderSubscription; dueMs: number }>) {
  const records = new Map(entries.map(({ endpoint, record, dueMs }) => [endpoint, { record, dueMs }]));
  let holder: string | null = null;
  const store: SubscriptionStore = {
    put: async (endpoint, record, dueMs) => void records.set(endpoint, { record, dueMs }),
    get: async (endpoint) => records.get(endpoint)?.record ?? null,
    remove: async (endpoint) => void records.delete(endpoint),
    listDue: async (nowMs) =>
      [...records.entries()]
        .filter(([, entry]) => entry.dueMs <= nowMs)
        .map(([endpoint, entry]) => ({ endpoint, record: entry.record })),
    acquireLock: async () => (holder ? null : (holder = "lock-token")),
    releaseLock: async (token) => {
      if (holder === token) holder = null;
    },
  };
  return { store, records };
}

function createFakeSender(nextOutcome: (call: number) => SendOutcome) {
  const calls: Array<{ target: PushTarget; payload: ReminderPayload }> = [];
  const sender: PushSender = {
    send: async (target, payload) => {
      calls.push({ target, payload });
      return nextOutcome(calls.length);
    },
  };
  return { sender, calls };
}

describe("runDispatch", () => {
  it("dos llamadas consecutivas del mismo día producen un solo envío", async () => {
    const { store, records } = createFakeStore([{ endpoint: EP, record: base(), dueMs: DUE }]);
    const { sender, calls } = createFakeSender(() => "delivered");

    const first = await runDispatch(store, sender, DUE + 60_000);
    expect(first).toEqual<DispatchReport>({ evaluated: 1, sent: 1, removed: 0, retried: 0, reprogrammed: 0, skipped: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0].payload).toEqual({ devotionalId: "11-05", type: "daily" });
    expect(calls[0].target.keys).toEqual(base().keys);

    const second = await runDispatch(store, sender, DUE + 15 * 60_000);
    expect(second?.evaluated).toBe(0);
    expect(second?.sent).toBe(0);
    expect(calls).toHaveLength(1);

    // la candidata quedó con la fecha de envío y programada para mañana
    expect(records.get(EP)?.record.lastSentDate).toBe("2026-11-05");
    expect(records.get(EP)?.dueMs).toBe(NEXT_DAY_DUE);
  });

  it("no despacha si otra ejecución sostiene el lock", async () => {
    const { store } = createFakeStore([{ endpoint: EP, record: base(), dueMs: DUE }]);
    await store.acquireLock(); // tomada por otra corrida
    const { sender, calls } = createFakeSender(() => "delivered");

    const report = await runDispatch(store, sender, DUE + 60_000);
    expect(report).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("ante 404/410 (gone) elimina la suscripción", async () => {
    const { store, records } = createFakeStore([{ endpoint: EP, record: base(), dueMs: DUE }]);
    const { sender } = createFakeSender(() => "gone");

    const report = await runDispatch(store, sender, DUE + 60_000);
    expect(report?.removed).toBe(1);
    expect(records.has(EP)).toBe(false);
  });

  it("reintenta ante 429/5xx con failCount y reprograma tras 5 fallos", async () => {
    const { store, records } = createFakeStore([{ endpoint: EP, record: base(), dueMs: DUE }]);
    const { sender, calls } = createFakeSender(() => "retry");

    for (let cycle = 1; cycle <= 4; cycle++) {
      const report = await runDispatch(store, sender, DUE + cycle * 15 * 60_000);
      expect(report).toMatchObject({ retried: 1, reprogrammed: 0 });
      expect(records.get(EP)?.record.failCount).toBe(cycle);
      expect(records.get(EP)?.dueMs).toBe(DUE); // sigue candidata para el próximo ciclo
    }

    const fifth = await runDispatch(store, sender, DUE + 5 * 15 * 60_000);
    expect(fifth).toMatchObject({ retried: 0, reprogrammed: 1 });
    expect(calls).toHaveLength(5);
    expect(records.get(EP)?.record.failCount).toBe(0);
    expect(records.get(EP)?.dueMs).toBe(NEXT_DAY_DUE);

    // al día siguiente vuelve a intentar
    await runDispatch(store, sender, NEXT_DAY_DUE + 60_000);
    expect(calls).toHaveLength(6);
  });

  it("omite la entrega si el día ya fue marcado como leído y programa mañana", async () => {
    const { store, records } = createFakeStore([
      { endpoint: EP, record: base({ readDate: "2026-11-05" }), dueMs: DUE },
    ]);
    const { sender, calls } = createFakeSender(() => "delivered");

    const report = await runDispatch(store, sender, DUE + 60_000);
    expect(report).toMatchObject({ skipped: 1, sent: 0 });
    expect(calls).toHaveLength(0);
    expect(records.get(EP)?.dueMs).toBe(NEXT_DAY_DUE);
  });

  it("omite la entrega si la hora elegida venció hace más de 2 h", async () => {
    const { store, records } = createFakeStore([{ endpoint: EP, record: base(), dueMs: DUE }]);
    const { sender, calls } = createFakeSender(() => "delivered");

    const report = await runDispatch(store, sender, DUE + 3 * 60 * 60_000);
    expect(report).toMatchObject({ skipped: 1, sent: 0 });
    expect(calls).toHaveLength(0);
    expect(records.get(EP)?.dueMs).toBe(NEXT_DAY_DUE);
  });

  it("procesa varias candidatas sin que una fallen afecte a las demás", async () => {
    const { store, records } = createFakeStore([
      { endpoint: "https://push.example.com/mala", record: base({ timezone: "Zona/Inexistente" }), dueMs: DUE },
      { endpoint: "https://push.example.com/ok", record: base(), dueMs: DUE },
    ]);
    const { sender, calls } = createFakeSender(() => "delivered");

    const report = await runDispatch(store, sender, DUE + 60_000);
    // la zona inválida lanza dentro de dispatchOne y se registra, sin frenar el resto
    expect(report?.sent).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].target.endpoint).toBe("https://push.example.com/ok");
    expect(records.has("https://push.example.com/mala")).toBe(true);
  });
});
