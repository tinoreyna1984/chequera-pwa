# Especificación Técnica: `chequera-pwa` (v2)

## 1. Resumen Ejecutivo
**`chequera-pwa`** es una Aplicación Web Progresiva (PWA) construida con Next.js 16 y Tailwind CSS 4 que convierte el devocional *Chequera del Banco de la Fe* de Charles H. Spurgeon (traducción de Allan Román A., dominio público) en una experiencia de lectura diaria, instalable y *offline-first*. Las 366 lecturas se extraen una sola vez del PDF original a un JSON estático versionado. El usuario puede programar un recordatorio diario mediante **Web Push (VAPID)**, despachado por un proceso del lado servidor que funciona igual en desarrollo local y en Vercel (plan Hobby).

---

## 2. Stack Tecnológico y Arquitectura
* **Framework:** Next.js 16.4 (App Router, `cacheComponents`, `partialPrefetching`, Turbopack)
* **UI:** React 19.3, Tailwind CSS 4 (modo oscuro por clase)
* **Lenguaje:** TypeScript 5 (`strict`)
* **Arquitectura:** Hexagonal (Puertos y Adaptadores) con raíz de composición explícita
* **Extracción de datos:** `pdftotext` (poppler-utils) + script TypeScript ejecutado con Node 24 (type stripping nativo)
* **PWA:** Serwist en **modo configurador** (`@serwist/next` + `@serwist/cli`), que genera `public/sw.js` después de `next build`. El manifiesto se define en `src/app/manifest.ts`
* **Notificaciones:** Web Push API + librería `web-push` (VAPID)
* **Persistencia en cliente:** `localStorage` con claves versionadas
* **Persistencia en servidor:** Upstash Redis (integración de Vercel Marketplace) al desplegar; archivo JSON local en desarrollo
* **Programación del despacho:** Vercel Schedules (ruta con `CRON_SECRET`, cada 15 min) al desplegar; `instrumentation.ts` en local; cron externo como respaldo
* **Fechas y zonas horarias:** `@date-fns/tz`
* **Pruebas:** Vitest (núcleo, parser y despacho)

> **No se usan:** Notification Triggers API (abandonada por los navegadores) ni Periodic Background Sync (ejecución no garantizada ni a hora exacta) para el recordatorio.
>
> **Nota:** `@serwist/turbopack` no es compatible con `cacheComponents: true`, porque su route handler exporta `dynamic`, `dynamicParams` y `revalidate`, que Next 16 prohíbe en ese modo. Por eso se usa el modo configurador.

---

## 3. Estructura de Directorios (Arquitectura Hexagonal)

