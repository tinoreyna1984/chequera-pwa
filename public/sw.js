const CACHE = "chequera-shell-v2";
const PRECACHE = ["/", "/about", "/~offline", "/manifest.webmanifest", "/data/devotionals.json", "/icons/icon-192.png", "/icons/icon-512.png"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function pushPayload(event) {
  try {
    const data = event.data ? event.data.json() : null;
    if (data && typeof data.devotionalId === "string") return { devotionalId: data.devotionalId };
  } catch (error) { console.warn("push con payload ilegible", error); }
  return { devotionalId: "" };
}
async function composeNotification(devotionalId) {
  const generic = { title: "Recordatorio diario", body: "Tu lectura de hoy te espera en Chequera." };
  if (!devotionalId) return generic;
  try {
    const cached = await caches.match("/data/devotionals.json");
    if (!cached) return generic;
    const data = await cached.json();
    const entry = (data.devotionals || []).find((devotional) => devotional.id === devotionalId);
    if (!entry) return generic;
    return {
      title: `Devocional del ${entry.day} de ${MONTHS[Number(entry.month) - 1]}`,
      body: `${entry.verse} — ${entry.reference}`,
    };
  } catch (error) {
    console.warn("no se pudo componer la notificación", error);
    return generic;
  }
}
self.addEventListener("push", (event) => {
  const { devotionalId } = pushPayload(event);
  event.waitUntil(
    composeNotification(devotionalId).then(({ title, body }) =>
      self.registration.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { devotionalId },
        tag: "devocional-diario",
      }),
    ),
  );
});
async function openDay(devotionalId) {
  const url = devotionalId ? `/?dia=${encodeURIComponent(devotionalId)}` : "/";
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const home = windows.find((client) => { try { return new URL(client.url).pathname === "/"; } catch { return false; } });
  const target = home || windows[0];
  if (target) {
    // el aviso a las ventanas no depende de poder enfocar (focus puede ser rechazado)
    for (const client of windows) client.postMessage({ type: "OPEN_DAY", devotionalId });
    try { await target.focus(); } catch { /* la ventana ya visible recibe el mensaje */ }
    return;
  }
  await self.clients.openWindow(url);
}
self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  const devotionalId = typeof data.devotionalId === "string" ? data.devotionalId : "";
  event.notification.close();
  event.waitUntil(openDay(devotionalId));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // la API nunca se cachea: el estado de la suscripción debe leerse siempre del servidor
  if (new URL(event.request.url).pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/~offline"))));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match("/~offline"))));
});
