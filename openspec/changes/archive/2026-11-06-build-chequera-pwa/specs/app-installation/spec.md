# Spec Delta

## Purpose

Permite instalar la app con su identidad visual correcta y ofrece la pantalla de inicio con el retrato de Spurgeon en los dispositivos compatibles.

## ADDED Requirements

### Requirement: Manifiesto de instalación
La app SHALL publicar un manifiesto con `name: "Chequera del Banco de la Fe"`, `short_name: "Chequera"`, `lang: "es"`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, los colores de tema y de fondo en `#1e2a4a` y los íconos de 192, 512 y 512 adaptado.

#### Scenario: Lectura del manifiesto
- **WHEN** se solicita el manifiesto
- **THEN** devuelve esos valores y al menos un ícono adaptado con `purpose: "maskable"`

### Requirement: Íconos en todas las superficies
La app SHALL servir su ícono como ícono de la pestaña del navegador (`app/icon.png`), ícono de Apple (`app/apple-icon.png`), `apple-touch-icon` e íconos de 192 y 512 px en `public/icons/`, todos derivados del mismo diseño.

#### Scenario: Pestaña del navegador
- **WHEN** la app se abre en un navegador
- **THEN** la pestaña muestra el ícono de la app en lugar del de la plantilla

### Requirement: Pantalla de inicio con el retrato de Spurgeon
En iOS, la app SHALL declarar imágenes de inicio en `public/splash/` con el retrato centrado sobre el fondo de la app; la splash de Android SHALL producirse con `background_color` y el ícono del manifiesto.

#### Scenario: Apertura desde el inicio en iOS
- **WHEN** el usuario lanza la app instalada en iOS
- **THEN** se muestra la pantalla de inicio con el retrato antes de que cargue la interfaz

### Requirement: Detección del evento de instalación
En navegadores que lo emitan, la app SHALL mostrar un banner discreto al recibir `beforeinstallprompt`, permitir descartarlo y no volver a mostrarlo durante 30 días.

#### Scenario: Oferta de instalación
- **WHEN** el navegador emite `beforeinstallprompt` y el banner no está descartado recientemente
- **THEN** se muestra el banner con acción de instalar

#### Scenario: Descarte
- **WHEN** el usuario cierra el banner
- **THEN** no vuelve a aparecer durante 30 días

### Requirement: Indicación de instalación en iOS
En iOS y iPadOS fuera del modo standalone, la app SHALL mostrar instrucciones para instalarla mediante "Compartir" y "Agregar a inicio", porque sin instalarla no puede recibir notificaciones.

#### Scenario: Visita desde Safari en iOS
- **WHEN** un usuario con iOS abre la app sin haberla instalado
- **THEN** la app explica cómo agregarla al inicio

### Requirement: Idioma y metadatos de la app
El documento SHALL declarar `<html lang="es">` y los títulos y textos visibles SHALL estar en español.

#### Scenario: Documento servido
- **WHEN** se carga la raíz de la app
- **THEN** el atributo `lang` del documento es `es` y el título nombra la app