```text
chequera-pwa/
+-- data/
|   +-- raw/chequera-spurgeon.pdf        # Fuente original (se mueve desde la raíz)
|   +-- overrides.json                   # Correcciones manuales por id (casos irregulares)
+-- scripts/
|   +-- build-devotionals.ts             # pdftotext -> parseo -> validación -> JSON
+-- public/
|   +-- data/devotionals.json            # GENERADO y versionado (lo consume el cliente y el SW)
|   +-- icons/                           # 192, 512, maskable-512, apple-touch-icon-180
|   +-- sw.js                            # GENERADO por `serwist build` (en .gitignore)
+-- src/
|   +-- core/                            # NÚCLEO: sin dependencias de React, Next, navegador ni web-push
|   |   +-- domain/
|   |   |   +-- devotional/              # Devotional, DevotionalId
|   |   |   +-- reading/                 # ReadingProgress, ReadingRecord
|   |   |   +-- preferences/             # ReaderPreferences
|   |   |   +-- reminder/                # ReminderSettings, PushSubscriptionRecord, ReminderSchedule
|   |   |   +-- shared/                  # LocalDate, errores de dominio
|   |   +-- ports/                       # Puertos secundarios (interfaces)
|   |   |   +-- DevotionalRepository.ts
|   |   |   +-- ReadingProgressRepository.ts
|   |   |   +-- PreferencesRepository.ts
|   |   |   +-- ReminderSettingsRepository.ts
|   |   |   +-- PushRegistrationGateway.ts   # cliente: permiso + PushManager + API
|   |   |   +-- SubscriptionStore.ts         # servidor
|   |   |   +-- PushSender.ts                # servidor
|   |   |   +-- Clock.ts
|   |   +-- application/                 # Casos de uso (puertos primarios)
|   |       +-- reading/                 # GetDevotionalForDate, GetAdjacentDevotional,
|   |       |                            # ToggleReadStatus, GetReadingStats
|   |       +-- preferences/             # UpdateReaderPreferences
|   |       +-- reminder/                # EnableDailyReminder, DisableDailyReminder,
|   |       |                            # UpdateReminderTime, SyncReminder
|   |       +-- push/                    # RegisterSubscription, RemoveSubscription,
|   |                                    # SkipTodayReminder, DispatchDueReminders, SendTestReminder
|   +-- adapters/
|   |   +-- primary/
|   |   |   +-- ui/components/           # DevotionalReader, DayNavigator, ReadToggle,
|   |   |   |                            # ReadingStats, ReaderSettings, ReminderForm,
|   |   |   |                            # InstallPrompt, IosInstallHint
|   |   |   +-- ui/hooks/
|   |   |   +-- http/                    # Handlers usados por los route.ts
|   |   |   +-- scheduler/               # Programador local (setInterval)
|   |   |   +-- service-worker/sw.ts     # Precache, push, notificationclick, pushsubscriptionchange
|   |   +-- secondary/
|   |       +-- client/                  # StaticJsonDevotionalRepository,
|   |       |                            # LocalStorageReadingProgressRepository,
|   |       |                            # LocalStoragePreferencesRepository,
|   |       |                            # LocalStorageReminderSettingsRepository,
|   |       |                            # BrowserPushRegistrationGateway
|   |       +-- server/                  # UpstashSubscriptionStore, FileSubscriptionStore,
|   |                                    # WebPushSender, SystemClock
|   +-- composition/
|   |   +-- client.ts                    # Ensambla adaptadores del navegador
|   |   +-- server.ts                    # Elige adaptadores según el entorno (ver sección 7)
|   +-- app/                             # Next.js App Router (se mueve desde /app)
|   |   +-- layout.tsx                   # lang="es", metadata, viewport, script anti-flash
|   |   +-- page.tsx                     # Devocional del día (shell estático + cliente)
|   |   +-- settings/page.tsx            # Lectura, apariencia y recordatorio
|   |   +-- ~offline/page.tsx            # Página de respaldo sin conexión
|   |   +-- manifest.ts
|   |   +-- api/push/
|   |       +-- subscriptions/route.ts   # POST (alta/actualización), PATCH (omitir hoy), DELETE
|   |       +-- dispatch/route.ts        # POST protegido con CRON_SECRET
|   |       +-- test/route.ts            # POST: notificación de prueba
|   +-- instrumentation.ts               # Arranca el programador local (solo fuera de Vercel)
+-- serwist.config.js
+-- vercel.json                          # Schedules
+-- next.config.ts
+-- tsconfig.json                        # "@/*" -> "./src/*"
```

**Reglas de dependencia:**
- `src/core/**` no puede importar `react`, `next`, `web-push`, `@upstash/*` ni APIs del navegador. Se valida con `no-restricted-imports` de ESLint.
- Los adaptadores dependen del núcleo, nunca al revés.
- Solo `src/composition/*` crea instancias de adaptadores concretos.

---

## 4. Modelos de Dominio (`src/core/domain`)

### `DevotionalId` (objeto de valor)
Cadena con formato `MM-DD` (ej. `"11-05"`).
- `fromLocalDate(date)`: obtiene el id a partir de la fecha **local** del usuario.
- `next(year)` / `previous(year)`: navegación dentro del año calendario. En años no bisiestos se salta `02-29` (`02-28` -> `03-01`). Devuelve `null` en los límites `01-01` y `12-31`.
- `isLeapDayOnly()`: es `true` solo para `02-29`.

