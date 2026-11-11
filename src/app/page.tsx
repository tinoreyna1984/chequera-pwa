"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AppearanceSettings } from "./AppearanceSettings";
import { InstallPrompt } from "./InstallPrompt";
import data from "../../public/data/devotionals.json";

type Devotional = (typeof data.devotionals)[number];

const entries = data.devotionals as Devotional[];
const monthNames = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function todayId(): string {
  const today = new Date();
  return `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function validId(value: string | null): value is string {
  const leapYear = new Date().getFullYear() % 4 === 0 && (new Date().getFullYear() % 100 !== 0 || new Date().getFullYear() % 400 === 0);
  return value !== null && /^\d{2}-\d{2}$/.test(value) && (value !== "02-29" || leapYear) && entries.some((entry) => entry.id === value);
}

function formatDate(entry: Devotional): string {
  return `${entry.day} de ${monthNames[entry.month - 1]}`;
}

function idToInputDate(value: string): string {
  return `${new Date().getFullYear()}-${value}`;
}

function inputDateToId(value: string): string {
  return value.slice(5);
}

const NOTIFICATIONS_KEY = "chequera-notifications";

const REMINDER_STEP_MINUTES = (() => {
  const value = Number(process.env.NEXT_PUBLIC_REMINDER_STEP_MINUTES);
  return Number.isFinite(value) && value > 0 ? value : 900;
})();

function pushSupported(): boolean {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Padded = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64Padded);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) output[index] = raw.charCodeAt(index);
  return output;
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<PushSubscription> {
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  const applicationServerKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!applicationServerKey) throw new Error("Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY; ver README.md (Recordatorio diario).");
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(applicationServerKey) });
}

async function postRegistration(subscription: PushSubscription, time: string): Promise<void> {
  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      time,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
  if (!response.ok) throw new Error(`El servidor rechazó el registro (${response.status}).`);
}

async function registerSubscription(time: string): Promise<void> {
  await postRegistration(await subscribeToPush(await readyRegistration()), time);
}

/** PATCH en segundo plano al marcar leído: no debe bloquear la UI. */
async function notifyReadToServer(): Promise<void> {
  try {
    const subscription = await (await readyRegistration()).pushManager.getSubscription();
    if (!subscription) return;
    const response = await fetch("/api/push/subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: { endpoint: subscription.endpoint } }),
    });
    if (!response.ok) console.warn(`El servidor no marcó el día como leído (${response.status})`);
  } catch (error) {
    console.warn("No se pudo avisar al servidor del día leído", error);
  }
}

/** Desactivar elimina la suscripción en el servidor y en el navegador (best effort). */
async function unsubscribeFromPush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await fetch("/api/push/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: { endpoint: subscription.endpoint } }),
    });
    await subscription.unsubscribe();
  } catch (error) {
    // si el DELETE falla, al desuscribirnos el servicio de push devolverá 404/410
    // en el próximo despacho y el servidor dará de baja el registro
    console.warn("No se pudo eliminar la suscripción", error);
  }
}

type SyncOutcome = "ok" | "unavailable";

/**
 * Al abrir la app: si el permiso sigue concedido, asegura que el servidor tenga
 * la suscripción con la hora y zona actuales (creándola de nuevo si desapareció);
 * si el permiso fue revocado, devuelve "unavailable" para apagar el estado local.
 */
async function syncSubscriptionOnOpen(time: string): Promise<SyncOutcome> {
  if (!pushSupported() || Notification.permission !== "granted") return "unavailable";
  try {
    const registration = await readyRegistration();
    const existing = await registration.pushManager.getSubscription();
    if (!existing) {
      await postRegistration(await subscribeToPush(registration), time);
      return "ok";
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const response = await fetch(`/api/push/subscriptions?endpoint=${encodeURIComponent(existing.endpoint)}`);
    if (response.ok) {
      const { record } = (await response.json()) as { record: { time: string; timezone: string } | null };
      if (record && record.time === time && record.timezone === timezone) return "ok";
    }
    await postRegistration(existing, time);
    return "ok";
  } catch (error) {
    // el permiso sigue concedido: se conserva el estado y se reintenta en la próxima apertura
    console.warn("No se pudo sincronizar la suscripción al abrir", error);
    return "ok";
  }
}

export default function Home() {
  const subscribeDate = (callback: () => void) => {
    window.addEventListener("popstate", callback);
    document.addEventListener("visibilitychange", callback);
    return () => {
      window.removeEventListener("popstate", callback);
      document.removeEventListener("visibilitychange", callback);
    };
  };
  const getDateSnapshot = () => {
    const requested = new URLSearchParams(window.location.search).get("dia");
    return validId(requested) ? requested : todayId();
  };
  const id = useSyncExternalStore(subscribeDate, getDateSnapshot, () => null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationTime, setNotificationTime] = useState("07:00");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [isRead, setIsRead] = useState(false);
  const [readCount, setReadCount] = useState(0);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
  }, []);

  // el SW pide abrir el día desde notificationclick
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; devotionalId?: unknown } | null;
      if (data?.type !== "OPEN_DAY" || typeof data.devotionalId !== "string" || !validId(data.devotionalId)) return;
      window.history.pushState({}, "", `/?dia=${data.devotionalId}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const preference = JSON.parse(window.localStorage.getItem(NOTIFICATIONS_KEY) ?? "{}") as {
          enabled?: unknown;
          time?: unknown;
        };
        const time = typeof preference.time === "string" ? preference.time : "07:00";
        setNotificationTime(time);
        if (preference.enabled !== true) return;
        setNotificationsEnabled(true);
        void syncSubscriptionOnOpen(time).then((outcome) => {
          if (outcome === "unavailable") {
            setNotificationsEnabled(false);
            window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify({ enabled: false, time }));
          }
        });
      } catch { /* almacenamiento no disponible */ }
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(`chequera-read-${new Date().getFullYear()}`) ?? "[]") as string[];
        setReadCount(stored.length);
        if (id) setIsRead(stored.includes(id));
      } catch { /* almacenamiento no disponible */ }
    });
  }, [id]);

  function toggleRead() {
    if (!id) return;
    const key = `chequera-read-${new Date().getFullYear()}`;
    try {
      const stored = new Set(JSON.parse(window.localStorage.getItem(key) ?? "[]") as string[]);
      if (stored.has(id)) stored.delete(id); else stored.add(id);
      const next = [...stored];
      window.localStorage.setItem(key, JSON.stringify(next));
      const justRead = next.includes(id);
      setIsRead(justRead);
      setReadCount(next.length);
      // al marcar leído, el servidor omite la entrega de hoy (PATCH en segundo plano)
      if (notificationsEnabled && justRead) void notifyReadToServer();
    } catch { setNotificationMessage("No se pudo guardar el progreso en este dispositivo."); }
  }

  function selectDay(nextId: string) {
    window.history.pushState({}, "", `/?dia=${nextId}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  async function configureNotifications(enabled: boolean) {
    setNotificationMessage("");
    if (!enabled) {
      setNotificationsEnabled(false);
      window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify({ enabled: false, time: notificationTime }));
      await unsubscribeFromPush();
      setNotificationMessage("Recordatorio desactivado: ya no se enviarán avisos.");
      return;
    }
    if (!pushSupported()) {
      setNotificationMessage("Este navegador no admite recordatorios push.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      // sin permiso no puede haber estado "activo": se queda apagado y se explica cómo reactivarlo
      window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify({ enabled: false, time: notificationTime }));
      setNotificationsEnabled(false);
      setNotificationMessage(
        permission === "denied"
          ? "Permiso bloqueado 🔒. Actívalo desde el candado de la barra de direcciones (o los ajustes del navegador) y vuelve a encender el recordatorio."
          : "No se concedió el permiso; el recordatorio sigue apagado.",
      );
      return;
    }
    try {
      await registerSubscription(notificationTime);
    } catch (error) {
      setNotificationsEnabled(false);
      window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify({ enabled: false, time: notificationTime }));
      setNotificationMessage(error instanceof Error ? error.message : "No se pudo registrar el recordatorio en el servidor.");
      return;
    }
    setNotificationsEnabled(true);
    window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify({ enabled: true, time: notificationTime }));
    setNotificationMessage(`Listo: recibirás el aviso cerca de las ${notificationTime} (puede variar unos minutos).`);
  }

  async function updateNotificationTime(value: string) {
    setNotificationTime(value);
    if (!notificationsEnabled) return;
    window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify({ enabled: true, time: value }));
    // el input puede emitir valores incompletos mientras se escribe
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return;
    setNotificationMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          time: value,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!response.ok) throw new Error(`El servidor rechazó la nueva hora (${response.status}).`);
      setNotificationMessage(`Hora actualizada: la próxima entrega será cerca de las ${value}.`);
    } catch (error) {
      setNotificationMessage(error instanceof Error ? error.message : "No se pudo actualizar la hora en el servidor.");
    }
  }

  const devotional = useMemo(() => entries.find((entry) => entry.id === id), [id]);

  if (!devotional) {
    return <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center p-6">Cargando…</main>;
  }

  const currentYear = new Date().getFullYear();
  const leapYear = currentYear % 4 === 0 && (currentYear % 100 !== 0 || currentYear % 400 === 0);
  const availableEntries = leapYear ? entries : entries.filter((entry) => entry.id !== "02-29");
  const index = availableEntries.findIndex((entry) => entry.id === devotional.id);
  const previous = availableEntries[index - 1];
  const next = availableEntries[index + 1];

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-surface px-5 py-8 text-ink sm:px-10">
      <InstallPrompt />
      <nav className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4 text-sm" aria-label="Navegación principal">
        <Link className="font-bold text-accent" href="/">Inicio</Link>
        <div className="flex items-center gap-3">
          <button type="button" disabled={!previous} onClick={() => previous && selectDay(previous.id)} className="disabled:cursor-not-allowed disabled:text-faint">← Anterior</button>
          <button type="button" disabled={!next} onClick={() => next && selectDay(next.id)} className="disabled:cursor-not-allowed disabled:text-faint">Siguiente →</button>
          <button type="button" onClick={() => selectDay(todayId())} className="font-semibold text-accent">Hoy</button>
          <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Configuración de notificaciones" className="text-lg">⚙</button>
        </div>
        <Link className="text-accent hover:underline" href="/about">Acerca del app</Link>
      </nav>

      <div className="mb-6 flex items-center justify-between gap-3">
        <label className="text-sm font-medium" htmlFor="day-picker">Fecha específica</label>
        <input id="day-picker" type="date" value={idToInputDate(devotional.id)} min={`${currentYear}-01-01`} max={`${currentYear}-12-31`} onChange={(event) => {
          const selected = inputDateToId(event.target.value);
          if (validId(selected)) selectDay(selected);
        }} className="rounded border border-line-strong bg-raised px-2 py-1 text-sm" />
      </div>

      <header className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Chequera del Banco de la Fe</p>
        <h1 className="mt-3 text-3xl font-bold text-ink-strong">{formatDate(devotional)}</h1>
      </header>

      <article>
        <blockquote className="border-l-4 border-accent-solid pl-5 text-xl italic leading-relaxed text-muted">
          “{devotional.verse}”
          <footer className="mt-3 text-base font-semibold not-italic text-accent">
            {devotional.reference}{devotional.translationNote ? ` · ${devotional.translationNote}` : ""}
          </footer>
        </blockquote>

        <section className="mt-8 space-y-5 text-lg leading-8">
          {devotional.content.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
        </section>
      </article>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-3 border-y border-line py-4" aria-label="Progreso de lectura">
        <button type="button" aria-pressed={isRead} onClick={toggleRead} className="rounded border border-accent-solid px-4 py-2 text-sm font-semibold text-accent">
          {isRead ? "✓ Leído" : "Marcar como leído"}
        </button>
        <p className="text-sm text-muted">Progreso anual: {readCount} de {leapYear ? 366 : 365} días</p>
      </section>
      <AppearanceSettings />

      {settingsOpen && <div className="fixed inset-0 z-10 flex items-start justify-center bg-black/30 p-5 pt-20" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <section className="w-full max-w-md rounded-xl bg-raised p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 id="settings-title" className="text-xl font-bold">Recordatorio diario</h2>
            <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Cerrar configuración">×</button>
          </div>
          <p className="mt-3 text-sm text-muted">Recibe un aviso en tu dispositivo, en la web o en la PWA instalada. Puede llegar hasta 15 minutos después de la hora elegida.</p>
          <label className="mt-5 flex items-center gap-3 font-medium">
            <input type="checkbox" checked={notificationsEnabled} onChange={(event) => void configureNotifications(event.target.checked)} />
            Activar recordatorio
          </label>
          <label className="mt-4 block text-sm font-medium" htmlFor="notification-time">Hora del recordatorio</label>
          <input id="notification-time" type="time" step={REMINDER_STEP_MINUTES} value={notificationTime} onChange={(event) => void updateNotificationTime(event.target.value)} className="mt-1 rounded border border-line-strong px-2 py-1" />
          {notificationMessage && <p className="mt-3 text-sm text-accent" role="status">{notificationMessage}</p>}
          <button type="button" onClick={() => setSettingsOpen(false)} className="mt-6 rounded bg-accent-solid px-4 py-2 text-on-accent">Guardar</button>
        </section>
      </div>}
    </main>
  );
}
