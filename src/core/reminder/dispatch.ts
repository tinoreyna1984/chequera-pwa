import type { ReminderSubscription } from "./subscription-store";

/** Ventana de tolerancia: pasadas 2 h de la hora elegida ya no se envía. */
export const LATE_WINDOW_MS = 2 * 60 * 60 * 1000;
/** Fallos consecutivos de envío antes de reprogramar la entrega al día siguiente. */
export const MAX_DISPATCH_FAILURES = 5;

export type DispatchDecision = "send" | "notYet" | "skipAlreadySent" | "skipRead" | "skipLate" | "reprogram";

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function localParts(utcMs: number, timezone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));
  const read = (type: "year" | "month" | "day" | "hour" | "minute" | "second"): number => {
    const part = parts.find((entry) => entry.type === type);
    if (!part) throw new Error(`Zona horaria inválida: ${timezone}`);
    return Number(part.value);
  };
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function tzOffsetMs(utcMs: number, timezone: string): number {
  const local = localParts(utcMs, timezone);
  const truncated = Math.floor(utcMs / 1000) * 1000;
  return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) - truncated;
}

function wallClockToUtcMs(
  local: { year: number; month: number; day: number; hour: number; minute: number },
  timezone: string,
): number {
  const desired = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  // Dos pasadas: si el primer intento cruza un cambio de horario de verano,
  // la segunda evalúa el offset del instante ya corregido y converge.
  const first = desired - tzOffsetMs(desired, timezone);
  return desired - tzOffsetMs(first, timezone);
}

function parseTime(time: string): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new Error(`Hora inválida (se esperaba HH:mm): ${time}`);
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** Fecha local "YYYY-MM-DD" de un instante en la zona dada. */
export function localDateKey(utcMs: number, timezone: string): string {
  const local = localParts(utcMs, timezone);
  const pad = (value: number, size = 2): string => String(value).padStart(size, "0");
  return `${pad(local.year, 4)}-${pad(local.month)}-${pad(local.day)}`;
}

/** Epoch ms de la entrega de hoy en la zona local (aún no ocurrida o recién vencida). */
export function todayDueMs(time: string, timezone: string, nowMs: number): number {
  const { hour, minute } = parseTime(time);
  const today = localParts(nowMs, timezone);
  return wallClockToUtcMs({ year: today.year, month: today.month, day: today.day, hour, minute }, timezone);
}

/** Epoch ms de la próxima entrega estrictamente después de nowMs (hoy si falta, si no mañana). */
export function nextDueMs(time: string, timezone: string, nowMs: number): number {
  const { hour, minute } = parseTime(time);
  const due = todayDueMs(time, timezone, nowMs);
  if (due > nowMs) return due;
  const today = localParts(nowMs, timezone);
  const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  return wallClockToUtcMs(
    { year: tomorrow.getUTCFullYear(), month: tomorrow.getUTCMonth() + 1, day: tomorrow.getUTCDate(), hour, minute },
    timezone,
  );
}

/** Decide qué hacer con una candidata en el instante nowMs, sin tocar estado. */
export function decideDispatch(nowMs: number, record: ReminderSubscription): DispatchDecision {
  const today = localDateKey(nowMs, record.timezone);
  if (record.lastSentDate === today) return "skipAlreadySent";
  if (record.readDate === today) return "skipRead";
  if (record.failCount >= MAX_DISPATCH_FAILURES) return "reprogram";
  const due = todayDueMs(record.time, record.timezone, nowMs);
  if (nowMs < due) return "notYet";
  if (nowMs - due > LATE_WINDOW_MS) return "skipLate";
  return "send";
}
