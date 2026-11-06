# Daily Reminder Specification

## Purpose

Permite al usuario programar un recordatorio diario con Web Push y garantiza que el servidor lo envíe una sola vez, a la hora elegida y en la zona horaria del dispositivo.

## Requirements

### Requirement: Configurar el recordatorio en el cliente
La app SHALL permitir activar y desactivar el recordatorio y elegir la hora con `input type="time"`, en el paso definido por `NEXT_PUBLIC_REMINDER_STEP_MINUTES`; al activar, SHALL solicitar el permiso de notificaciones dentro del gesto del usuario.

#### Scenario: Activación
- **WHEN** el usuario activa el recordatorio y acepta el permiso
- **THEN** la app se suscribe a Web Push y registra la suscripción con la hora y la zona horaria del dispositivo

#### Scenario: Permisos denegados
- **WHEN** el permiso queda en `denied`
- **THEN** la app muestra cómo reactivarlo y no queda con un estado activo inconsistente

#### Scenario: Navegador sin soporte
- **WHEN** el navegador no ofrece `PushManager` o `Notification`
- **THEN** la app informa que el recordatorio no está disponible en ese navegador

### Requirement: La suscripción se sincroniza al abrir la app
Con el recordatorio activo, la app SHALL verificar al iniciar si la suscripción o la zona horaria cambiaron y SHALL volver a registrarla en caso afirmativo.

#### Scenario: Zona horaria cambiada
- **WHEN** el usuario viaja y cambia la zona horaria del sistema
- **THEN** la próxima entrega usa la nueva zona

#### Scenario: Suscripción perdida
- **WHEN** la suscripción del navegador desapareció
- **THEN** la app la crea de nuevo y actualiza el registro del servidor

### Requirement: Cambiar u omitir la entrega
Cambiar la hora SHALL actualizar el registro del servidor; desactivar el recordatorio SHALL eliminar la suscripción tanto en el navegador como en el servidor.

#### Scenario: Cambio de hora
- **WHEN** el usuario cambia la hora de 07:30 a 06:45
- **THEN** la próxima entrega se calcula con la nueva hora

#### Scenario: Desactivación
- **WHEN** el usuario desactiva el recordatorio
- **THEN** la suscripción se elimina y no se envían más notificaciones

### Requirement: Despacho programado e idempotente
El servidor SHALL recibir llamadas autenticadas con `Bearer CRON_SECRET` en `POST /api/push/dispatch` y SHALL enviar solo las suscripciones cuya hora ya llegó, sin duplicar la entrega del mismo día aunque la llamada se repita.

#### Scenario: Envío en la hora elegida
- **WHEN** el servidor corre después de la hora programada de una suscripción activa
- **THEN** recibe la notificación con el `devotionalId` de la fecha local

#### Scenario: Segunda llamada del mismo día
- **WHEN** `dispatch` vuelve a correr después de ya haber enviado
- **THEN** no envía otra notificación ese día

#### Scenario: Llamada sin credenciales
- **WHEN** llega un `dispatch` sin la cabecera `Authorization` correcta
- **THEN** responde 401 sin procesar nada

### Requirement: Omitir entregas tardías o ya leídas
El servidor SHALL reprogramar sin enviar cuando la fecha local ya se notificó, cuando el usuario marcó esa fecha como leída o cuando la hora programada lleva más de 2 horas vencida.

#### Scenario: Caída de varias horas
- **WHEN** la última ejecución fue hace 5 horas
- **THEN** la suscripción se reprograma para el día siguiente y no recibe un aviso tardío

#### Scenario: Marcado como leído
- **WHEN** el usuario marcó el día como leído antes de su hora
- **THEN** el recordatorio de ese día no se envía

### Requirement: La hora respeta el horario del dispositivo
El cálculo de la próxima entrega SHALL usar la zona horaria IANA del usuario y SHALL seguir funcionando cuando cambie el horario de verano.

#### Scenario: Horario de verano
- **WHEN** la zona del usuario pasa a horario de verano
- **THEN** la notificación sigue llegando a la hora local elegida

### Requirement: Suscripciones caducas se retiran
Ante una respuesta de "ya no existe" del servicio push, el servidor SHALL eliminar la suscripción; ante errores temporales SHALL reintentar en el siguiente ciclo y después de 5 fallos consecutivos SHALL reprogramar para el día siguiente.

#### Scenario: Dispositivo dado de baja
- **WHEN** el servicio push responde 404 o 410
- **THEN** el registro se elimina del almacén

#### Scenario: Error temporal
- **WHEN** el servicio push responde 500
- **THEN** el registro se conserva y se reintenta en la próxima ejecución

### Requirement: El cuerpo de la notificación viene del cliente
El servidor SHALL enviar únicamente el `devotionalId` del día (y el tipo de evento); el texto visible de la notificación SHALL componerse a partir de los datos cacheados en el dispositivo.

#### Scenario: Notificación con datos en caché
- **WHEN** el navegador recibe el push con el devocional del día en caché
- **THEN** el título indica el día y el cuerpo muestra el versículo y la referencia

#### Scenario: Sin datos en caché
- **WHEN** el dispositivo no tiene los datos cacheados
- **THEN** la notificación usa un texto genérico y sigue abriendo el día correspondiente
