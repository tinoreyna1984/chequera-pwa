# Proposal

## Why

El proyecto existe únicamente como plantilla de `create-next-app`: no hay lectura del devocional, ni datos extraídos del PDF, ni PWA, ni recordatorios. `especificaciones-chequera.md` (v2) define lo que el producto debe hacer y el análisis de viabilidad confirmó que es posible construirlo; falta convertir esa definición en comportamiento verificable.

## What Changes

- Estructura hexagonal completa bajo `src/` con núcleo puro (entidades, puertos y casos de uso) y adaptadores para cliente y servidor.
- Extracción única del PDF de Spurgeon a `public/data/devotionals.json` mediante `pdftotext` y un script con validación obligatoria de 366 entradas.
- Lector del devocional diario: fecha local, navegación por el año calendario, marcado de "Leído", progreso anual, tipografía ajustable y modo oscuro.
- PWA instalable: manifiesto, íconos ya generados, Service Worker con precache (app shell y datos), página sin conexión y banner de instalación.
- Recordatorio diario con Web Push completo: suscripción, configuración de hora/zona horaria, despacho idempotente desde servidor y notificación con el contenido del día.
- Dos disparadores para el despacho: programador local en desarrollo y Vercel Schedules cada 15 minutos en producción (plan Hobby), con el mismo endpoint protegido por `CRON_SECRET`.

## Capabilities

### New Capabilities

- `devotional-data`: generación y forma de `devotionals.json` a partir del PDF, incluyendo las 366 entradas, su normalización y la validación.
- `daily-reading`: presentación del devocional correspondiente a la fecha local, navegación dentro del año y contenido renderizado.
- `reading-progress`: registro de lecturas "Leídas" por año calendario y estadísticas de avance.
- `reading-appearance`: preferencias de tipografía y tema (claro/oscuro/sistema) persistidas en el cliente.
- `daily-reminder`: configuración del recordatorio en el cliente, alta y baja de suscripciones Web Push, y despacho programado e idempotente desde el servidor.
- `service-worker`: precache del shell y de los datos, operación sin conexión, manejo de notificaciones push y cambio de suscripción.
- `app-installation`: manifiesto, íconos, indicaciones de instalación y pantalla de inicio con el retrato de Spurgeon.

### Modified Capabilities

(Ninguna: el proyecto todavía no tiene especificaciones registradas.)

## Impact

- **Código:** se reemplaza la plantilla de `app/` por `src/app/`; se crea `src/core/`, `src/adapters/`, `src/composition/` y `src/instrumentation.ts`. Se mueve `chequera-spurgeon.pdf` a `data/raw/` y se elimina `app/favicon.ico` (ya reemplazado por `app/icon.png`).
- **Dependencias nuevas:** `serwist`, `@serwist/next`, `@serwist/cli`, `esbuild`, `concurrently`, `web-push`, `@upstash/redis`, `@date-fns/tz`, `vitest` y el binario del sistema `pdftotext` (solo para regenerar datos, no para el build).
- **Configuración:** `next.config.ts` (Serwist, `serverExternalPackages`), `tsconfig.json` (`@/*` -> `./src/*`), ESLint con `no-restricted-imports` sobre `src/core/**`, `vercel.json` con el schedule `*/15`, `serwist.config.js`, `.gitignore` (`public/sw*`, `.data/`), `package.json` (scripts `dev`, `build`, `data:build`, `test`).
- **Variables de entorno:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `PUSH_LOCAL_SCHEDULER`, `NEXT_PUBLIC_REMINDER_STEP_MINUTES`.
- **APIs nuevas:** `POST/PATCH/DELETE /api/push/subscriptions`, `POST /api/push/dispatch`, `POST /api/push/test`.
- **Datos:** se versiona `public/data/devotionals.json` (~0.5 MB) y `data/overrides.json`.
