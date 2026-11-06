# Tasks

## 1. Reestructura y base

- [x] 1.1 Mover `app/` a `src/app/`, actualizar el alias `@/*` a `./src/*` en `tsconfig.json` y mover `chequera-spurgeon.pdf` a `data/raw/`; verificar con `npx tsc --noEmit` sin errores y `npm run dev` sirviendo la raíz.
- [x] 1.2 Configurar ESLint con `no-restricted-imports` que prohíba `react`, `next`, `web-push`, `@upstash/*` y APIs del navegador en `src/core/**`; verificar que `npx eslint .` pasa y que una importación prohibida de prueba reporta el error.
- [x] 1.3 Instalar Vitest y añadir el script `test`; verificar con `npm test` ejecutando un caso de humo.
- [x] 1.4 Poner `<html lang="es">`, título y descripción de la app en `src/app/layout.tsx`; verificar que el documento servido declara `lang="es"`.

## 2. Datos del PDF

- [x] 2.1 Escribir `scripts/build-devotionals.ts` que ejecute `pdftotext -layout`, corte por página para `pdfPage`, descarte prefacio y doxología, elimine encabezados y numeración, y separe `verse`/`reference` tolerando faltas de comillas y referencias partidas; verificar con `npm run data:build` generando un JSON provisional.
- [x] 2.2 Añadir la reconstrucción de párrafos (corte solo si la línea termina en puntuación y la primera palabra de la siguiente cabía) y la normalización de `reference`; verificar con `node --test` o Vitest sobre los casos `01-01`, `03-22`, `04-05`, `08-18`, `09-08`, `11-06`, `12-24`.
- [x] 2.3 Crear `data/overrides.json` y su aplicación por `id`, incluida la detección de ids desconocidos; verificar con una prueba que aplica un override y otra que falla con id inválido.
- [x] 2.4 Añadir la validación obligatoria (366 entradas únicas, `02-29` presente, fechas válidas, `verse`/`reference` no vacíos, ≥1 párrafo, sin restos de encabezados) con salida de advertencias por id; verificar ejecutando el script sobre el PDF completo y comprobando que termina con código 0.
- [x] 2.5 Generar y versionar `public/data/devotionals.json`; verificar con `python3 -c` o script equivalente que hay 366 entradas y que la primera y última son `01-01` y `12-31`.

## 3. Núcleo de dominio

- [x] 3.1 Implementar `DevotionalId` (de fecha, `next`/`previous` con salto de `02-29` en años no bisiestos, límites de año) y su prueba en Vitest; verificar con `npm test`.
- [ ] 3.2 Implementar las entidades `Devotional`, `ReaderPreferences`, `ReadingRecord` y `ReadingProgress` con `markRead`/`unmarkRead`/`isRead`/`stats` por año; verificar con pruebas de avance, racha y total 365/366.
- [ ] 3.3 Implementar `ReminderSchedule` (`nextOccurrence`, `localDateOf`) con `@date-fns/tz`; verificar con pruebas en `America/Lima` y `America/New_York` alrededor del cambio de horario de verano.
- [ ] 3.4 Declarar los puertos `DevotionalRepository`, `ReadingProgressRepository`, `PreferencesRepository`, `ReminderSettingsRepository`, `PushRegistrationGateway`, `SubscriptionStore`, `PushSender` y `Clock`; verificar con `npx tsc --noEmit`.
- [ ] 3.5 Implementar los casos de uso de lectura (`GetDevotionalForDate`, `GetAdjacentDevotional`, `ToggleReadStatus`, `GetReadingStats`), preferencias, recordatorio de cliente y push del servidor (`RegisterSubscription`, `RemoveSubscription`, `SkipTodayReminder`, `DispatchDueReminders`, `SendTestReminder`); verificar con pruebas unitarias usando adaptadores falsos, incluida la idempotencia de `DispatchDueReminders`.

## 4. Adaptadores de cliente y lector

- [ ] 4.1 Implementar `StaticJsonDevotionalRepository` y los adaptadores `localStorage` (progreso por año, preferencias, ajustes de recordatorio) con claves versionadas; verificar con pruebas sobre un `localStorage` simulado.
- [ ] 4.2 Construir `src/composition/client.ts` y la página `/` con shell estático y resolución de fecha en el cliente, aceptando `/?dia=MM-DD` dentro de `<Suspense>`; verificar con `npm run build` y abriendo `/` y `/?dia=11-05`.
- [x] 4.3 Implementar navegación anterior/siguiente dentro del año, salto de `02-29`, botón "Hoy" y refresco en `visibilitychange`; verificar con pruebas del componente o revisando el comportamiento en navegador.
- [ ] 4.4 Implementar `DevotionalCard` (fecha, versículo, referencia, traducción opcional, párrafos), `ReadToggle` con `aria-pressed` y `ReadingStats`; verificar con `npm run build` y que el marcado como leído persiste tras recargar.
- [ ] 4.5 Al marcar como leído el día actual con recordatorio activo, llamar `PATCH /api/push/subscriptions` sin bloquear la UI; verificar con la llamada observada en la red y que un fallo no rompe la interfaz.

