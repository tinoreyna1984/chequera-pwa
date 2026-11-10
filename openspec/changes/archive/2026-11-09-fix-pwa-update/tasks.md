# Tasks

## 1. Ruta de actualización del Service Worker

- [x] 1.1 Reescribir `public/sw.js`: caché `chequera-shell-v2`, `self.skipWaiting()` en `install`, purga en `activate` de toda caché distinta de la actual, y en `fetch` estrategia `network-first` para requests `mode === "navigate"` (respaldo: caché del shell y luego `/~offline`) manteniendo `cache-first` para el resto; verificar con `node --check public/sw.js` sin errores y con `grep -c "chequera-shell-v2\|skipWaiting\|navigate" public/sw.js` confirmando las tres piezas
- [x] 1.2 Agregar `headers()` en `next.config.ts` que sirva `/sw.js` con `Cache-Control: no-cache, no-store, must-revalidate`; verificar con `npm run build` y `curl -sI http://localhost:3000/sw.js | grep -i cache-control` mostrando el header exacto

## 2. theme-color dinámico

- [x] 2.1 Extender el script pre-paint de `layout.tsx` para crear (si no existe) y actualizar `<meta name="theme-color">` con la superficie del tema resuelto (`#fffdf8` claro / `#171717` oscuro), también en su listener de `matchMedia`; verificar que el HTML prerenderizado NO contiene el tag (`grep -c "theme-color" .next/server/app/index.html` = 0) y que en el navegador el atributo `content` muestra el valor correcto según el tema
- [x] 2.2 Sincronizar el meta desde `AppearanceSettings` al cambiar el selector de tema; verificar en el navegador que al alternar Oscuro/Claro el atributo `content` cambia entre `#171717` y `#fffdf8` sin recargar, y que `npm run lint` pasa

## 3. Verificación integrada

- [x] 3.1 Ejecutar `npm run lint && npm test && npm run build` sin errores
- [x] 3.2 Verificar que los valores del meta coinciden literalmente con los tokens `surface` de `src/app/globals.css` (`#fffdf8` y `#171717`); si la paleta cambia, ambos deben cambiar juntos
- [x] 3.3 Recorrer en navegador con DevTools (Application > Service Workers) los scenarios locales: cambiar `public/sw.js` y recargar → el SW nuevo instala y purga la caché v1 (Caché Storage sin `chequera-shell-v1`); con "Offline" marcado, navegar → se sirve el shell cacheado o `/~offline`; cambiar tema → la barra de estado/probe del navegador refleja el `theme-color`

## Workflow follow-up

- Tras desplegar: abrir la PWA instalada en el dispositivo (dos veces si hace falta) y confirmar el scenario "Nueva versión publicada"; verificar la barra de estado oscura en Android con tema oscuro.
- Archivar el cambio cuando la revisión del proyecto lo satisfaga (`openspec archive fix-pwa-update`).
- Verificar el resultado archivado.
