# Daily Reading Specification

## Purpose

Define qué devocional ve el usuario al abrir la app, cómo navega por el año calendario y cómo se presenta su contenido.

## Requirements

### Requirement: Muestra el devocional de la fecha local
La ruta `/` SHALL mostrar el devocional correspondiente a la fecha actual calculada en el dispositivo del usuario; el servidor no SHALL depender de la zona horaria del cliente.

#### Scenario: Apertura en la fecha de hoy
- **WHEN** el usuario abre `/` el 5 de noviembre
- **THEN** se muestra la entrada con `id` "11-05"

#### Scenario: Shell estático
- **WHEN** se genera la página `/`
- **THEN** se sirve desde caché sin leer la hora en el servidor

### Requirement: Apertura de un día específico
La ruta `/` con el parámetro `dia` SHALL abrir el día indicado, con el mismo formato `MM-DD`.

#### Scenario: Enlace de notificación
- **WHEN** el usuario abre `/?dia=11-05`
- **THEN** se muestra el devocional del 5 de noviembre

#### Scenario: Parámetro inválido
- **WHEN** `dia` no corresponde a una fecha válida o a un día existente
- **THEN** la app muestra el devocional de la fecha actual

### Requirement: Navegación dentro del año calendario
La interfaz SHALL ofrecer controles de día anterior y día siguiente limitados al año en curso, un botón "Hoy" y SHALL omitir el 29 de febrero cuando el año no es bisiesto.

#### Scenario: Navegar a través de febrero en año no bisiesto
- **WHEN** el año no es bisiesto y el usuario está en 28 de febrero y pulsa "siguiente"
- **THEN** se muestra el 1 de marzo

#### Scenario: Límite del año
- **WHEN** el usuario está en 31 de diciembre y pulsa "siguiente"
- **THEN** el control está deshabilitado y la fecha no cambia

#### Scenario: Volver a hoy
- **WHEN** el usuario ha navegado a otro día y pulsa "Hoy"
- **THEN** se muestra el devocional de la fecha local

### Requirement: Contenido completo del día
La vista SHALL presentar la fecha, el versículo, la referencia, la traducción bíblica cuando exista y cada párrafo de la reflexión como párrafo separado.

#### Scenario: Lectura de la reflexión
- **WHEN** se abre cualquier día
- **THEN** los elementos de `content` aparecen como párrafos independientes en orden

### Requirement: Refresco al recuperar la fecha
La app SHALL actualizar la fecha mostrada cuando el dispositivo vuelve a estar visible y la fecha local cambió.

#### Scenario: Cruce de medianoche con la app abierta
- **WHEN** la app está abierta antes de medianoche y el usuario la vuelve a ver al día siguiente
- **THEN** se muestra el devocional del día nuevo
