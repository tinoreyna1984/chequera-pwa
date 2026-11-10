# Service Worker Specification

## Purpose

Asegura que la app funcione sin conexión después de la primera carga y que las notificaciones push abran el día correcto.

## Requirements

### Requirement: Precarga del shell y de los datos
El Service Worker SHALL precachear el shell de la aplicación, las rutas prerenderizadas, la página sin conexión y `public/data/devotionals.json`, sirviendo los datos con estrategia `CacheFirst`.

#### Scenario: Primera carga y posterior uso sin red
- **WHEN** el usuario abre la app una vez y después la abre sin conexión
- **THEN** la app carga y cualquier día se puede leer

#### Scenario: Datos actualizados
- **WHEN** se publica una versión nueva de `devotionals.json`
- **THEN** el Service Worker obtiene la versión nueva al precachear

### Requirement: Página de respaldo sin conexión
Cuando falle la carga de un documento y no haya respuesta en caché, el Service Worker SHALL mostrar `/~offline` en lugar de un error del navegador.

#### Scenario: Ruta no cacheada sin red
- **WHEN** el usuario navega a una ruta desconocida estando sin conexión
- **THEN** se muestra la página sin conexión

### Requirement: El archivo del Service Worker siempre se sirve fresco
La ruta `/sw.js` SHALL responder con `Cache-Control: no-cache, no-store, must-revalidate`.

#### Scenario: Nueva versión publicada
- **WHEN** el navegador vuelve a comprobar el Service Worker después de un despliegue
- **THEN** recibe la versión nueva y no una copia en caché

### Requirement: Clic en la notificación abre el día
Al hacer clic en una notificación, el navegador SHALL enfocar una ventana existente o abrir una nueva y navegar a `/?dia=` con el devocional de la notificación.

#### Scenario: App ya abierta
- **WHEN** ya hay una ventana abierta y el usuario pulsa la notificación
- **THEN** se enfoca esa ventana y se muestra el día de la notificación

#### Scenario: App cerrada
- **WHEN** no hay ventanas abiertas
- **THEN** se abre la app directamente en el día de la notificación

### Requirement: Cambio de suscripción se propaga al servidor
Si el navegador informa que la suscripción cambió, el Service Worker SHALL suscribirse de nuevo y notificar al servidor con la suscripción anterior y la nueva para conservar la configuración.

#### Scenario: Rotación de suscripción
- **WHEN** el navegador reemplaza la suscripción
- **THEN** el servidor actualiza el registro y la hora del usuario se mantiene

### Requirement: Actualización del shell tras despliegue
Cuando se publique una versión nueva de la aplicación, el Service Worker SHALL actualizar el shell cacheado y eliminar las cachés de versiones anteriores, de modo que la próxima apertura muestre el contenido nuevo.

#### Scenario: Nueva versión publicada
- **WHEN** se despliega una versión nueva y el usuario vuelve a abrir la app
- **THEN** la app muestra el contenido de la versión nueva

#### Scenario: Cachés obsoletas purgadas
- **WHEN** el Service Worker de la versión nueva toma el control del dispositivo
- **THEN** las cachés de versiones anteriores ya no están disponibles

#### Scenario: Actualización sin red
- **WHEN** el usuario abre la app sin conexión después de que el Service Worker se actualizó
- **THEN** la app carga desde el shell cacheado de la versión nueva
