# Design

## Context

Ver `proposal.md` (Why) para la motivación. Contexto técnico relevante:

- `src/app/page.tsx` (líneas 102–129): `configureNotifications` solo hace soporte → `Notification.requestPermission()` → guardar `{enabled, time}` en `localStorage` (`chequera-notifications`). No hay `pushManager.subscribe()`, ni llamada a servidor, ni `PATCH` al marcar leído, ni sincronización al abrir.
- No existe `src/app/api/` (cero endpoints), `web-push` y `@upstash/redis` no están en `package.json`, no hay `.env` ni `vercel.json`, y `public/sw.js` solo tiene `install`/`activate`/`fetch` — sin `push` ni `notificationclick`.
- La spec `openspec/specs/daily-reminder/spec.md` (8 requisitos) ya define el comportamiento completo; este cambio la implementa sin tocarla (`.openspec.yaml` → `skip_specs: true`).
- `public/data/devotionals.json` ya está en el `PRECACHE` del SW — disponible para componer el cuerpo de la notificación.
- `src/core/` existe con `devotional-id.ts` y `reading-progress.ts` + pruebas Vitest; ESLint prohíbe `react`, `next`, `web-push`, `@upstash/*` y APIs de navegador en `src/core/**`.
- Hallazgos de investigación (noviembre 2026): los cron jobs *legacy* de Vercel en Hobby corren como máximo una vez al día (fallaría el deploy con `*/15`), pero **Vercel Schedules** (public beta 2026-11-05) permite en Hobby `*/15` con jitter fijo de 15 min, target `path` con `POST` por defecto y envía `Authorization: Bearer <CRON_SECRET>` automáticamente; límite de 5,000 ejecuciones/mes frente a las ~2,880 necesarias.

## Goals / Non-Goals

**Goals:**

- Que el recordatorio entregue con la app cerrada (Android/iOS como PWA instalada o pestaña abierta), cumpliendo los 8 requisitos de `daily-reminder`.
- Despacho idempotente y sobreviviente a caídas (sin dobles entregas, sin avisos tardíos >2h).
- Migración automática de usuarios que ya activaron el checkbox sin suscripción real.
- Lógica de despacho unitariamente testeable con Vitest, sin ceremonia arquitectónica nueva.

**Non-Goals:**

- Cambios de spec (`daily-reminder` ya cubre el comportamiento) o de la UI más allá de los ajustes necesarios para reflejar el nuevo estado real.
- Endpoint de notificación de prueba (no está en la spec; la verificación se hace con hora próxima).
- Sistema de gestión de suscripciones multiusuario o panel administrativo.
- `instrumentation.ts` / scheduler local automático: en desarrollo el despacho se dispara con `curl` documentado.

## Decisions

**1. Disparador: Vercel Schedules con target `path` en `vercel.json`.**

```json
{ "schedules": { "push-dispatch": { "schedule": "*/15 * * * *", "path": "/api/push/dispatch", "requestMethod": "POST" } } }
```

*Por qué:* es la única vía nativa en Hobby que permite sub-daily; Vercel envía `CRON_SECRET` en la cabecera y usa POST por defecto, exactamente lo que la spec exige ("Despacho programado e idempotente"). La spec no dicta quién invoca, así que el endpoint queda agnóstico al llamador.
*Alternativas descartadas:* cron legacy de Vercel (Hobby: 1 vez/día, el deploy fallaría con `*/15`); cron externo (servicio de terceros que puede caer o descontinuar; queda como respaldo documentado); GitHub Actions `schedule` (se desactiva a los 60 días sin actividad del repo); Vercel Pro (costo innecesario para una app personal).
*Latencia real:* con jitter de 15 min en Hobby el aviso llega entre 0 y ~30 min después de la hora elegida; la spec tolera hasta 2h y el paso del selector ya es de 15 min.

**2. Almacén: Upstash Redis (hash + ZSET + lock).**

- Hash por suscripción indexado por `endpoint` (upsert idempotente): `{ time, timezone, lastSentDate, readDate, failCount }`.
- ZSET de "próxima entrega" para recorrer solo las candidatas.
- Lock de despacho con `SET NX PX` para evitar solapamiento entre ejecuciones.
*Por qué:* el filesystem de Vercel es read-only (excepto `/tmp`, volátil); se necesita estado duradero entre invocaciones serverless. Upstash tiene capa REST (sin socket persistente), plan gratis holgado para un usuario y era el plan original.
*Alternativas descartadas:* Vercel Blob (nativo pero sin operaciones atómicas ni modelos de concurrencia — el lock del despacho se complica); archivo JSON en repo (no hay escritura y las suscripciones quedarían públicas); Turso/Postgres (más peso del necesario).

**3. Lógica de despacho en funciones puras dentro de `src/core/`, adaptadores fuera.**