### `Devotional` (contenido inmutable, viene del JSON)

| Propiedad | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | `DevotionalId` | Identificador `MM-DD`. |
| `month` | `number` | Mes (`1`-`12`). |
| `day` | `number` | Día (`1`-`31`). |
| `verse` | `string` | Texto de la promesa, sin comillas exteriores. |
| `reference` | `string` | Cita normalizada (ej. `"Génesis 3:15"`). |
| `translationNote` | `string \| undefined` | Versión bíblica indicada en el original (ej. `"La Biblia de las Américas"`). |
| `content` | `string[]` | Párrafos de la reflexión de Spurgeon. |
| `pdfPage` | `number` | Página física en `chequera-spurgeon.pdf`. |

> Se eliminan `title`, porque el PDF no trae un título separado del versículo, e `isRead`, porque es estado del usuario y no forma parte del contenido.

### `ReadingRecord`
| Propiedad | Tipo | Descripción |
| :--- | :--- | :--- |
| `devotionalId` | `DevotionalId` | Lectura marcada. |
| `readAt` | `string` | Momento ISO 8601 en que se marcó. |

### `ReadingProgress` (agregado, uno por año calendario)
| Propiedad / método | Descripción |
| :--- | :--- |
| `year` | Año calendario al que pertenece el progreso. |
| `records` | Mapa `DevotionalId -> ReadingRecord`. |
| `markRead(id, at)` / `unmarkRead(id)` / `isRead(id)` | Operaciones de lectura. Rechaza `02-29` en años no bisiestos. |
| `stats(today)` | `{ readCount, totalDays (365 \| 366), percentage, currentStreak }`. |

> El progreso es **por año**: marcar "Leído" un día de 2026 no lo marca en 2027, porque el devocional es un ciclo anual.

