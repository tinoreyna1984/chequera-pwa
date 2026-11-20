# Proposal

## Why

Los usuarios que leen el devocional no tienen forma de compartirlo: no existe ningún control de compartir en la vista, y al pegar un enlace en WhatsApp o Facebook la vista previa es genérica (sin imagen ni identidad del sitio). Compartir versículos es una forma natural de crecimiento para un devocional diario.

## What Changes

- Nuevo botón "Compartir versículo" ubicado debajo del blockquote del versículo en la vista diaria.
- El contenido compartido es el versículo como texto (comillas, referencia y nota de traducción cuando exista) más el enlace profundo al día (`/?dia=MM-DD`).
- En dispositivos con Web Share API, el botón abre la hoja nativa del sistema; sin ella, se despliega una fila de destinos: WhatsApp, Facebook, X, Telegram, Instagram y copiar.
- Instagram no admite compartir por URL web: el botón copia el texto al portapapeles, muestra un aviso "copiado ✓" y abre `instagram.com` para que el usuario lo pegue.
- Copiar al portapapeles es el fallback universal de la fila.
- Metadatos de vista previa mejorados: `og:title`, `og:description` y una `og:image` fija con el retrato de Spurgeon (tarjeta 1200×630 compuesta a partir de `public/Charles_Haddon_Spurgeon.jpg`), para que cualquier enlace compartido muestre marca e imagen.

## Capabilities

### New Capabilities
- `devotional-sharing`: control de compartir en la vista diaria, contenido del texto compartido, destinos soportados, comportamiento de Web Share API y fallbacks (portapapeles, Instagram), y vista previa de enlaces (metadatos Open Graph e imagen fija).

### Modified Capabilities
<!-- Ninguno: los requisitos existentes de daily-reading no cambian; el
     control de compartir es comportamiento nuevo y vive completo en
     devotional-sharing. -->

## Impact

- `src/app/page.tsx`: nuevo componente/estado de compartir bajo el blockquote (cliente, sin cambios en la navegación por `popstate`).
- `src/app/layout.tsx`: metadatos `openGraph` (title, description, image, url) y `metadataBase`.
- `public/`: nuevo asset de imagen OG (tarjeta 1200×630) compuesto desde el retrato existente; el mockup de evaluación `public/og-preview-mockup.jpg` se descarta o se usa como referencia.
- Sin cambios en datos (`public/data/devotionals.json`), servidor, API push ni service worker.
