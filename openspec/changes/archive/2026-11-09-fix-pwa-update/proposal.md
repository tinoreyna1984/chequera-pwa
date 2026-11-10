# Proposal

## Why

El modo oscuro quedó congelado en la versión anterior en el móvil/PWA: el Service Worker sirve todo con `cache-first` y nunca se actualiza (`sw.js` byte-idéntico desde el primer commit, `activate` no purga cachés viejas), así que ningún despliegue llega a los dispositivos que ya instalaron la app. Además, la barra de estado de Android no sigue el tema porque no existe `<meta name="theme-color">` dinámico.

## What Changes

- **Ruta de actualización del Service Worker**: bump de versión de la caché del shell, purga de cachés obsoletas en `activate`, estrategia `network-first` para navegaciones (con respaldo en caché para offline y `/~offline`), `skipWaiting` para tomar control sin esperar el cierre de pestañas, y header `Cache-Control: no-cache, no-store, must-revalidate` en `/sw.js` (ya exigido por la spec `service-worker`, hoy incumplido).
- **`theme-color` dinámico**: el script pre-paint crea y actualiza `<meta name="theme-color">` según el tema resuelto (`#fffdf8` en claro, `#171717` en oscuro), lo actualiza al cambiar la preferencia del usuario y al cambiar la preferencia del sistema. React no renderiza el tag, por lo que no hay riesgo de hydration mismatch.
- **Fuera de alcance**: los colores estáticos del manifest (`theme_color: #1e2a4a`, `background_color: #fffdf8`) y las splash; la capability `app-installation` no se modifica.

## Capabilities

### New Capabilities

<!-- ninguna -->

### Modified Capabilities

- `service-worker`: se agrega un requisito de actualización del shell tras un despliegue — hoy ningún requisito cubre la renovación del contenido cacheado, lo que permitió que la app quedara congelada en una versión antigua sin que ningún escenario de la spec lo detectara.
- `reading-appearance`: el requisito del tema gana un scenario sobre la barra de estado del dispositivo, que SHALL seguir el tema resuelto de la app.

## Impact

- Archivos: `public/sw.js`, `next.config.ts` (headers), `src/app/layout.tsx` (meta theme-color inicial), `src/app/AppearanceSettings.tsx` (actualización al cambiar tema).
- Sin dependencias nuevas, sin cambios en el esquema de `localStorage` ni en el manifest.
- Migración en dispositivos existentes: al desplegar, `sw.js` cambia de bytes y la próxima apertura de la PWA instala la versión nueva y purga la caché anterior; la primera apertura posterior al despliegue puede seguir mostrando la versión vieja (el SW anterior aún controla).
- Límite conocido: `theme-color` es respetado por Android Chrome; iOS lo ignora (las superficies de iOS quedan como están).