### `ReaderPreferences`
| Propiedad | Tipo | Por defecto |
| :--- | :--- | :--- |
| `fontScale` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` |
| `theme` | `'system' \| 'light' \| 'dark'` | `'system'` |

### `ReminderSettings` (cliente)
| Propiedad | Tipo | Descripción |
| :--- | :--- | :--- |
| `enabled` | `boolean` | Recordatorio activo. |
| `time` | `string` | `HH:mm` (24 h), en pasos de 15 min. |
| `timezone` | `string` | Zona IANA del dispositivo (ej. `"America/Lima"`). |
| `endpoint` | `string \| undefined` | Endpoint de la suscripción push registrada. |

> El permiso de notificaciones **no se guarda**: se lee en tiempo de ejecución de `Notification.permission` para evitar que el valor guardado quede desactualizado.

### `PushSubscriptionRecord` (servidor)
| Propiedad | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | `string` | `sha256(endpoint)`. |
| `subscription` | `{ endpoint, keys: { p256dh, auth } }` | Datos de la suscripción Web Push. |
| `time` / `timezone` | `string` | Preferencia del usuario. |
| `nextDueAt` | `number` | Próximo envío (epoch UTC en ms). |
| `lastSentLocalDate` | `string \| undefined` | `YYYY-MM-DD` local del último envío. |
| `skipLocalDate` | `string \| undefined` | Fecha local en la que no se debe enviar (ya se leyó). |
| `failureCount` | `number` | Fallos transitorios consecutivos. |
| `createdAt` / `updatedAt` | `string` | ISO 8601. |

### `ReminderSchedule` (servicio de dominio puro)
- `nextOccurrence(time, timezone, after)`: siguiente instante UTC en que la hora local es `time`. Si la hora no existe por un cambio de horario de verano, usa el primer minuto válido posterior. Si la hora es ambigua, usa la primera ocurrencia.
- `localDateOf(instant, timezone)`: devuelve `YYYY-MM-DD` y el `DevotionalId` correspondiente.

**Forma de `public/data/devotionals.json`:**
```json
{
  "version": 1,
  "source": "chequera-spurgeon.pdf",
  "generatedAt": "2026-11-05T00:00:00.000Z",
  "devotionals": [
    {
      "id": "01-01", "month": 1, "day": 1,
      "verse": "Y pondré enemistad entre ti y la mujer, ...",
      "reference": "Génesis 3:15",
      "content": ["Esta es la primera promesa al hombre caído...", "..."],
      "pdfPage": 6
    }
  ]
}
```

---

## 5. Requerimientos Funcionales

### RF-01: Extracción del PDF a JSON
* **Descripción:** El script `npm run data:build` ejecuta `pdftotext -layout` sobre `data/raw/chequera-spurgeon.pdf`, interpreta el texto y genera `public/data/devotionals.json`. El JSON se versiona en git, así que el build de Vercel **no** necesita poppler.
* **Criterios de Aceptación:**
  - [ ] Separa por página (`\f`) para obtener `pdfPage`, y descarta el prefacio y la doxología final.
  - [ ] Elimina el encabezado `CHEQUERA DEL BANCO DE LA FE 2011` y los números de página.
  - [ ] Reconoce encabezados `D de Mes` sin importar mayúsculas (ej. `1 de octubre`), con punto final opcional (ej. `11 de Enero.`) y con texto en la misma línea.
  - [ ] Separa `verse` y `reference` aunque la referencia esté partida entre líneas, falte la comilla de cierre o no haya línea en blanco antes del cuerpo.
  - [ ] Extrae las anotaciones de versión entre paréntesis a `translationNote`.
  - [ ] Normaliza la referencia (`"Génesis 3: 15."` -> `"Génesis 3:15"`).
  - [ ] Reconstruye párrafos: hay corte cuando la línea termina en puntuación final **y** la primera palabra de la siguiente línea habría cabido en ella. Une las líneas con un espacio.
  - [ ] Aplica `data/overrides.json` por id cuando la heurística falla (ej. referencias incompletas como `09-08` "Isaías 42:" o `11-06` "Salmo 37:").
  - [ ] **Validación obligatoria** (el script termina con código distinto de 0 si falla): exactamente 366 ids únicos, todas las fechas válidas, `02-29` presente, `verse` y `reference` no vacíos, al menos un párrafo por día, sin restos de encabezados o numeración.
  - [ ] Imprime un reporte con advertencias por id.

### RF-02: Lectura del Devocional Diario
* **Descripción:** Muestra el devocional que corresponde a la fecha **local** del dispositivo.
* **Criterios de Aceptación:**
  - [ ] `/` se sirve como shell estático. La fecha se calcula en el cliente, porque el servidor no conoce la zona horaria del usuario y, con `cacheComponents`, `new Date()` no debe usarse al prerenderizar.
  - [ ] `/?dia=MM-DD` abre un día específico (lo usan las notificaciones). El componente que lee `useSearchParams` va dentro de `<Suspense>`.
  - [ ] Hay navegación a anterior/siguiente dentro del año calendario en curso, botón "Hoy", y se salta `02-29` en años no bisiestos.
  - [ ] Permite marcar o desmarcar "Leído" (con `aria-pressed`). El progreso se guarda por año en `localStorage`.
  - [ ] Muestra el progreso anual (leídos/total, %) y la racha actual.
  - [ ] Si el usuario marca como leído el devocional **de hoy** y tiene el recordatorio activo, se llama a `PATCH /api/push/subscriptions` para omitir el recordatorio de ese día (sin bloquear la UI; si falla, se ignora).
  - [ ] Ofrece accesibilidad tipográfica (4 tamaños) y tema sistema/claro/oscuro. El modo oscuro de Tailwind 4 funciona por clase (`@custom-variant dark`) y un script en línea evita el parpadeo antes de la hidratación.
  - [ ] Al volver a la app (`visibilitychange`), si cambió la fecha local se actualiza "hoy".
  - [ ] `<html lang="es">`, con metadatos y textos en español.

### RF-03: Configuración del Recordatorio Diario (cliente)
* **Criterios de Aceptación:**
  - [ ] En `/settings` el usuario activa o desactiva el recordatorio y elige la hora (`input type="time"`, con `step` según `NEXT_PUBLIC_REMINDER_STEP_MINUTES`, 15 min en Hobby).
  - [ ] Detecta si el navegador lo soporta (`serviceWorker`, `PushManager`, `Notification`). En iOS/iPadOS fuera del modo standalone, muestra cómo instalar la app ("Compartir -> Agregar a inicio"), porque es requisito para recibir push (iOS 16.4+).
  - [ ] Al activar, dentro del gesto del usuario: `Notification.requestPermission()`, luego `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, luego `POST /api/push/subscriptions` con `{ subscription, time, timezone }`, y finalmente guarda `ReminderSettings`.
  - [ ] Cambiar la hora vuelve a hacer el `POST` (alta o actualización). Desactivar hace `unsubscribe()` y `DELETE`.
  - [ ] Si el permiso es `denied`, muestra instrucciones para reactivarlo y no se queda en un estado inconsistente.
  - [ ] **Sincronización al iniciar** (`SyncReminder`): si está activo pero la suscripción desapareció o cambió, o si cambió la zona horaria, se vuelve a registrar.
  - [ ] Hay un botón "Enviar notificación de prueba" (`POST /api/push/test`).
  - [ ] Informa la precisión esperada: en producción (Hobby) el recordatorio puede llegar hasta ~30 min después de la hora elegida.

