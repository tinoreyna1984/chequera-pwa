# Tasks

## 1. Preparación

- [x] 1.1 Instalar `web-push` y `@upstash/redis` como dependencias; verificar con `npm ls web-push @upstash/redis` mostrando ambas y `npm test` pasando sin regresiones
- [x] 1.2 Documentar en `README.md` la preparación: generación de llaves VAPID (`npx web-push generate-vapid-keys`), creación de la base en Upstash y las 7 variables de entorno con su propósito; verificar ejecutando cada comando del documento en una terminal limpia

## 2. Store y lógica de despacho

- [x] 2.1 Implementar el `UpstashSubscriptionStore` (upsert por `endpoint`, consulta de candidatas por hora, `readDate`/`lastSentDate`/`failCount`, lock `SET NX PX`) con pruebas usando `fetch` falso; verificar con `npm test` que upsert, borrado, flags y lock responden correctamente y que un error de red se propaga
- [x] 2.2 Implementar la función pura de despacho en `src/core/reminder/dispatch.ts` (recibe `now` y devuelve enviar/omitir/reprogramar según ya enviado, marcado como leído, >2h vencida y hora local IANA) con pruebas en `America/Lima` y `America/New_York` alrededor del cambio de horario de verano; verificar con `npm test` que dos evaluaciones del mismo día devuelven enviar solo la primera

## 3. Endpoints del servidor

- [x] 3.1 Implementar `POST/PATCH/DELETE /api/push/subscriptions` con validación de `Origin`, endpoint `https`, `HH:mm`, zona IANA y límite de tamaño; verificar con `curl` que un alta válida responde 201/200 con upsert idempotente y que `Origin` inválido, hora malformada o zona desconocida responden 400/403
- [x] 3.2 Implementar `POST /api/push/dispatch` con verificación `Bearer CRON_SECRET` (401 sin cabecera correcta), lock, llamada a la lógica del punto 2.2, envío con `web-push`, y manejo de 404/410 (borrar suscripción), 429/5xx (reintento, `failCount` y reprogramación tras 5 fallos); verificar con pruebas del caso de uso usando adaptadores falsos que dos llamadas consecutivas en el mismo día producen un solo envío
- [x] 3.3 Agregar `vercel.json` con el schedule `push-dispatch` (`*/15 * * * *`, `path: /api/push/dispatch`, `requestMethod: POST`); verificar que el JSON es válido (`node -e "JSON.parse(...)"`) y documentar en el README el disparo local con `curl -X POST -H "Authorization: Bearer $CRON_SECRET"`

## 4. Service Worker

- [x] 4.1 Agregar a `public/sw.js` el handler `push` (lee el payload `{devotionalId, type}`, compone título y cuerpo desde `/data/devotionals.json` en caché con texto genérico de respaldo y llama `showNotification` con `data`) y el handler `notificationclick` (enfoca la ventana existente o abre nueva en `/?dia=`); verificar con `node --check public/sw.js` sin errores y con `grep -c "push\|notificationclick" public/sw.js` confirmando ambos handlers

## 5. Cliente

- [x] 5.1 Reescribir `configureNotifications` en `src/app/page.tsx`: al activar, permiso → `pushManager.subscribe()` con la llave VAPID → `POST /api/push/subscriptions`; al desactivar, `unsubscribe()` → `DELETE`; actualizar los mensajes para reflejar el estado real (registro con el servidor, entrega "cerca de" la hora elegida); verificar en navegador con el endpoint local que alta y baja quedan registradas y que un fallo de red muestra error sin dejar el checkbox en estado activo inconsistente
- [x] 5.2 Llamar `PATCH /api/push/subscriptions` al marcar el día actual como leído teniendo el recordatorio activo, sin bloquear la UI; verificar en DevTools (Network) que la llamada se emite y que simular su fallo no rompe la interfaz
- [x] 5.3 Implementar la sincronización al abrir: con `enabled: true` en `localStorage`, verificar permiso, crear la suscripción si no existe y volver a registrar si difieren la hora o la zona horaria; verificar en navegador que cambiando la hora elegida en otro contexto o borrando la suscripción del servidor, la reapertura emite el `POST` de re-registro

## 6. Integración

- [x] 6.1 Ejecutar `npm run lint && npm test && npm run build` sin errores
- [x] 6.2 Recorrer el flujo completo localmente: con llaves VAPID y Upstash reales en `.env.local`, activar el recordatorio con la hora del próximo cuarto de hora, disparar `curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/push/dispatch` y confirmar que aparece la notificación con el texto del día en el navegador y que al hacer clic se abre `/?dia=` correspondiente; una segunda llamada seguida no repite la notificación
- [ ] 6.3 Recorrer en dispositivo real los scenarios de la spec `daily-reminder`: activación con permiso, entrega cerca de la hora elegida, clic que abre el día, desactivación que detiene los envíos y re-registro al reabrir (Android con la PWA instalada obligatorio; iOS 16.4+ con la PWA en la pantalla de inicio si hay dispositivo disponible)

## Workflow follow-up

- Preparar producción: cuenta Upstash, llaves VAPID y variables de entorno en Vercel; desplegar y confirmar en el panel de Schedules que `push-dispatch` corre con 2xx.
- Tras desplegar, reabrir la PWA en el dispositivo para que los usuarios existentes con el checkbox activo se suscriban y confirmar una entrega real.
- Archivar el cambio cuando la revisión del proyecto lo satisfaga (`openspec archive build-daily-reminder`).
- Verificar el resultado archivado.
