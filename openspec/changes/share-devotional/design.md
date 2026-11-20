# Design

## Context

La vista diaria (`src/app/page.tsx`) es un componente cliente único que resuelve el día con `useSyncExternalStore` sobre `popstate` y lee `?dia=MM-DD` de la URL. El enlace profundo ya funciona: `/?dia=11-05` abre ese día. No existe ningún control de compartir, y `src/app/layout.tsx` solo declara `title` y `description` estáticos (sin `og:*` ni `metadataBase`). El retrato `public/Charles_Haddon_Spurgeon.jpg` (2400×2964) existe en el repo y no se usa en el código. Ver proposal.md por la motivación; los requisitos están en specs/devotional-sharing/spec.md.

## Goals / Non-Goals

**Goals:**
- Un único control de compartir bajo el blockquote que funcione igual en móvil, PWA instalada y escritorio.
- Mensaje consistente: versículo + referencia (+ nota de traducción) + enlace al día, en todos los destinos.
- Vista previa de enlaces con marca e imagen (OG fija), sin tocar el renderizado en servidor de la página.

**Non-Goals:**
- Metadatos OG por día (`og:title`/`og:description` con el versículo específico) — requiere SSR de `dia`, change aparte.
- Imagen OG dinámica generada por día.
- Compartir la reflexión completa (solo el versículo).
- Botones de compartir fuera de la vista diaria (about, notificaciones).

## Decisions

### 1. Un solo botón con dos modos (Web Share API primero)
`typeof navigator.share === "function"` decide el modo al montar el componente:
- **Modo hoja**: `navigator.share({ title, text, url })`. Se detecta en cliente tras hidratación para no romper el prerender del servidor; el botón se renderiza en ambos modos con el mismo aspecto para evitar salto de layout. `AbortError` (usuario canceló) se traga sin mensaje.
- **Modo fila**: click alterna la fila de destinos debajo del botón.

*Alternativa descartada*: fila siempre visible — duplica en móvil lo que la hoja nativa ya ofrece y satura la vista.

### 2. Mensaje compartido como helper puro en `src/core/`
`buildShareText(entry, origin)` devuelve el texto canónico (versículo, referencia, nota, enlace `/?dia=`). Al estar en `src/core/` se prueba con vitest igual que `devotional-id.ts` / `reading-progress.ts`, sin renderizar React. El núcleo no recibe `year`: el enlace lleva solo `MM-DD` y el año lo resuelve la app al abrirlo. El origen llega como parámetro desde el adaptador `src/adapters/origin.ts` (regla de pureza de `src/core`: sin APIs del navegador) y se expone como snapshots de `useSyncExternalStore` para no generar mismatch de hidratación en los `href`.

*Alternativa descartada*: construir el texto inline en el JSX — no testeable sin DOM y se duplicaría entre modo hoja y fila.

### 3. Fila de destinos: URLs de intención conocidas
| Destino | Mecanismo |
|---|---|
| WhatsApp | `https://wa.me/?text=<encoded>` |
| Facebook | `https://www.facebook.com/sharer/sharer.php?u=<url>` (ignora texto — por eso importa el OG) |
| X | `https://twitter.com/intent/tweet?text=<encoded>` |
| Telegram | `https://t.me/share?url=<url>&text=<encoded>` |
| Instagram | sin URL de compartir: `clipboard.writeText(text)` + aviso + `window.open("https://instagram.com")` |
| Copiar | `clipboard.writeText(text)` + aviso |

Todo en `target="_blank" rel="noopener noreferrer"`. El aviso "copiado ✓" reutiliza un estado `shareMessage` local con auto-ocultamiento, en el mismo patrón (no el mismo estado) que `notificationMessage`.

*Fallback de portapapeles*: si `navigator.clipboard` no existe o falla (contexto no seguro), se muestra "No se pudo copiar" en el mismo aviso.

### 4. Componente dedicado `ShareDevotional.tsx`
Recibe `entry` como prop (sin `year`: no se usa); encapsula modo, fila y avisos. `page.tsx` solo lo coloca bajo el blockquote. Patrón consistente con `InstallPrompt.tsx` y `AppearanceSettings.tsx` (componentes hermanos en `src/app/`).

### 5. OG fija en `layout.tsx` + asset estático
- `metadataBase` con `https://chequera-pwa.vercel.app` (leído de README; si el dominio cambia, es una constante).
- `openGraph`: `title`, `description`, `url`, `images: [{ url: "/og-image.jpg", width: 1200, height: 630 }]`, `type: "website"`, `locale: "es_MX"`.
- El asset se compone **una sola vez** desde el retrato original (recorte de opción A: rostro a la derecha, texto a la izquierda), queda en `public/og-image.jpg` (<100 KB, JPEG q80). No hay script de generación: es un artefacto fijo.
- `public/og-preview-mockup.jpg` es material de evaluación; se borra al completar o se conserva como referencia — decisión de implementación sin impacto en specs.

## Risks / Trade-offs

- [El botón depende de `entry`/`id` nulos durante la carga] → `ShareDevotional` solo se renderiza cuando `devotional` existe (mismo guard que el resto de la vista); no hay caso de mensaje incompleto.
- [Facebook descarta el texto del enlace] → la fila de Facebook solo envía `u=`; la calidad de esa vista previa depende del OG (decisión 5). Mientras el OG sea genérico, Facebook verá marca+imagen pero no el versículo — aceptado como Non-Goal.
- [Safari en contextos no seguros sin `navigator.clipboard`] → fallback mostrado como aviso, nunca error bloqueante.
- [Salto de layout al detectar Web Share API] → el botón tiene forma idéntica en ambos modos; la fila (solo modo fallback) se despliega bajo el botón con `aria-expanded`.
- [Tamaño del retrato original (1 MB)] → el asset OG se recorta y comprime aparte; el original no se referencia en metadatos.

## Migration Plan

Cambio aditivo sin datos ni API: desplegar no afecta comportamiento existente. Rollback = revert del commit (el asset OG y el componente no tienen dependencias inversas).

## Open Questions

- Dominio canónico exacto para `metadataBase`: confirmado en README (`https://chequera-pwa.vercel.app`); si se usa dominio propio después, actualizar la constante.
