# Design

## Context

El repositorio es la plantilla de `create-next-app` con Next 16.4 (`cacheComponents`, `partialPrefetching`, Turbopack), React 19.3 y Tailwind 4. Ya existen: `especificaciones-chequera.md` (v2) como fuente de requisitos, el PDF de 192 páginas con 366 entradas verificadas, los íconos y pantallas de inicio generados, y OpenSpec inicializado sin specs previas. El análisis de viabilidad confirmó dos incompatibilidades que este diseño debe resolver: `@serwist/turbopack` no sirve con `cacheComponents`, y el Cron Jobs clásico de Vercel solo corre una vez al día en Hobby. Ver proposal.md para la motivación y `specs/` para los requisitos.

## Goals / Non-Goals

**Goals:**
- Aplicación instalable y offline-first que lee el devocional del día.
- Recordatorio diario con Web Push que funciona igual en local y en Vercel Hobby.
- Núcleo de dominio puro, comprobable con Vitest sin navegador ni servidor.
- Despliegue en Vercel Hobby sin coste (Upstash en su plan gratuito).

**Non-Goals:**
- Cuentas de usuario, sincronización entre dispositivos ni índice de calendario.
- Precisión de minuto a minuto en Hobby (queda limitada a ~15-30 min por diseño de la plataforma).
- Notificaciones locales con Notification Triggers o Periodic Background Sync.

## Decisions

**1. Extracción con `pdftotext` en lugar de anydoc.**
Se probó anydoc: mezcla encabezados, negritas y referencias partidas, y funde los párrafos de cada día. `pdftotext -layout` sí conserva los líneas y saltos de página, y con un parser de ~150 líneas ya se detectaron las 366 entradas sin duplicados. El parser vive en `scripts/build-devotionals.ts` con `data/overrides.json` para los casos rotos (referencias incompletas en `09-08`, `11-06`, etc.). Alternativa descartada: depender de anydoc en cada regeneración.

**2. Datos versionados en `public/`, fuera del build de Vercel.**
`devotionals.json` (~0.5 MB) se genera una vez y se versiona, así que Vercel no necesita poppler y el Service Worker puede precachearlo con `CacheFirst`. Alternativa descartada: importarlo al bundle, que lo sacaría del control del Service Worker.

**3. Serwist en modo configurador, no `@serwist/turbopack`.**
`createSerwistRoute()` de `@serwist/turbopack@9.5.13` exporta `dynamic`, `dynamicParams` y `revalidate`, y Next 16 con `cacheComponents: true` prohíbe esas exportaciones. El modo configurador (`@serwist/next` + `@serwist/cli`) genera `public/sw.js` como paso externo después de `next build`, es independiente del bundler y precachea solo rutas prerenderizadas. **Riesgo a validar en la Fase 0:** confirmar que Vercel publica el `public/sw.js` escrito después de `next build`.

**4. Un único endpoint de despacho, con dos disparadores.**
`POST /api/push/dispatch` es idempotente y protegido con `Bearer CRON_SECRET`; lo llaman el programador local (`instrumentation.ts`, cada 60 s) y el Vercel Schedule `*/15 * * * *` de `vercel.json`. Si Schedules (beta) falla, un cron externo llama al mismo endpoint sin cambiar código. Alternativa descartada: Vercel Schedules dinámico por usuario, que requiere Vercel Queues y cuotas de Hobby que se agotan.

**5. Cliente cobra la fecha; el servidor solo calcula `nextDueAt`.**
Con `cacheComponents`, `new Date()` no debe usarse al prerenderizar, y el servidor ignora la zona horaria del cliente. Por eso `/` se sirve estática y el cliente resuelve el día. El servidor guarda `time` + `timezone` IANA del dispositivo y calcula `nextDueAt` en UTC con `ReminderSchedule` (puro, probado con zonas con y sin horario de verano).

**6. `localStorage` para todo el estado del cliente.**
Progreso por año, preferencias de apariencia y ajustes del recordatorio usan claves versionadas. `permission` no se persiste: se lee de `Notification.permission` en cada uso. Alternativa descartada: IndexedDB, innecesaria para unos pocos KB y sin pagos.

**7. Almacén de suscripciones según el entorno (`src/composition/server.ts`).**
Con `UPSTASH_REDIS_REST_URL` presente se usa Upstash (ZSET por `nextDueAt` + hash por suscripción + lock `SET NX EX`); sin ellas, `FileSubscriptionStore` en `.data/` para local. En Vercel, si faltan las credenciales, se lanza un error claro al arrancar en vez de escribir en el sistema de archivos de solo lectura.

**8. El servidor no conoce el contenido.**
El push solo lleva `{ kind, devotionalId }`. El Service Worker compone título y cuerpo desde `devotionals.json` ya precacheado y abre `/?dia=MM-DD`. Mantiene los payloads pequeños y desacopla el servidor de los datos.

**9. Omitir en lugar de enviar tarde o repetido.**
Se reprograma sin enviar si `lastSentLocalDate` o `skipLocalDate` coinciden con la fecha local, o si la hora lleva más de 2 h vencida; el lock de Redis y la idempotencia cubren ejecuciones solapadas. Esto traduce la imprecisión de Hobby (hasta ~30 min) en un comportamiento predecible: a la hora elegida o en el siguiente día, nunca avisos de más.

**10. Capacidad `daily-reading` conserva la fecha, `reading-appearance` la apariencia.**
Separadas para que los requisitos de tipografía/tema no dependan del lector. El resto de capacidades sigue el orden de los RF de la especificación: datos, lectura, progreso, apariencia, recordatorio, service worker, instalación.

## Risks / Trade-offs

- [El modo configurador de Serwist se ejecute después del build y Vercel no lo publique] → Spike de la Fase 0 desplegando y comprobando `/sw.js` en producción; si falla, se recurre a un paso de build en Vercel que copie el archivo antes de publicar.
- [Vercel Schedules está en beta y sus límites pueden cambiar] → El endpoint no depende de quién lo llame; queda documentado el cron externo con `CRON_SECRET` como plan B.
- [Hobby entrega con hasta ~15-30 min de retraso] → Selector de hora en pasos de 15 min y aviso explícito en `/settings`.
- [El parser no cubra algún caso del PDF] → Validación que falla el script, `overrides.json` y pruebas con los casos irregulares conocidos.
- [iOS no recibe push sin la PWA instalada] → Instrucción explícita de instalación en iOS fuera del modo standalone.
- [Upstash en plan gratuito puede agotar el límite de comandos] → ~4 comandos por ejecución × 96 al día ≈ 3,840 al mes; medirlo y, si acota, agrupar operaciones en el despacho.

## Migration Plan

1. Fase 0: spikes de Serwist + `cacheComponents`, Vercel Schedules en Hobby y push de punta a punta en Android e iOS instalado. Si alguno falla, se ajusta design.md antes de seguir.
2. Fases 1-3: reestructura a `src/`, datos y núcleo; nada visible para el usuario.
3. Fases 4-5: lector y PWA; despliegue temprano para validar instalación y offline.
4. Fase 6-7: push y despliegue final con variables de entorno.

Rollback: cada fase es un commit desechable; el despliegue de Vercel permite volver al despliegue anterior sin tocar datos.

## Open Questions

- Ninguna abierta. Los dos puntos que podían cambiar el alcance (derechos de la traducción, plan de Hobby) ya están resueltos a favor según el usuario.
