This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Primeros pasos

Comienza ejecutando los comandos de npm:

```bash
cd chequera-pwa
npm i
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) desde tu navegador para ver el resultado.

El sitio en línea es [aquí](https://chequera-pwa.vercel.app)

## Recordatorio diario: preparación

El recordatorio se entrega con Web Push desde el servidor, así que necesita llaves, un almacén de suscripciones y variables de entorno.

### 1. Llaves VAPID

```bash
npx web-push generate-vapid-keys
```

El comando imprime dos bloques: `Public Key` y `Private Key` (opcionalmente con `Subject`, un `mailto:` que sirve de contacto). Guarda los tres valores; se usan en `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`.

### 2. Base de datos en Upstash

1. Crea una cuenta en [upstash.com](https://upstash.com) (plan gratis) y una base Redis (`Global` o `US East`; el plan gratis es suficiente para una suscripción).
2. Copia el **REST URL** y el **REST Token** de la página de la base → `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.

### 3. Variables de entorno

Crea `.env.local` en la raíz (desarrollo) y define las mismas 7 en Vercel → *Project Settings → Environment Variables* (producción):

| Variable | Propósito |
| --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Llave pública VAPID; el navegador la usa al crear la suscripción (`pushManager.subscribe`) |
| `VAPID_PRIVATE_KEY` | Llave privada VAPID; `web-push` la usa para firmar cada envío |
| `VAPID_SUBJECT` | Contacto del emisor (`mailto:...`) que exige la especificación VAPID |
| `CRON_SECRET` | Secreto que Vercel Schedules envía en `Authorization: Bearer`; sin él el dispatch responde 401 |
| `UPSTASH_REDIS_REST_URL` | URL REST de Upstash para leer y escribir las suscripciones |
| `UPSTASH_REDIS_REST_TOKEN` | Token de acceso a esa base |
| `NEXT_PUBLIC_REMINDER_STEP_MINUTES` | Paso del selector de hora en minutos (15) |

Sin estas variables la app corre normalmente, pero el recordatorio no se registra ni se envía.

### 4. Despacho del recordatorio

En Vercel, el schedule `push-dispatch` de `vercel.json` invoca `POST /api/push/dispatch` cada 15 minutos (Hobby limita a ese mínimo por el jitter de 15 min) con la cabecera `Authorization: Bearer $CRON_SECRET`. En desarrollo no hay scheduler: dispara el mismo endpoint a mano.

```bash
# el valor de CRON_SECRET está en .env.local; expórtalo en la terminal
export CRON_SECRET=...
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/push/dispatch
```

- Sin cabecera o con secreto distinto responde `401`.
- Con `200` devuelve un reporte: `{ "ok": true, "evaluated": 1, "sent": 1, "removed": 0, "retried": 0, "reprogrammed": 0, "skipped": 0 }`.
- El despacho es idempotente: una segunda llamada el mismo día no repite la notificación.
- En producción el mismo curl aplica contra `https://chequera-pwa.vercel.app/api/push/dispatch` (también puedes ejecutar el schedule desde el dashboard de Vercel → Schedules → *Run*).
