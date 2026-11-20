# Proposal

## Why

Al compartir un devocional, Instagram, Telegram, X y WhatsApp pueden mostrar o recibir el enlace duplicado. Esto ocurre porque el enlace forma parte del texto compartido y algunos destinos también lo reciben mediante un campo o parámetro de URL independiente, generando una experiencia confusa para quien publica o recibe el contenido.

## What Changes

- Ajustar la construcción del contenido compartido para que cada destino reciba el enlace exactamente una vez.
- Mantener el enlace en el texto copiado para Instagram y en el mensaje de WhatsApp, donde es necesario para conservar el contenido completo.
- Enviar el enlace mediante el parámetro dedicado en Telegram, X y la Web Share API, evitando repetirlo dentro del texto.
- Actualizar las pruebas del helper de compartir para cubrir el contenido y la URL de cada destino.
- Actualizar la especificación de compartir devocionales con el comportamiento sin duplicados.

## Capabilities

### New Capabilities

<!-- No se introduce una capacidad nueva. -->

### Modified Capabilities

- `devotional-sharing`: el contenido compartido SHALL incluir el enlace una sola vez en Instagram, Telegram, X, WhatsApp y la hoja nativa.

## Impact

- Afecta `src/core/share.ts`, `src/core/share.test.ts` y `src/app/ShareDevotional.tsx`.
- Modifica los contratos de contenido de los enlaces de intención para WhatsApp, Telegram y X, además del payload de la Web Share API.
- No requiere dependencias nuevas ni cambios en APIs del servidor.