- `src/core/reminder/dispatch.ts`: decidir `send | skipAlreadySent | skipRead | skipLate | reprogram` a partir de `(now, tz, subscription, ...)` — sin `web-push`, sin red, sin reloj propio (recibe `now`).
- El cálculo de fecha/hora local usa `Intl.DateTimeFormat` con la zona IANA de la suscripción — sin dependencia nueva (`@date-fns/tz` no es necesario; `Intl` cubre horario de verano).
- `web-push` y Upstash se usan solo en los route handlers (`src/app/api/push/**`), fuera de `src/core`, respetando la regla ESLint existente.
*Por qué:* la idempotencia y las omisiones son la parte con más riesgo y merecen pruebas unitarias; mantiene la frontera de pureza ya impuesta sin construir la capa completa de puertos/adaptadores que el plan original contemplaba (el resto de la app no se construyó así).

**4. Registro de suscripciones: POST upsert + PATCH + DELETE.**

- `POST`: alta/actualización por `subscription.endpoint` con `{ subscription, time, timezone }`; valida `Origin`, `https`, `HH:mm` y zona IANA.
- `PATCH`: marca `readDate` (al marcar el día como leído desde la UI) para que el despacho omita esa entrega.
- `DELETE`: elimina el registro (el `unsubscribe()` del navegador lo hace el cliente).
*Por qué:* el cliente puede re-suscribirse (navegador perdido, cambio de llave) — upsert por endpoint evita duplicados; el PATCH es la única forma en que el servidor entiende "ya leído", porque el estado de lectura vive en `localStorage` del cliente.

**5. Service Worker: `push` compone desde caché; `notificationclick` abre el día.**

- `push`: payload del servidor = `{ devotionalId, type }` (spec: el cuerpo lo compone el cliente). Lee `/data/devotionals.json` de caché (`caches.match`); si está, título con el día y cuerpo con versículo + referencia; si no, texto genérico. `showNotification` con `data: { devotionalId }`.
- `notificationclick`: enfoca la ventana existente o abre nueva y navega a `/?dia=<devotionalId>` (spec: "Clic en la notificación abre el día").
*Por qué:* los datos ya están precacheados; enviar solo el id reduce el payload y garantiza que el texto coincida con lo que el usuario verá al abrir.

**6. Sincronización al abrir y migración de usuarios existentes.**

Al iniciar, si `localStorage` dice `enabled: true`: verificar permiso → obtener o crear suscripción → comparar `time`/`timezone` con el registro del servidor → `POST` si difieren o si no hay registro. Cubre de una vez el requisito "La suscripción se sincroniza al abrir" y la migración de quienes activaron el checkbox en la versión fachada.
*Por qué:* es el mecanismo que la spec ya define para suscripciones perdidas (caso conocido en iOS tras actualizar); reutilizarlo como puente de migración evita lógica adicional.

## Risks / Trade-offs

- [Vercel Schedules está en beta; los límites pueden cambiar] → el endpoint es agnóstico al llamador: si Schedules cambia, un cron externo con el mismo `CRON_SECRET` lo reemplaza sin tocar código.
- [Aviso entre 0 y ~30 min de la hora elegida (jitter de Hobby)] → dentro de la tolerancia de la spec (<2h); el mensaje de confirmación del UI debe comunicar que la entrega es "cerca de" la hora elegida.
- [iOS exige PWA en pantalla de inicio y iOS 16.4+; las suscripciones se pierden en algunas actualizaciones] → la sincronización al abrir las recrea; el README debe documentar el requisito de iOS.
- [Upstash cae o se agota la cuota gratis] → el despacho reintenta en el siguiente ciclo (spec) y no hay doble entrega; una sola suscripción no se acerca a los límites.
- [Usuarios con `enabled: true` sin suscripción real] → la sincronización al abrir los suscribe en la próxima apertura (Decisión 6); nadie queda en estado activo inconsistente.
- [Verificación en dispositivo real quedó pendiente la vez anterior] → tareas explícitas de verificación en Android e iOS como criterio de cierre del cambio.
- [Rotación de `CRON_SECRET`] → Vercel envía el valor por deployment y la ruta lee el del mismo deployment; no se necesita aceptar dos secretos a la vez.

## Migration Plan

1. **Preparación (usuario):** crear cuenta Upstash, generar llaves VAPID (`npx web-push generate-vapid-keys`), definir las 7 variables de entorno en Vercel y localmente.
2. **Deploy:** al desplegar, Vercel aplica el schedule de `vercel.json`; el endpoint queda inerte hasta que exista al menos una suscripción (sin suscripciones, `dispatch` responde 200 sin enviar).
3. **Activación por usuario:** la próxima apertura con el checkbox activo crea la suscripción y el siguiente ciclo `*/15` puede entregar.
4. **Rollback:** revertir el commit (el schedule desaparece en el deploy; las suscripciones en Upstash quedan dormidas sin efecto secundario). No hay datos que migrar ni destruir.

## Open Questions

Ninguna que afecte specs, enfoque ni desglose de tareas.
