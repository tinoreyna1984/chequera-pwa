# Tasks

## 1. Separación del contenido compartido

- [x] 1.1 Ajustar `src/core/share.ts` para exponer el texto base sin URL y componer mensajes específicos por destino; verificar con pruebas unitarias que el texto y la URL de WhatsApp, X y Telegram contengan un único enlace.
- [x] 1.2 Actualizar `src/app/ShareDevotional.tsx` para enviar a la Web Share API el texto sin URL junto con el campo `url`, y conservar para Instagram el mensaje completo con un único enlace; verificar con `npm run lint`.

## 2. Pruebas del comportamiento

- [x] 2.1 Ampliar `src/core/share.test.ts` para cubrir WhatsApp con URL en el texto, X con parámetro `url`, Telegram con texto sin URL y parámetro `url`, y la ausencia de enlaces duplicados; verificar con `npm test`.
- [x] 2.2 Verificar que el enlace copiado para la acción "Copiar" permanezca limpio y que el mensaje de Instagram conserve exactamente una URL; verificar con las pruebas existentes o una prueba de componente adecuada.

## 3. Verificación de integración

- [x] 3.1 Ejecutar `npm test`, `npm run lint` y `openspec validate --changes --strict` (equivalente disponible en esta versión de OpenSpec); confirmar que todos terminan correctamente.
- [x] 3.2 Probar manualmente la fila de destinos sin Web Share API y la hoja nativa en un navegador compatible; confirmar visualmente que Instagram, Telegram, X y WhatsApp muestran o reciben el enlace una sola vez.
