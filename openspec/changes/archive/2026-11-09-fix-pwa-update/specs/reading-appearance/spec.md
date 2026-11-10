# Spec Delta

## MODIFIED Requirements

### Requirement: Tema claro, oscuro o sistema
La app SHALL ofrecer los temas claro, oscuro y sistema, aplicando el modo oscuro de Tailwind mediante clases y resolviendo `system` según la preferencia del sistema. Toda la interfaz —superficies, texto, bordes, controles y estados deshabilitados— SHALL responder al tema seleccionado, y una preferencia elegida por el usuario SHALL prevalecer sobre la preferencia del sistema. La barra de estado de la app en dispositivos compatibles SHALL adoptar el color de la superficie del tema resuelto.

#### Scenario: Sistema en oscuro
- **WHEN** el sistema operativo indica modo oscuro y el tema es `system`
- **THEN** la app se muestra en oscuro

#### Scenario: Cambio de tema en caliente
- **WHEN** el usuario cambia a tema claro
- **THEN** la app cambia sin recargar

#### Scenario: Tema claro con sistema en oscuro
- **WHEN** el usuario elige tema claro mientras el sistema operativo indica modo oscuro
- **THEN** la app se muestra en claro

#### Scenario: Superficies con color fijo
- **WHEN** la app se muestra en tema oscuro
- **THEN** el fondo de las páginas, los diálogos, los campos de fecha y hora y los estados deshabilitados usan la paleta oscura

#### Scenario: Barra de estado del dispositivo
- **WHEN** la app se muestra en un dispositivo Android con un tema resuelto
- **THEN** la barra de estado adopta el color de la superficie de ese tema