### RF-04: Registro y Despacho de Recordatorios (servidor)
* **Criterios de Aceptación:**
  - [ ] `POST /api/push/subscriptions`: valida que el endpoint sea `https`, que existan las llaves, el formato `HH:mm` y la zona IANA (con `Intl`). Verifica el encabezado `Origin` y limita el tamaño del cuerpo. Hace alta o actualización y calcula `nextDueAt`.
  - [ ] `PATCH /api/push/subscriptions`: `{ endpoint, skipLocalDate }`. `DELETE`: `{ endpoint }`.
  - [ ] `POST /api/push/dispatch` exige `Authorization: Bearer ${CRON_SECRET}` y ejecuta `DispatchDueReminders(now)`:
    1. Toma un lock (`SET NX EX 120`). Si no lo obtiene, termina sin hacer nada.
    2. Obtiene las suscripciones con `nextDueAt <= now` (ZSET ordenado por `nextDueAt`).
    3. Si `lastSentLocalDate` o `skipLocalDate` son iguales a la fecha local de hoy, reprograma sin enviar.
    4. Si `now - nextDueAt` es mayor que 2 h (caída o retraso), reprograma sin enviar.
    5. En otro caso, envía el push con payload `{ "kind": "daily-reminder", "devotionalId": "MM-DD" }`, `TTL` de 3600 s, `topic: "daily-reminder"` y `urgency: "normal"`.
    6. Respuesta `201`: guarda `lastSentLocalDate`. `404`/`410`: elimina la suscripción. `429`/`5xx`: incrementa `failureCount` y reintenta en el siguiente ciclo; después de 5 fallos, reprograma para el día siguiente.
    7. Recalcula `nextDueAt` con `ReminderSchedule` (respetando el horario de verano).
    8. Responde un resumen JSON `{ due, sent, skipped, removed, failed }`.
  - [ ] El despacho es **idempotente**: ejecutarlo dos veces seguidas no duplica notificaciones.
  - [ ] El servidor no necesita el contenido de los devocionales: solo envía el `devotionalId`.
  - [ ] Solo se guardan endpoint, llaves, hora y zona horaria. No hay datos personales.

### RF-05: Service Worker y Notificaciones
* **Criterios de Aceptación:**
  - [ ] `push`: con el `devotionalId` recibido, busca el devocional en el `devotionals.json` cacheado y muestra la notificación. Título: "Promesa del día — 5 de noviembre". Cuerpo: versículo truncado y referencia. Si no hay caché, usa un texto genérico.
  - [ ] `notificationclick`: si ya hay una ventana abierta, la enfoca y navega a `/?dia=MM-DD`; si no, la abre.
  - [ ] `pushsubscriptionchange`: se suscribe de nuevo y envía `{ oldEndpoint, subscription }` para migrar el registro en el servidor.

