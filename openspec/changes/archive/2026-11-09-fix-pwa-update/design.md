# Design

## Context

Ver `proposal.md` (Why) para la motivación. Contexto técnico relevante:

- `public/sw.js` (12 líneas): caché `chequera-shell-v1` sin versión automática, `install` con `cache.addAll` de un `PRECACHE` fijo, `activate` solo hace `clients.claim()`, y `fetch` responde `caches.match()` global (busca en todas las cachés) con fallback de red y `cache.addAll` de cualquier respuesta — es decir, cache-first para todo, sin purga jamás.
- `sw.js` no ha cambiado bytes desde el commit inicial, por lo que en dispositivos ya instalados el navegador no detecta actualización y `install` no vuelve a ejecutarse.
- `/sw.js` se sirve con `Cache-Control: public, max-age=0, must-revalidate` (default de Vercel); `next.config.ts` no declara `headers()`.
- `layout.tsx` ya tiene el script pre-paint que resuelve el tema (clase `.dark` + `data-reader-size`) y escucha `matchMedia`; `AppearanceSettings` aplica cambios de tema en un effect.
- No existe `<meta name="theme-color">` en el documento; el manifest declara `theme_color: #1e2a4a` y `background_color: #fffdf8` (fuera de alcance).
- `/data/devotionals.json` no se fetcha en runtime: `page.tsx` lo importa a build time y va empaquetado en JS con hash.
- Specs de referencia: `openspec/changes/fix-pwa-update/specs/`.

## Goals / Non-Goals

**Goals:**

- Que cualquier despliegue llegue a un dispositivo con la PWA instalada en la próxima apertura.
- Que las cachés de versiones anteriores queden eliminadas al actualizar.
- Que la app siga funcionando sin conexión tras la actualización (shell cacheado como respaldo).
- Que la barra de estado de Android siga el tema resuelto de la app, incluidos los cambios en caliente.

**Non-Goals:**

- Colores del manifest (`theme_color`, `background_color`) y splash: fuera de alcance por decisión explícita; `app-installation` no se modifica.
- iOS: `theme-color` es ignorado por Safari/iOS, no se aborda.
- Estrategias de caché para datos en runtime: el JSON se sirve empaquetado en el build, no hay fetch que optimizar.

## Decisions

**1. Estrategia de fetch por destino de la request.**

```
  request.mode === "navigate"  ->  network-first
                                    ok: responde y actualiza la caché
                                    fallo: caché -> /~offline
  destino estático (script,     ->  cache-first (hash de contenido,
   style, image, font, manifest)     inmutable; lo de hoy)
  /data/devotionals.json        ->  cache-first (requisito de spec)
  resto                         ->  cache-first como hoy
```

*Por qué:* una navegación network-first garantiza que con red el usuario siempre vea el shell más reciente, y sin red cae al shell cacheado (scenario "Actualización sin red"). Los assets con hash de contenido no cambian de URL entre builds, así que cache-first es correcto y gratis.
*Alternativa descartada:* cache-first para navegaciones (el comportamiento actual) — es exactamente el bug: el HTML cacheado referencia los CSS/JS viejos que también están cacheados.

**2. Bump de versión + purga explícita en `activate`.**

`CACHE` pasa a `chequera-shell-v2` y `activate` ejecuta `caches.keys()` eliminando toda caché distinta de la actual antes de `clients.claim()`.

*Por qué:* el bump garantiza bytes distintos en `sw.js` (dispara el ciclo de actualización del navegador) y la purga garantiza que `caches.match()` global —que busca en todas las cachés— nunca vuelva a encontrar la v1.
*Alternativa descartada:* solo bump sin purga — con `caches.match()` global la caché vieja seguiría compitiendo; solo purga sin bump — los bytes de `sw.js` no cambian y `install` nunca se re-ejecuta. Se necesitan los dos.

**3. `self.skipWaiting()` en `install`.**