## 5. Apariencia de lectura

- [x] 5.1 Implementar `ReaderSettings` con cuatro tamaños y los tres temas, persistidos en `localStorage` y aplicados por clase; verificar el cambio de tema en caliente en el navegador.
- [ ] 5.2 Añadir la variante `dark` de Tailwind 4 y el script anti-flash en `layout.tsx`; verificar abriendo la app en oscuro por primera vez sin destello claro.

## 6. PWA

- [x] 6.1 Crear `src/app/manifest.ts` con nombre, `lang`, `start_url`, `scope`, `display`, colores `#1e2a4a` y los íconos existentes en `public/icons/`; verificar con `npm run build` que se genera el manifiesto con esos valores.
- [ ] 6.2 Configurar Serwist en modo configurador (`serwist.config.js`, scripts `dev` y `build`, `.gitignore` con `public/sw*`); verificar que `npm run build` genera `public/sw.js` con las entradas precacheadas.
- [ ] 6.3 Escribir `sw.ts` con precache del shell y de `/data/devotionals.json` en `CacheFirst`, fallback a `/~offline` y cabecera `Cache-Control` sin caché en `/sw.js`; verificar abriendo la app una vez y navegando sin conexión.
- [x] 6.4 Crear `src/app/~offline/page.tsx`; verificar navegando a una ruta desconocida en modo offline.
- [ ] 6.5 Añadir `InstallPrompt` con `beforeinstallprompt`, descarte de 30 días e indicación de instalación en iOS, más `apple-touch-startup-image` desde `public/splash/`; verificar en un navegador con soporte y en un dispositivo iOS.

## 7. Recordatorio (cliente)

- [ ] 7.1 Implementar `BrowserPushRegistrationGateway` (soporte, permiso, suscripción con la llave VAPID) y su prueba con mocks; verificar con `npm test`.
- [ ] 7.2 Implementar `ReminderForm` en `/settings`: activación con paso de 15 min, alta/baja de suscripción, cambio de hora, permiso denegado y botón de notificación de prueba; verificar el flujo completo en navegador apuntando al endpoint local.
- [ ] 7.3 Implementar `SyncReminder` al iniciar (suscripción perdida o zona horaria cambiada); verificar cambiando la zona horaria del sistema y comprobando el reenvío del registro.

## 8. Recordatorio (servidor)

- [ ] 8.1 Implementar `WebPushSender` con `web-push` y las llaves de entorno; verificar generando llaves VAPID y enviando un push de prueba manual.
- [ ] 8.2 Implementar `FileSubscriptionStore` (`.data/`, en `.gitignore`) y `UpstashSubscriptionStore` (hash + ZSET + lock); verificar con pruebas sobre ambos contra sus dobles de prueba.
- [ ] 8.3 Implementar `POST/PATCH/DELETE /api/push/subscriptions` con validación de `Origin`, endpoint `https`, `HH:mm`, zona IANA y límite de tamaño; verificar con `curl` y casos inválidos.
- [ ] 8.4 Implementar `POST /api/push/dispatch` con `Bearer CRON_SECRET` y `DispatchDueReminders` completo (lock, omisión por ya enviado/leído/tardío, envío, manejo de respuestas 404/410/429/5xx y reprogramación); verificar con pruebas del caso de uso y con dos llamadas seguidas sin doble envío.
- [ ] 8.5 Implementar `POST /api/push/test`; verificar recibiendo la notificación de prueba.
- [ ] 8.6 Arrancar el programador local desde `src/instrumentation.ts` (fuera de Vercel, cada 60 s) y añadir `vercel.json` con el schedule `*/15 * * * *`; verificar en local que el recordatorio llega a la hora elegida y en Vercel que la ruta recibe `Authorization: Bearer`.
- [ ] 8.7 Documentar la configuración (scripts, variables de entorno, generación de llaves VAPID, túnel HTTPS para probar en LAN) en `README.md`; verificar siguiendo el documento paso a paso en una terminal limpia.

## 9. Verificación e integración

- [x] 9.1 Ejecutar `npm test && npx tsc --noEmit && npx eslint . && npm run build` y comprobar que todo pasa; verificar con la salida de los cuatro comandos.
- [ ] 9.2 Registrar los requisitos de `specs/` y comprobar cobertura: 366 días, offline, instalación, recordatorio completo; verificar recorriendo cada escenario a mano en un dispositivo real (Android e iOS instalado).
- [x] 9.3 Validar el cambio con `openspec validate --all` y comprobar que las specs y el cambio son válidos.

## Workflow follow-up

- Archivar el cambio con `openspec archive` después de la revisión del proyecto.
- Verificar el resultado archivado.