### RF-06: Capacidades PWA (Instalación y Modo Offline)
* **Criterios de Aceptación:**
  - [ ] `src/app/manifest.ts` con `name: "Chequera del Banco de la Fe"`, `short_name: "Chequera"`, `lang: "es"`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, colores de tema y fondo, e íconos 192/512/maskable. Además, `apple-touch-icon`.
  - [ ] Serwist en modo configurador genera `public/sw.js` después de `next build`. Precachea el shell, las rutas prerenderizadas, `/~offline` y `/data/devotionals.json` (con revisión igual al hash del contenido; se sirve `CacheFirst`).
  - [ ] `/sw.js` se sirve con `Cache-Control: no-cache, no-store, must-revalidate`.
  - [ ] Después de la primera carga, la app abre y muestra cualquier día sin conexión.
  - [ ] En Chromium hay un banner discreto de instalación (`beforeinstallprompt`) que se puede descartar y no reaparece durante 30 días. En iOS se muestra la indicación manual de instalación.

---

## 6. Requerimientos No Funcionales
- **Pureza del núcleo:** se aplica con ESLint (`no-restricted-imports` sobre `src/core/**`).
- **Pruebas (Vitest):** parser (casos irregulares conocidos: 01-01, 03-22, 04-05, 08-18, 09-08, 11-06, 12-24), `DevotionalId` (bisiestos y límites), `ReadingProgress.stats`, `ReminderSchedule` (`America/Lima` y `America/New_York` en los cambios de horario) y `DispatchDueReminders` con adaptadores falsos.
- **Accesibilidad:** contraste AA, foco visible, objetivos táctiles de al menos 44 px.
- **Peso:** `devotionals.json` de aproximadamente 0.5 MB (~150 KB con gzip). Se carga una vez y queda en caché.
- **Seguridad:** las llaves VAPID y `CRON_SECRET` solo existen en el servidor. Los endpoints validan su entrada.

---

## 7. Entornos y Configuración

| Variable | Uso |
| :--- | :--- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Llave pública VAPID (cliente y servidor). |
| `VAPID_PRIVATE_KEY` | Llave privada VAPID (servidor). |
| `VAPID_SUBJECT` | `mailto:` de contacto. |
| `CRON_SECRET` | Protege `/api/push/dispatch` (mínimo 16 caracteres). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Si existen, se usa `UpstashSubscriptionStore`. |
| `PUSH_LOCAL_SCHEDULER` | `on` (por defecto en local) u `off`. Se ignora en Vercel. |
| `NEXT_PUBLIC_REMINDER_STEP_MINUTES` | Paso del selector de hora (`15` en Hobby). |

| | Local (`npm run dev`) | Vercel Hobby |
| :--- | :--- | :--- |
| Almacén | `FileSubscriptionStore` (`.data/`, en .gitignore) | Upstash Redis |
| Disparador | `instrumentation.ts` cada 60 s | Vercel Schedule `*/15 * * * *` (jitter 15 min) |
| Precisión aprox. | ~1 min | hasta ~30 min |
| Respaldo | Llamada manual con `curl` | Cron externo con `CRON_SECRET` |

- Cuota de Hobby: `*/15` equivale a ~2,976 ejecuciones/mes, dentro del límite de 5,000. Vercel Schedules está en beta; si cambia, el endpoint puede dispararse desde un cron externo sin cambios de código. El Cron Jobs clásico no sirve en Hobby (solo una vez al día).
- En Vercel, si faltan las credenciales de Redis, la app **falla al iniciar con un mensaje claro**, en lugar de intentar escribir en un sistema de archivos de solo lectura.
- `vercel.json`: `{ "schedules": { "push-dispatch": { "schedule": "*/15 * * * *", "path": "/api/push/dispatch" } } }`.
- Scripts: `dev` ejecuta `serwist build --watch` y `next dev` en paralelo (con `concurrently`); `build` ejecuta `next build && serwist build`; además `data:build` y `test`.
- Pruebas de push en el celular: `localhost` cuenta como contexto seguro. Para dispositivos en la LAN se usa un túnel HTTPS (cloudflared/ngrok), porque los certificados autofirmados no permiten registrar el Service Worker.
- Las llaves VAPID se generan con `npx web-push generate-vapid-keys`.

