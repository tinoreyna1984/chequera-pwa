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

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const preference = JSON.parse(window.localStorage.getItem("chequera-notifications") ?? "{}");
        if (preference.enabled === true) setNotificationsEnabled(true);
        if (typeof preference.time === "string") setNotificationTime(preference.time);
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
      setIsRead(next.includes(id));
      setReadCount(next.length);
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
      window.localStorage.setItem("chequera-notifications", JSON.stringify({ enabled: false, time: notificationTime }));
      return;
    }
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotificationMessage("Este navegador no admite recordatorios push.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setNotificationMessage("Permiso denegado. Actívalo desde la configuración del navegador para recibir recordatorios.");
      setNotificationsEnabled(false);
      return;
    }
    setNotificationsEnabled(true);
    window.localStorage.setItem("chequera-notifications", JSON.stringify({ enabled: true, time: notificationTime }));
    setNotificationMessage("Permiso concedido. La hora quedó guardada en este dispositivo.");
  }

  function updateNotificationTime(value: string) {
    setNotificationTime(value);
    if (notificationsEnabled) {
      window.localStorage.setItem("chequera-notifications", JSON.stringify({ enabled: true, time: value }));
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
    <main className="mx-auto min-h-screen max-w-2xl bg-[#fffdf8] px-5 py-8 text-stone-800 sm:px-10">
      <InstallPrompt />
      <nav className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4 text-sm" aria-label="Navegación principal">
        <Link className="font-bold text-amber-800" href="/">Inicio</Link>
        <div className="flex items-center gap-3">
          <button type="button" disabled={!previous} onClick={() => previous && selectDay(previous.id)} className="disabled:cursor-not-allowed disabled:text-stone-300">← Anterior</button>
          <button type="button" disabled={!next} onClick={() => next && selectDay(next.id)} className="disabled:cursor-not-allowed disabled:text-stone-300">Siguiente →</button>
          <button type="button" onClick={() => selectDay(todayId())} className="font-semibold text-amber-800">Hoy</button>
          <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Configuración de notificaciones" className="text-lg">⚙</button>
        </div>
        <Link className="text-amber-800 hover:underline" href="/about">Acerca del app</Link>
      </nav>

      <div className="mb-6 flex items-center justify-between gap-3">
        <label className="text-sm font-medium" htmlFor="day-picker">Fecha específica</label>
        <input id="day-picker" type="date" value={idToInputDate(devotional.id)} min={`${currentYear}-01-01`} max={`${currentYear}-12-31`} onChange={(event) => {
          const selected = inputDateToId(event.target.value);
          if (validId(selected)) selectDay(selected);
        }} className="rounded border border-stone-300 bg-white px-2 py-1 text-sm" />
      </div>

      <header className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Chequera del Banco de la Fe</p>
        <h1 className="mt-3 text-3xl font-bold text-stone-900">{formatDate(devotional)}</h1>
      </header>

      <article>
        <blockquote className="border-l-4 border-amber-500 pl-5 text-xl italic leading-relaxed text-stone-700">
          “{devotional.verse}”
          <footer className="mt-3 text-base font-semibold not-italic text-amber-800">
            {devotional.reference}{devotional.translationNote ? ` · ${devotional.translationNote}` : ""}
          </footer>
        </blockquote>

        <section className="mt-8 space-y-5 text-lg leading-8">
          {devotional.content.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
        </section>
      </article>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-3 border-y border-stone-200 py-4" aria-label="Progreso de lectura">
        <button type="button" aria-pressed={isRead} onClick={toggleRead} className="rounded border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-800">
          {isRead ? "✓ Leído" : "Marcar como leído"}
        </button>
        <p className="text-sm text-stone-600">Progreso anual: {readCount} de {leapYear ? 366 : 365} días</p>
      </section>
      <AppearanceSettings />

      {settingsOpen && <div className="fixed inset-0 z-10 flex items-start justify-center bg-black/30 p-5 pt-20" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <section className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 id="settings-title" className="text-xl font-bold">Recordatorio diario</h2>
            <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Cerrar configuración">×</button>
          </div>
          <p className="mt-3 text-sm text-stone-600">Recibe un aviso en tu dispositivo, tanto en la web como en la PWA instalada.</p>
          <label className="mt-5 flex items-center gap-3 font-medium">
            <input type="checkbox" checked={notificationsEnabled} onChange={(event) => void configureNotifications(event.target.checked)} />
            Activar recordatorio
          </label>
          <label className="mt-4 block text-sm font-medium" htmlFor="notification-time">Hora del recordatorio</label>
          <input id="notification-time" type="time" step="900" value={notificationTime} onChange={(event) => updateNotificationTime(event.target.value)} className="mt-1 rounded border border-stone-300 px-2 py-1" />
          {notificationMessage && <p className="mt-3 text-sm text-amber-800" role="status">{notificationMessage}</p>}
          <button type="button" onClick={() => setSettingsOpen(false)} className="mt-6 rounded bg-amber-700 px-4 py-2 text-white">Guardar</button>
        </section>
      </div>}
    </main>
  );
}