*Por qué:* sin él el SW nuevo espera a que se cierren todas las pestañas; en una PWA standalone eso equivale a cerrar y reabrir la app, retrasando la actualización una jornada completa. Con `skipWaiting` + el `clients.claim()` existente, el SW nuevo toma control en la siguiente navegación.
*Riesgo controlado:* un intercambio de SW a media sesión podría dejar assets viejos y HTML nuevos; se mitiga porque las navegaciones son network-first (la siguiente carga pinta completo el shell nuevo) y los assets son inmutables por hash.

**4. Header de `/sw.js` via `headers()` en `next.config.ts`.**

`Cache-Control: no-cache, no-store, must-revalidate` en la ruta `/sw.js`, cumpliendo el requisito existente de `service-worker` ("El archivo del Service Worker siempre se sirve fresco"). La config de headers aplica también en Vercel.
*Nota:* hoy se sirve `max-age=0, must-revalidate` — funcionalmente revalida, pero no cumple la literalidad de la spec.

**5. `theme-color` dinámico sin que React lo renderice.**

El script pre-paint de `layout.tsx` crea (si no existe) y actualiza `<meta name="theme-color">` con el color de superficie del tema resuelto (`#fffdf8` / `#171717` = valores de los tokens `surface`), lo re-actualiza en su listener de `matchMedia`, y el effect de `AppearanceSettings` lo sincroniza al cambiar el selector de tema.
*Por qué:* el tag solo lo toca JS en el DOM → cero riesgo de hydration mismatch, y el valor sigue el tema *resuelto* de la app (no la preferencia del sistema), que es lo que la spec exige ("tema resuelto").
*Alternativa descartada:* `metadata.themeColor` de Next — es estático y no puede reaccionar al selector de tema; además emitirlo desde React y mutarlo desde el script abriría la puerta a mismatch de atributos.

**6. Los valores de `theme-color` se leen de los tokens, no se inventan.**

`#fffdf8` y `#171717` son exactamente `--surface` claro/oscuro de `globals.css`. Si la paleta cambia, el script debe cambiar con ella (los tokens viven en CSS, el script en TSX — se documenta el acoplamiento en la tarea de verificación).
*Alternativa descartada:* usar `color-scheme` o leer `getComputedStyle` en el script — `getComputedStyle` no está garantizado disponible antes del primer pintado con el CSS aún cargando; el valor literal es determinista.

## Risks / Trade-offs

- [Primera apertura tras el despliegue muestra la versión vieja] → esperado: el SW anterior aún controla; el nuevo instala en background y toma control en la siguiente navegación. Comunicable como "abre la app dos veces la primera vez".
- [`skipWaiting` intercambia SW a media sesión] → mitigado por network-first en navegaciones + assets inmutables por hash (Decisión 3).
- [Cachés viejas acumuladas si alguien no recibe la actualización] → la purga corre en el `activate` de cualquier versión futura; además el bump v2 solo ocurre una vez.
- [El script de `theme-color` duplica el valor de los tokens de CSS] → dos fuentes de verdad para el color; se cubre con una tarea de verificación que compare ambos y se documenta el acoplamiento.
- [`theme-color` sin efecto en iOS] → limitación aceptada y declarada en la propuesta; iOS conserva sus superficies actuales.
- [Red-first añade latencia a la navegación] → solo el round-trip del HTML; los assets siguen cacheados. Aceptable para una app de contenido.

## Migration Plan

Despliegue único, sin datos que migrar:

1. Merge + deploy (Vercel publica `sw.js` con bytes nuevos y el header).
2. En el dispositivo con la PWA: la próxima apertura detecta `sw.js` nuevo → `install` precachea el shell nuevo → `activate` purga `v1` → control inmediato (`skipWaiting` + `clients.claim`).
3. Si el usuario tenía la app abierta, la siguiente navegación ya sirve el shell nuevo (network-first).
4. Rollback = revertir el commit; los dispositivos se actualizan por el mismo camino (el revert también cambia bytes de `sw.js`).

## Open Questions

Ninguna que afecte specs, enfoque ni desglose de tareas.
