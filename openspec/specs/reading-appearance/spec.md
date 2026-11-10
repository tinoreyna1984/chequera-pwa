# Reading Appearance Specification

## Purpose

Conserva las preferencias de tipografía y de tema del usuario en su dispositivo para que la lectura sea cómoda y consistente entre sesiones.

## Requirements

### Requirement: Tamaño de texto ajustable
La app SHALL ofrecer cuatro tamaños de texto (`sm`, `md`, `lg`, `xl`) con `md` por defecto, aplicables al contenido del devocional.

#### Scenario: Selección del tamaño más grande
- **WHEN** el usuario elige `xl`
- **THEN** el texto del devocional se reescala sin desbordar el contenedor

#### Scenario: Valor por defecto
- **WHEN** el usuario nunca ha guardado preferencias
- **THEN** la app usa el tamaño `md` y el tema `system`

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

### Requirement: Preferencias persistidas en el dispositivo
Las preferencias SHALL guardarse en `localStorage` y aplicarse antes del primer pintado, sin destello del tema anterior.

#### Scenario: Reapertura de la app
- **WHEN** el usuario reabre la app con tema oscuro y tamaño `lg` guardados
- **THEN** la app se muestra en oscuro con el tamaño `lg` sin destello

#### Scenario: Tema no visto antes
- **WHEN** la app se abre por primera vez en oscuro
- **THEN** no aparece un destello claro antes de cargar

### Requirement: Acentos legibles en ambos temas
La app SHALL usar tonos de acento que mantengan contraste legible sobre la superficie de cada tema.

#### Scenario: Acentos en oscuro
- **WHEN** la app se muestra en tema oscuro
- **THEN** los enlaces, etiquetas y botones de acento permanecen legibles sobre el fondo oscuro
