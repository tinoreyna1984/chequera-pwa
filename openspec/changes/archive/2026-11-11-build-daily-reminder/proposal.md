# Proposal

## Why

El recordatorio diario es una fachada: el UI pide permiso y guarda `{enabled, time}` en `localStorage`, pero nunca crea una suscripción Web Push ni registra nada en un servidor — no hay endpoint, ni almacén, ni cron, ni handlers `push`/`notificationclick`. La cadena quedó sin construir cuando `2026-11-06-build-chequera-pwa` se archivó con las secciones 7 (cliente) y 8 (servidor) sin completar. En la plataforma web no existe una alarma local que dispare con la app cerrada, así que sin Web Push desde servidor el recordatorio no puede funcionar ni en la web ni como PWA.

## What Changes

- **Suscripción en el cliente**: al activar el recordatorio, `pushManager.subscribe()` con la llave pública VAPID y registro en el servidor (`POST /api/push/subscriptions` con la hora y la zona horaria del dispositivo); al desactivar, `unsubscribe()` y `DELETE`; al marcar el día como leído, `PATCH` para que el servidor omita esa entrega.
- **Sincronización al abrir**: con el recordatorio activo, la app verifica al iniciar si la suscripción o la zona horaria cambiaron y vuelve a registrar en caso afirmativo (cubre suscripciones perdidas, p. ej. en iOS tras actualizar).
- **Almacén de suscripciones**: store duradero en Upstash Redis (hash + ZSET + lock) — el filesystem de Vercel es read-only y no sirve para estado.
- **Despacho programado**: `POST /api/push/dispatch` autenticado con `Bearer CRON_SECRET`, invocado por Vercel Schedules (`*/15 * * * *`, target `path` con `POST`); en Hobby permite cada 15 min con jitter de 15 min y envía el secret en la cabecera. Despacho idempotente: omisión por día ya enviado, día marcado como leído o entrega con más de 2 horas vencida; limpieza de suscripciones caducas (404/410); reintento ante errores temporales y reprogramación al día siguiente tras 5 fallos.
- **Envío con `web-push` (VAPID)** hacia FCM/APNs, respetando la zona horaria IANA de cada suscripción (incluye horario de verano).
- **Handlers en el Service Worker**: evento `push` que compone título y cuerpo desde `/data/devotionals.json` en caché (texto genérico si no hay datos) y `notificationclick` que abre `/?dia=` con el día correspondiente.
- **Fuera de alcance**: sin cambios de spec — la capability `daily-reminder` ya define el comportamiento completo (8 requisitos); tampoco se agrega endpoint de notificación de prueba.

## Capabilities

### New Capabilities

<!-- ninguna -->

### Modified Capabilities

<!-- ninguna: la spec `daily-reminder` ya cubre el comportamiento; este cambio solo lo implementa -->

## Impact

- **Archivos**: `src/app/page.tsx` (suscripción, desactivación, PATCH al marcar leído, sincronización al abrir), nuevos `src/app/api/push/subscriptions/route.ts` y `src/app/api/push/dispatch/route.ts`, `public/sw.js` (handlers `push` y `notificationclick`), `vercel.json` (schedule), `README.md` (documentación de configuración).
- **Dependencias nuevas**: `web-push`, `@upstash/redis`.
- **Variables de entorno**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_REMINDER_STEP_MINUTES` (15).
- **Prerrequisitos externos**: cuenta Upstash (plan gratis) y llaves VAPID generadas con `npx web-push generate-vapid-keys`.
- **Migración de usuarios existentes**: quienes ya activaron el checkbox (solo localStorage) se suscriben automáticamente en la próxima apertura mediante la sincronización.
- **Verificación**: requiere dispositivos reales (Android; iOS 16.4+ con la PWA agregada a la pantalla de inicio) — era pendiente explícito del cambio anterior (tarea 9.2 sin marcar).
- **Riesgo operativo**: Vercel Schedules está en beta y sus límites pueden cambiar; en Hobby las ~2,880 ejecuciones/mes necesarias quedan dentro de las 5,000 incluidas.
