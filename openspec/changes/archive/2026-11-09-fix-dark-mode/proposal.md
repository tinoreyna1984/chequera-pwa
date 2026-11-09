# Proposal

## Why

El modo oscuro está especificado en `reading-appearance` pero no funciona en la práctica: casi ningún color de la interfaz responde al tema (las ~34 clases de color son fijas y no existe ninguna variante `dark:`), el tema se aplica después del primer pintado y la preferencia guardada en `localStorage` se sobrescribe antes de poder leerse. La app incumple requisitos ya existentes de la capability `reading-appearance`.

## What Changes

- Tokens semánticos de color (11) definidos en `globals.css` con valores para claro y oscuro; las páginas dejan de usar clases de color fijas (`bg-[#fffdf8]`, `bg-white`, `text-stone-*`, `text-amber-*`) y pasan a `bg-surface`, `text-ink`, `border-line`, `text-accent`, etc.
- Clase `.dark` en `<html>` mediante `@custom-variant dark` de Tailwind v4; `system` se resuelve con `matchMedia` y se actualiza en caliente cuando cambia la preferencia del sistema.
- Script inline en `<head>` de `layout.tsx` que aplica tema y tamaño antes del primer pintado, sin destello.
- Corrección de la carrera de lectura/escritura en `localStorage` de `AppearanceSettings`: la preferencia guardada ya no se pierde al reabrir la app.
- Eliminación de la regla `@media (prefers-color-scheme: dark)` sin condición de tema en `globals.css`, que forzaba fondo oscuro aunque el usuario hubiera elegido "Claro".

## Capabilities

### New Capabilities

<!-- ninguna -->

### Modified Capabilities

- `reading-appearance`: el requisito del tema se precisa para exiger que toda la interfaz (superficies, texto, bordes y controles) responda al tema seleccionado, con escenarios que impiden la regresión detectada (colores fijos ignorando el tema; tema claro anulado por el sistema).

## Impact

- Archivos: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/about/page.tsx`, `src/app/~offline/page.tsx`, `src/app/AppearanceSettings.tsx`.
- Sin cambios de API, sin dependencias nuevas, sin cambios en el esquema de `localStorage` (`chequera-appearance` conserva `{ theme, size }`).
- Fuera de alcance: `InstallPrompt.tsx` (banner `#1e2a4a` que ya funciona en ambos temas) y `manifest.ts` (`background_color` fijo de la PWA).
