# Spec Delta

## Purpose

Permite al usuario compartir el versículo del devocional que está leyendo, con un enlace profundo al día, a través de la hoja nativa del sistema o de destinos directos, y garantiza que los enlaces compartidos muestren una vista previa con la identidad del sitio.

## ADDED Requirements

### Requirement: Control de compartir en la vista diaria
La vista del devocional SHALL mostrar un control "Compartir versículo" ubicado debajo del blockquote que contiene el versículo y antes de los párrafos de la reflexión.

#### Scenario: Ubicación del control
- **WHEN** se abre cualquier día del devocional
- **THEN** el control de compartir aparece entre el blockquote del versículo y el primer párrafo de la reflexión

### Requirement: Contenido del mensaje compartido
El mensaje compartido SHALL incluir el versículo entre comillas, la referencia bíblica con la nota de traducción cuando exista, y el enlace profundo al día en curso con el parámetro `dia` en formato `MM-DD`.

#### Scenario: Compartir un día con nota de traducción
- **WHEN** el usuario comparte un día cuya entrada incluye `translationNote`
- **THEN** el mensaje contiene el versículo, la referencia seguida de la nota de traducción y el enlace `/?dia=MM-DD` de ese día

#### Scenario: Compartir un día sin nota de traducción
- **WHEN** el usuario comparte un día cuya entrada no incluye `translationNote`
- **THEN** el mensaje contiene el versículo, la referencia sin nota y el enlace `/?dia=MM-DD` de ese día

### Requirement: Uso de la Web Share API
Cuando el navegador ofrezca la Web Share API, el control de compartir SHALL invocar la hoja nativa del sistema con el título, el mensaje y el enlace del día en curso.

#### Scenario: Dispositivo con Web Share API
- **WHEN** el navegador soporta `navigator.share` y el usuario pulsa "Compartir versículo"
- **THEN** se abre la hoja nativa de compartir con el mensaje precargado

#### Scenario: Cancelación de la hoja nativa
- **WHEN** el usuario abre la hoja nativa y la cancela sin compartir
- **THEN** la vista permanece sin cambios y no se muestra ningún error

### Requirement: Fila de destinos sin Web Share API
Cuando el navegador no ofrezca la Web Share API, el control de compartir SHALL desplegar una fila con los destinos WhatsApp, Facebook, X, Telegram, Instagram y copiar; cada destino SHALL abrir un enlace de compartido con el mensaje o la URL del día en curso, y copiar SHALL colocar el mensaje completo en el portapapeles.

#### Scenario: Escritorio sin Web Share API
- **WHEN** el navegador no soporta `navigator.share` y el usuario pulsa "Compartir versículo"
- **THEN** se muestra la fila de destinos con los seis controles

#### Scenario: Compartir en WhatsApp
- **WHEN** el usuario pulsa WhatsApp en la fila de destinos
- **THEN** se abre `wa.me` con el mensaje del versículo precargado

#### Scenario: Copiar al portapapeles
- **WHEN** el usuario pulsa copiar en la fila de destinos
- **THEN** el mensaje completo queda en el portapapeles y se muestra un aviso de confirmación

### Requirement: Destino de Instagram
El destino de Instagram SHALL copiar el mensaje completo al portapapeles, mostrar un aviso de confirmación y abrir `instagram.com` para que el usuario lo pegue; esto aplica cuando no hay hoja nativa disponible.

#### Scenario: Compartir en Instagram desde escritorio
- **WHEN** el usuario pulsa Instagram en la fila de destinos
- **THEN** el mensaje se copia al portapapeles, se muestra el aviso de confirmación y se abre `instagram.com` en una pestaña nueva

### Requirement: Vista previa de enlaces compartidos
Los metadatos Open Graph de la aplicación SHALL incluir título, descripción, URL canónica e imagen fija de 1200×630 con la identidad del sitio y el retrato de Spurgeon, para que cualquier enlace compartido muestre marca e imagen.

#### Scenario: Vista previa en un enlace compartido
- **WHEN** se pega un enlace de la app en un destino que consulta metadatos Open Graph
- **THEN** la vista previa muestra el título del sitio, la descripción del devocional y la imagen de 1200×630
