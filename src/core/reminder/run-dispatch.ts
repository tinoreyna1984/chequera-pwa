import { decideDispatch, localDateKey, nextDueMs, todayDueMs, MAX_DISPATCH_FAILURES } from "./dispatch";
import type { ReminderSubscription, SubscriptionStore } from "./subscription-store";

/** Payload mínimo que viaja en la notificación; el SW compone el texto en el cliente. */
export interface ReminderPayload {
  devotionalId: string; // "MM-DD" del día local del dispositivo
  type: "daily";
}

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Resultado semántico de un envío (el adaptador traduce los códigos HTTP). */
export type SendOutcome = "delivered" | "gone" | "retry";

export interface PushSender {
  send(target: PushTarget, payload: ReminderPayload): Promise<SendOutcome>;
}

export interface DispatchReport {
  evaluated: number;
  sent: number;
  removed: number;
  retried: number;
  reprogrammed: number;
  skipped: number;
}

/**
 * Despacha las suscripciones vencidas en nowMs de forma idempotente:
 * lock contra ejecuciones solapadas, una sola entrega por día local y
 * reintentos acotados. Devuelve null si otra ejecución sostiene el lock.
 */
export async function runDispatch(
  store: SubscriptionStore,
  sender: PushSender,
  nowMs: number,
): Promise<DispatchReport | null> {
  const lock = await store.acquireLock();
  if (!lock) return null;
  try {
    const report: DispatchReport = { evaluated: 0, sent: 0, removed: 0, retried: 0, reprogrammed: 0, skipped: 0 };
    const candidates = await store.listDue(nowMs);
    report.evaluated = candidates.length;
    for (const { endpoint, record } of candidates) {
      try {
        await dispatchOne(store, sender, endpoint, record, nowMs, report);
      } catch (error) {
        // una suscripción defectuosa no debe bloquear a las demás
        console.error("Recordatorio: fallo al procesar una suscripción", error);
      }
    }
    return report;
  } finally {
    await store.releaseLock(lock);
  }
}

async function dispatchOne(
  store: SubscriptionStore,
  sender: PushSender,
  endpoint: string,
  record: ReminderSubscription,
  nowMs: number,
  report: DispatchReport,
): Promise<void> {
  const decision = decideDispatch(nowMs, record);
  const today = localDateKey(nowMs, record.timezone);

  switch (decision) {
    case "send": {
      const outcome = await sender.send({ endpoint, keys: record.keys }, { devotionalId: today.slice(5), type: "daily" });
      if (outcome === "delivered") {
        await store.put(endpoint, { ...record, lastSentDate: today, failCount: 0 }, nextDueMs(record.time, record.timezone, nowMs));
        report.sent++;
        return;
      }
      if (outcome === "gone") {
        // 404/410: el endpoint ya no existe; se da de baja
        await store.remove(endpoint);
        report.removed++;
        return;
      }
      const failCount = record.failCount + 1;
      if (failCount >= MAX_DISPATCH_FAILURES) {
        await store.put(endpoint, { ...record, failCount: 0 }, nextDueMs(record.time, record.timezone, nowMs));
        report.reprogrammed++;
      } else {
        // 429/5xx: se conserva la entrega vencida para reintentar en el próximo ciclo
        await store.put(endpoint, { ...record, failCount }, todayDueMs(record.time, record.timezone, nowMs));
        report.retried++;
      }
      return;
    }
    case "skipAlreadySent":
    case "skipRead":
    case "skipLate":
      // avanza la candidata a la próxima entrega para no reevaluarla hoy
      await store.put(endpoint, record, nextDueMs(record.time, record.timezone, nowMs));
      report.skipped++;
      return;
    case "reprogram":
      await store.put(endpoint, { ...record, failCount: 0 }, nextDueMs(record.time, record.timezone, nowMs));
      report.reprogrammed++;
      return;
    case "notYet":
      report.skipped++;
  }
}
