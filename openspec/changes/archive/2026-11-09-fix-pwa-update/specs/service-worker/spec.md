# Spec Delta

## ADDED Requirements

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
