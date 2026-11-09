# Tasks

## 1. Base de color en `globals.css`

- [x] 1.1 Declarar `@custom-variant dark (&:where(.dark, .dark *))` y los 11 tokens con valores claro (`:root`) y oscuro (`.dark`), expuestos como utilidades vía `@theme inline`; verificar con `npm run build` sin errores y con `grep -- "--color-surface" .next/static/css/*.css` (o el CSS compilado equivalente) confirmando que las utilidades `bg-surface`, `text-ink`, `border-line` existen
- [x] 1.2 Eliminar las reglas `:root[data-theme="…"]` y el bloque `@media (prefers-color-scheme: dark) { :root { … } }` (líneas 8-9 y 22-27), unificando el gris oscuro en `#171717` y agregando `color-scheme` claro/oscuro por tema; verificar con `grep -n "data-theme\|#0a0a0a" src/app/globals.css` sin coincidencias

## 2. Aplicación antes del primer pintado (`layout.tsx`)

- [x] 2.1 Agregar un script inline en `<head>` (sin `async`) que lee `chequera-appearance`, resuelve `system` con `matchMedia("(prefers-color-scheme: dark)")`, aplica la clase `.dark` y `data-reader-size` antes del primer pintado y registra un listener de cambios del sistema; verificar manualmente con el escenario "Reapertura de la app": tema oscuro + tamaño `lg` guardados se pintan en oscuro sin destello, y cambiar el tema del sistema en caliente actualiza la página sin recargar
- [x] 2.2 Agregar `suppressHydrationWarning` al `<html>` en `layout.tsx`; verificar con `npm run build` y cargando la app en el navegador sin warnings de hydration en la consola

## 3. Tokens en la UI

- [x] 3.1 Reemplazar en `src/app/page.tsx` las clases de color fijas (`bg-[#fffdf8]`, `bg-white`, `text-stone-*`, `text-amber-*`, `border-stone-*`, `bg-amber-700`, `text-white`) por los tokens; verificar con `grep -n "bg-\[#\|bg-white\|text-stone\|text-amber\|border-stone\|bg-amber\|text-white" src/app/page.tsx` sin coincidencias y revisión visual en claro y oscuro
- [x] 3.2 Reemplazar las mismas clases en `src/app/about/page.tsx` y `src/app/~offline/page.tsx`; verificar con el mismo `grep` sobre ambos archivos sin coincidencias y revisión visual en claro y oscuro
- [x] 3.3 Reemplazar las clases del panel en `src/app/AppearanceSettings.tsx` (`border-stone-200`, `bg-white`, `text-amber-800`); verificar con el mismo `grep` sobre el archivo sin coincidencias y que el panel se lee en ambos temas

## 4. Persistencia sin carrera (`AppearanceSettings.tsx`)

- [x] 4.1 Garantizar que la lectura de `chequera-appearance` ocurre antes de la primera escritura (lectura inicial síncrona o effect de escritura protegido hasta hidratar); verificar con el escenario "Reapertura de la app": elegir tema Oscuro y tamaño large, recargar y confirmar que el `<select>` muestra Oscuro y el tamaño `lg` persiste

## 5. Verificación integrada

- [x] 5.1 Ejecutar `npm run lint && npm test && npm run build` sin errores
- [x] 5.2 Barrido final de clases fijas con `grep -rn "bg-\[#\|bg-white\|text-stone\|text-amber\|border-stone\|bg-amber" src/` restringido a los archivos en alcance, confirmando que solo quedan las exclusiones justificadas (`InstallPrompt.tsx`)
- [x] 5.3 Recorrer las scenarios de `specs/reading-appearance/spec.md`: sistema en oscuro, cambio de tema en caliente, tema claro con sistema en oscuro, superficies con color fijo, acentos legibles, reapertura sin destello y tema no visto antes; verificar que cada WHEN/THEN se cumple en el navegador

## 6. Corrección de datos (alcance aprobado durante la implementación)

- [x] 6.1 Agregar el override de `11-07` ("Señor si nos humillamos") en `data/overrides.json`, cambiar el test para leer ese archivo en lugar de hardcodear los overrides, y regenerar `public/data/devotionals.json` con `npm run data:build`; verificar con `npm test` (24/24)

## Workflow follow-up

- Archivar el cambio cuando la revisión del proyecto lo satisfaga (`openspec archive fix-dark-mode`).
- Verificar el resultado archivado.
