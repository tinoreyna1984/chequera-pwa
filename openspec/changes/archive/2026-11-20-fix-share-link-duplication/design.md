# Design

## Context

La lógica actual centraliza el mensaje en `src/core/share.ts`: `buildShareText` incluye el enlace profundo y `shareUrls` reutiliza ese texto para WhatsApp, X y Telegram. Además, Telegram recibe el mismo enlace mediante `url`, y la Web Share API recibe el enlace tanto en `text` como en `url`. El componente `src/app/ShareDevotional.tsx` usa el mensaje completo para la hoja nativa y para Instagram.

## Goals / Non-Goals

**Goals:**

- Mantener una única representación del enlace en el resultado compartido de WhatsApp, Telegram, X, Instagram y la hoja nativa.
- Conservar el enlace limpio en la acción "Copiar".
- Mantener el comportamiento de Facebook, que ya envía solamente la URL.
- Cubrir las diferencias entre destinos con pruebas unitarias.

**Non-Goals:**

- Cambiar el formato del enlace profundo `/?dia=MM-DD`.
- Cambiar los metadatos Open Graph o la vista previa de Facebook.
- Añadir nuevos destinos o modificar la interfaz visual del control.

## Decisions

1. **Separar texto y URL por destino.** Se conservará un mensaje base formado por versículo, referencia y nota de traducción, y se compondrá el enlace en el parámetro apropiado de cada destino. WhatsApp e Instagram mantendrán la URL dentro del texto final porque sus flujos actuales dependen de texto pegable; Telegram, X y la Web Share API usarán el campo o parámetro de URL dedicado. Esto evita enviar la misma URL por dos canales.

2. **Mantener la URL como dato independiente en la hoja nativa.** El payload nativo usará texto sin URL junto con `url`, en lugar del mensaje completo más `url`. Es preferible a quitar `url`, porque permite que el sistema operativo y las aplicaciones receptoras reconozcan el enlace como recurso compartido.

3. **Usar el parámetro `url` en X.** El texto de X no incluirá el enlace y la intención lo enviará mediante su parámetro dedicado, dejando que X lo agregue una sola vez al compositor. WhatsApp conservará el mensaje textual completo, ya que su URL de intención se basa en `text`.

4. **Usar texto sin URL y `url` en Telegram.** Telegram recibirá el texto descriptivo en `text` y el enlace profundo en `url`; así se evita la duplicación producida por enviar la URL en ambos parámetros.

5. **Conservar un mensaje completo para Instagram.** Instagram no ofrece un destino web equivalente con parámetros de compartir para este flujo. Por eso se copiará el texto completo, incluida una única URL, antes de abrir Instagram.

## Risks / Trade-offs

- [Los clientes sociales pueden mostrar una vista previa además de la URL textual] -> Las pruebas verificarán que la aplicación envía una sola URL por destino; la representación visual final queda bajo control de cada plataforma.
- [Versiones antiguas de la intención de X podrían ignorar `url`] -> Se mantendrá el texto base y se validará el enlace generado; si un cliente ignora el parámetro, el comportamiento dependerá de esa plataforma, no de una duplicación de la aplicación.
- [La Web Share API puede presentar el enlace según reglas propias del sistema operativo] -> El payload no enviará la URL dentro del texto y la prueba del componente verificará que `text` y `url` sean campos no redundantes.

## Migration Plan

No se requiere migración de datos ni cambios de servidor. Se actualizan los helpers, el componente, las pruebas y el delta de especificación; el rollback consiste en revertir esos cambios de cliente.
