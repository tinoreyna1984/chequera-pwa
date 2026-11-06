# Spec Delta

## Purpose

Conserva las preferencias de tipografía y de tema del usuario en su dispositivo para que la lectura sea cómoda y consistente entre sesiones.

## ADDED Requirements

### Requirement: Tamaño de texto ajustable
La app SHALL ofrecer cuatro tamaños de texto (`sm`, `md`, `lg`, `xl`) con `md` por defecto, aplicables al contenido del devocional.

#### Scenario: Selección del tamaño más grande
- **WHEN** el usuario elige `xl`
- **THEN** el texto del devocional se reescala sin desbordar el contenedor

#### Scenario: Valor por defecto
- **WHEN** el usuario nunca ha guardado preferencias
- **THEN** la app usa el tamaño `md` y el tema `system`

### Requirement: Tema claro, oscuro o sistema
La app SHALL ofrecer los temas claro, oscuro y sistema, aplicando el modo oscuro de Tailwind mediante clases y resolviendo `system` según la preferencia del sistema.

#### Scenario: Sistema en oscuro
- **WHEN** el sistema operativo indica modo oscuro y el tema es `system`
- **THEN** la app se muestra en oscuro

#### Scenario: Cambio de tema en caliente
- **WHEN** el usuario cambia a tema claro
- **THEN** la app cambia sin recargar

### Requirement: Preferencias persistidas en el dispositivo
Las preferencias SHALL guardarse en `localStorage` y aplicarse antes del primer pintado, sin destello del tema anterior.

#### Scenario: Reapertura de la app
- **WHEN** el usuario reabre la app con tema oscuro y tamaño `lg` guardados
- **THEN** la app se muestra en oscuro con el tamaño `lg` sin destello

#### Scenario: Tema no visto antes
- **WHEN** la app se abre por primera vez en oscuro
- **THEN** no aparece un destello claro antes de cargar
