# Tasks

## 1. Helper de mensaje compartido

- [x] 1.1 Crear `src/core/share.ts` con `buildShareText(entry, origin)` (versículo, referencia, nota de traducción cuando exista, enlace `/?dia=`) y `shareUrls(...)` para los destinos; verificar con `npm test` que los tests nuevos en `src/core/share.test.ts` cubren día con y sin `translationNote` y que pasan
- [x] 1.2 Verificar que la URL compartida usa `window.location.origin` (test con origin simulado) y no un dominio hardcodeado, ejecutando `npm test`

## 2. Componente de compartir

- [x] 2.1 Crear `src/app/ShareDevotional.tsx` con detección de Web Share API al montar, modo hoja (`navigator.share` con `AbortError` silencioso) y modo fila con `aria-expanded`; verificar con `npm run lint` que el archivo pasa
- [x] 2.2 Implementar la fila de destinos (WhatsApp, Facebook, X, Telegram, Instagram, Copiar) con URLs de intención, `target="_blank" rel="noopener noreferrer"`, y aviso "copiado ✓" auto-ocultable con fallback "No se pudo copiar"; verificar con `npm run lint`
- [x] 2.3 Insertar `<ShareDevotional entry={devotional} />` en `src/app/page.tsx` debajo del blockquote y antes de los párrafos; verificar observando en `npm run dev` que el control aparece en esa posición en cualquier día

## 3. Vista previa OG

- [x] 3.1 Componer `public/og-image.jpg` (1200×630, <100 KB, opción A: texto a la izquierda, retrato a la derecha) desde `public/Charles_Haddon_Spurgeon.jpg` usando `public/og-preview-mockup.jpg` como referencia de composición; verificar con `file public/og-image.jpg` las dimensiones y con `ls -la` el tamaño <100 KB
- [x] 3.2 Agregar `metadataBase` y `openGraph` (title, description, url, images 1200×630, type website, locale es_MX) en `src/app/layout.tsx`; verificar con `npm run build` que compila y que el HTML de salida incluye los metadatos `og:image` y `og:title`
- [ ] 3.3 Verificar la vista previa real pegando la URL en el depurador de Sharing de Facebook (o una herramienta OG checker) y confirmando título, descripción e imagen; borrar `public/og-preview-mockup.jpg` si ya no se necesita como referencia

## 4. Verificación integrada

- [x] 4.1 Correr `npm test` y `npm run lint` completos y confirmar que todo pasa sin regresiones
- [x] 4.2 Verificar en navegador con soporte de Web Share (móvil/PWA) que el botón abre la hoja nativa con el mensaje precargado, y en uno sin soporte que despliega la fila con los seis destinos
- [x] 4.3 Verificar que compartir un día con `?dia=` y abrirlo en otra sesión muestra ese día, y que el botón cancelado (hoja nativa) no muestra errores

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