---

## 8. Fuera de Alcance
- Cuentas de usuario y sincronización del progreso entre dispositivos.
- Vista de índice o calendario anual (posible mejora futura).
- Otros idiomas.
- Notification Triggers API y Periodic Background Sync.

## 9. Supuestos y Pendientes
- **Derechos:** la obra y su traducción son de dominio público.
- **Plan de Vercel:** Hobby (uso no comercial, precisión de hasta ~30 min).
- **Íconos (listos):** libro abierto con un cheque y una cruz, en dorado y crema sobre azul marino (`#1e2a4a`). Están en `public/icons/` (`icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png`; fuente en `icon-source.png`). El ícono de la pestaña del navegador usa las convenciones de Next: `app/icon.png` y `app/apple-icon.png`, que reemplazan a `favicon.ico`. El color de tema y de fondo del manifiesto es `#1e2a4a`.
- **Splash screen (lista):** el retrato `public/Charles_Haddon_Spurgeon.jpg` centrado sobre azul marino, en `public/splash/splash-{ancho}x{alto}.jpg` (iPhone y iPad). En iOS se declaran como `apple-touch-startup-image` mediante `metadata.appleWebApp.startupImage`. En Android la splash la genera el sistema a partir de `background_color` y el ícono del manifiesto, así que el retrato no puede usarse ahí.

---

## 10. Hoja de Ruta de Implementación

- [ ] **Fase 0: Spikes de validación**
  - [ ] Serwist en modo configurador con `cacheComponents` y Turbopack: confirmar que `public/sw.js` se genera y Vercel lo publica.
  - [ ] Vercel Schedules (ruta con `CRON_SECRET`, `*/15`) en Hobby.
  - [ ] Push de punta a punta en Android (Chrome) y en iOS con la app instalada.
- [ ] **Fase 1: Reestructura y base**
  - [ ] Mover `app/` a `src/app/`, actualizar `@/*` a `./src/*`, mover el PDF a `data/raw/`.
  - [ ] Quitar los recursos de la plantilla, poner `lang="es"` y los metadatos.
  - [ ] Configurar Vitest y la regla ESLint de pureza del núcleo.
- [ ] **Fase 2: Datos (PDF -> JSON)**
  - [ ] `scripts/build-devotionals.ts`, `data/overrides.json`, validación y pruebas del parser.
  - [ ] Generar y versionar `public/data/devotionals.json`.
- [ ] **Fase 3: Núcleo**
  - [ ] Entidades y objetos de valor, puertos, casos de uso y `ReminderSchedule`, con pruebas.
- [ ] **Fase 4: Lectura (adaptadores cliente + UI)**
  - [ ] Repositorios `StaticJson*` y `LocalStorage*`, lector, navegación, progreso y preferencias.
- [ ] **Fase 5: PWA**
  - [ ] `manifest.ts`, íconos, `serwist.config.js`, `sw.ts` (precache y offline), banner e indicación para iOS.
- [ ] **Fase 6: Push**
  - [ ] Endpoints, `FileSubscriptionStore` / `UpstashSubscriptionStore`, `WebPushSender`, `DispatchDueReminders`.
  - [ ] Programador local (`instrumentation.ts`), `vercel.json`, `ReminderForm`, manejadores push del SW.
- [ ] **Fase 7: Despliegue**
  - [ ] Proyecto en Vercel, integración de Upstash, variables de entorno y verificación en dispositivos reales.
