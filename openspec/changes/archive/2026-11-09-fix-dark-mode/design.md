# Design

## Context

Ver `proposal.md` (Why) para la motivación. Contexto técnico relevante:

- Tailwind v4 (sin `tailwind.config.js`): la variante `dark` por defecto usa `@media (prefers-color-scheme: dark)`; para modo por clase hay que declarar `@custom-variant` en CSS.
- `globals.css` hoy define `--background`/`--foreground` por `data-theme`, pero solo los usa `body`; cada página pinta su propio fondo con clases fijas.
- `AppearanceSettings` aplica el tema en `useEffect` (después del primer pintado) y sus dos effects compiten: el de escritura guarda los defaults antes de que el microtask de lectura recupere la preferencia.
- `layout.tsx` no tiene ningún script en `<head>`; el `html` no lleva `suppressHydrationWarning`.
- Requisitos de referencia en `openspec/changes/fix-dark-mode/specs/reading-appearance/spec.md`.

## Goals / Non-Goals

**Goals:**

- Que los 11 tokens de color existan en un solo lugar (`globals.css`) con valores claro/oscuro.
- Que toda la UI existente (home, about, ~offline, panel de apariencia, diálogo de notificaciones, inputs de fecha/hora) responda al tema.
- Aplicar tema y tamaño antes del primer pintado, sin destello, y conservar la preferencia guardada al reabrir.
- Responder a cambios del sistema cuando el tema es `system`, sin recargar.

**Non-Goals:**

- `InstallPrompt.tsx`: el banner `#1e2a4a` ya es oscuro por diseño y funciona en ambos temas.
- `manifest.ts`: `background_color`/`theme_color` son fijos de la PWA instalada.
- Cambiar la paleta de marca, el esquema de `localStorage` o la UI existente más allá de los colores.
- Tests de DOM: `vitest` corre en entorno `node` y el proyecto no tiene infraestructura de tests de render.

## Decisions

**1. Clase `.dark` en `<html>` en lugar de `data-theme` para el modo oscuro.**
La spec pide "el modo oscuro de Tailwind mediante clases". Se declara `@custom-variant dark (&:where(.dark, .dark *))` en `globals.css`.
*Alternativa descartada:* mantener `data-theme` como gancho de la variante — requiere un `@custom-variant` más complejo y se aleja de la convención de Tailwind; además `data-theme` ya no aporta nada si `system` se resuelve en JS.

**2. Resolver `system` en JS, no con media queries en CSS.**
Un script inline en `<head>` (via `dangerouslySetInnerHTML` en `layout.tsx`) lee `chequera-appearance`, resuelve el tema efectivo (`dark` si es `dark`, o `system` + `matchMedia("(prefers-color-scheme: dark)")`) y aplica `.dark` y `data-reader-size` antes del primer pintado. Después registra un listener de `matchMedia` que actualiza la clase cuando el sistema cambia.
*Por qué:* con `system` ya resuelto, la variante `dark` es trivial y no hay dos fuentes de verdad (media query + atributo) compitiendo, que es justo el bug de la línea 22-27 de `globals.css`.
*Alternativa descartada:* `data-theme="system"` + media query en CSS — deja el estado ambiguo y obliga a que cada variante cubra dos condiciones.

**3. Tokens semánticos en `@theme inline` mapeados a variables CSS.**
En `:root` se definen los valores claro; en `:root.dark` (y `.dark` como prefijo de la variante) los oscuros. `@theme inline` los expone como utilidades (`bg-surface`, `text-ink`, `border-line`, `text-accent`…).

| token | light | dark |
|---|---|---|
| `surface` | `#fffdf8` | `#171717` |
| `raised` | `#ffffff` | `#262626` |
| `ink` | stone-800 | stone-200 |
| `ink-strong` | stone-900 | stone-100 |
| `muted` | stone-600 | stone-400 |
| `faint` | stone-300 | stone-600 |
| `line` | stone-200 | stone-800 |
| `line-strong` | stone-300 | stone-700 |
| `accent` | amber-800 | amber-400 |
| `accent-solid` | amber-700 | amber-600 |
| `on-accent` | `#ffffff` | `#ffffff` |

*Alternativa descartada:* esparcir `dark:` en las ~34 clases — repetitivo, propenso a dejar superficies sin cambiar (el defecto actual), y el contraste de acentos habría que corregirlo caso por caso.
*También descartado:* un token `accent-decor` extra para el borde `border-l-4 border-amber-500` del bloque de cita — `accent-solid` sirve; si el borde resulta pálido en oscuro se ajusta el valor del token sin tocar la página.

**4. `color-scheme` por tema.**
`.dark { color-scheme: dark }` (y `light` en `:root`) para que los controles nativos —`<input type="date">`, `<input type="time">`, `<select>`— se pinten en oscuro. Hoy `color-scheme: dark` solo existía en las ramas de variables y quedaba anulado por la regla contradictoria.

**5. Corregir la carrera de `localStorage` separando lectura inicial de escritura.**
`AppearanceSettings` debe leer la preferencia guardada *antes* de emitir cualquier escritura: inicializar el estado leyendo `localStorage` (o proteger el primer effect con un flag de "hidratación hecha") para que la escritura de defaults no sobrescriba lo guardado antes de leerlo.
*Por qué:* hoy el effect B escribe `{theme:"system",size:"medium"}` en el mismo flush que el microtask del effect A, que luego lee ese valor — la preferencia se pierde en cada recarga.
*Alternativa descartada:* mover la lectura al script inline del `<head>` y que React arranque ya hidratado — mejor para el destello, pero exige que el estado de React se inicialice sin leer en effects; se combina con el punto 2: el script ya aplicó `.dark`/`data-reader-size`, y el effect de escritura se activa solo después de la primera lectura.

**6. Eliminar la regla contradictoria de `globals.css`.**
Se borra el bloque `@media (prefers-color-scheme: dark) { :root { … } }` (líneas 22-27) y las reglas por `data-theme` de las líneas 8-9; el tema vivo pasa a ser exclusivamente la clase `.dark` + tokens. Queda un solo gris oscuro (`#171717`) en toda la hoja de estilos.

## Risks / Trade-offs

- [Flash si el script inline no corre antes del CSS] → el script va en `<head>` antes del render, sin `async`; se verifica con la scenario "Tema no visto antes" de la spec.
- [Hydration mismatch: React pinta sin `.dark` y el script ya lo puso] → `suppressHydrationWarning` en `<html>` de `layout.tsx`.
- [Dos fuentes de verdad (script y effect de React) peleando por `.dark`] → el effect de `AppearanceSettings` solo escribe cambios del usuario; el script es el único que aplica el estado inicial.
- [Alguna de las 34 clases fijas se queda sin token] → la revisión es por archivo (`page.tsx`, `about`, `~offline`, `AppearanceSettings`) buscando `bg-`, `text-stone`, `text-amber`, `border-stone`, `bg-white`; queda como tarea explícita de `tasks.md`.
- [Tokens de más (ceremonia) o de menos (fuga de colores)] → los 11 cubren las 34 ocurrencias actuales; si aparece un color nuevo se agrega al token, no a una clase fija.

## Migration Plan

Cambio de una sola pasada, sin datos ni despliegue fraccionado: se reescriben `globals.css` y los cuatro componentes en el mismo commit. Rollback = revertir el commit; no hay esquema de `localStorage` que migrar.

## Open Questions

Ninguna que afecte specs, enfoque ni desglose de tareas.
