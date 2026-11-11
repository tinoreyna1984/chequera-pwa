import { localDateKey, nextDueMs } from "@/core/reminder/dispatch";
import type { ReminderSubscription } from "@/core/reminder/subscription-store";
import { UpstashSubscriptionStore } from "../store";

const MAX_BODY_LENGTH = 16 * 1024;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Vista pública del registro: nunca exponemos las claves de cifrado. */
function publicView(record: ReminderSubscription) {
  return {
    time: record.time,
    timezone: record.timezone,
    lastSentDate: record.lastSentDate,
    readDate: record.readDate,
    failCount: record.failCount,
  };
}

/**
 * Mismo origen que la petición. Sin cabecera Origin lo permitimos
 * (curl / clientes sin navegador); con Origin distinto → 403.
 */
function isValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  return origin === new URL(request.url).origin;
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

async function readJsonBody(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  const text = await request.text();
  if (text.length > MAX_BODY_LENGTH) {
    return { ok: false, response: Response.json({ error: "Cuerpo demasiado grande" }, { status: 413 }) };
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("no-objeto");
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, response: Response.json({ error: "JSON inválido" }, { status: 400 }) };
  }
}

function endpointFrom(body: Record<string, unknown>): string {
  const subscription = body.subscription as { endpoint?: unknown } | undefined;
  return typeof subscription?.endpoint === "string" ? subscription.endpoint : "";
}

const BAD_REQUEST = (error: string) => Response.json({ error }, { status: 400 });
const SERVER_ERROR = (error: string) => Response.json({ error }, { status: 500 });

/** Alta o actualización idempotente de la suscripción (201 nueva, 200 existente). */
export async function POST(request: Request): Promise<Response> {
  if (!isValidOrigin(request)) return Response.json({ error: "Origen no permitido" }, { status: 403 });

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const endpoint = endpointFrom(body);
  const keys = (body.subscription as { keys?: { p256dh?: unknown; auth?: unknown } } | undefined)?.keys;
  const p256dh = typeof keys?.p256dh === "string" ? keys.p256dh : "";
  const auth = typeof keys?.auth === "string" ? keys.auth : "";
  const time = typeof body.time === "string" ? body.time : "";
  const timezone = typeof body.timezone === "string" ? body.timezone : "";

  if (!isHttpsUrl(endpoint)) return BAD_REQUEST("El endpoint de la suscripción debe ser una URL https válida");
  if (!p256dh || !auth) return BAD_REQUEST("Faltan las claves keys.p256dh y keys.auth de la suscripción");
  if (!TIME_PATTERN.test(time)) return BAD_REQUEST("La hora debe tener formato HH:mm");
  if (!isValidTimezone(timezone)) return BAD_REQUEST("Zona horaria IANA desconocida");

  try {
    const store = new UpstashSubscriptionStore();
    const existing = await store.get(endpoint);
    const now = Date.now();
    const record: ReminderSubscription = {
      keys: { p256dh, auth },
      time,
      timezone,
      failCount: existing?.failCount ?? 0,
      ...(existing?.lastSentDate ? { lastSentDate: existing.lastSentDate } : {}),
      ...(existing?.readDate ? { readDate: existing.readDate } : {}),
    };
    await store.put(endpoint, record, nextDueMs(time, timezone, now));
    return Response.json({ ok: true, record: publicView(record) }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("subscriptions POST:", error);
    return SERVER_ERROR("No se pudo registrar la suscripción");
  }
}

/** Marca el día local como leído para omitir la entrega de hoy. */
export async function PATCH(request: Request): Promise<Response> {
  if (!isValidOrigin(request)) return Response.json({ error: "Origen no permitido" }, { status: 403 });

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const endpoint = endpointFrom(parsed.body);
  if (!endpoint) return BAD_REQUEST("Falta subscription.endpoint");

  try {
    const store = new UpstashSubscriptionStore();
    const record = await store.get(endpoint);
    if (!record) return Response.json({ error: "Suscripción no encontrada" }, { status: 404 });
    const now = Date.now();
    const updated: ReminderSubscription = { ...record, readDate: localDateKey(now, record.timezone) };
    // también cancela cualquier reintento pendiente de hoy
    await store.put(endpoint, updated, nextDueMs(record.time, record.timezone, now));
    return Response.json({ ok: true, record: publicView(updated) });
  } catch (error) {
    console.error("subscriptions PATCH:", error);
    return SERVER_ERROR("No se pudo marcar la suscripción como leída");
  }
}

/** Baja idempotente de la suscripción. */
export async function DELETE(request: Request): Promise<Response> {
  if (!isValidOrigin(request)) return Response.json({ error: "Origen no permitido" }, { status: 403 });

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const endpoint = endpointFrom(parsed.body);
  if (!endpoint) return BAD_REQUEST("Falta subscription.endpoint");

  try {
    await new UpstashSubscriptionStore().remove(endpoint);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("subscriptions DELETE:", error);
    return SERVER_ERROR("No se pudo eliminar la suscripción");
  }
}

/** Registro actual del endpoint para la sincronización al abrir la app. */
export async function GET(request: Request): Promise<Response> {
  // leer request.url obliga a resolver en tiempo de petición (no se prereenderiza)
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) return BAD_REQUEST("Falta ?endpoint=");

  try {
    const record = await new UpstashSubscriptionStore().get(endpoint);
    return Response.json({ record: record ? publicView(record) : null });
  } catch (error) {
    console.error("subscriptions GET:", error);
    return SERVER_ERROR("No se pudo leer la suscripción");
  }
}
