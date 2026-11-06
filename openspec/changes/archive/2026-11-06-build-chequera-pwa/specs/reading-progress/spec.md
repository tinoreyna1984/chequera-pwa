# Spec Delta

## Purpose

Registra qué días del año calendario ha leído el usuario, sin depender de la red, y reporta su avance en el ciclo anual.

## ADDED Requirements

### Requirement: Marcar y desmarcar una lectura como leída
La vista del devocional SHALL permitir marcar el día como leído o desmarcarlo, con un control accesible cuyo estado se expone mediante `aria-pressed`.

#### Scenario: Marcar como leído
- **WHEN** el usuario marca el día actual como leído
- **THEN** el control queda en estado activo y el progreso se actualiza de inmediato

#### Scenario: Desmarcar
- **WHEN** el usuario desmarca un día ya leído
- **THEN** el día deja de contar en el avance

### Requirement: Persistencia local por año
El progreso SHALL guardarse en `localStorage` y SHALL agruparse por año calendario, de modo que una lectura de un año no aparezca como leída en el siguiente.

#### Scenario: Año siguiente
- **WHEN** el usuario marcó el 5 de noviembre de 2026 y abre la app el 5 de noviembre de 2027
- **THEN** el día aparece como no leído

#### Scenario: Reapertura sin conexión
- **WHEN** el usuario abre la app sin conexión
- **THEN** el progreso guardado se muestra igual que con conexión

### Requirement: Estadísticas de avance anual
La app SHALL mostrar el número de días leídos sobre el total del año, el porcentaje y la racha de días consecutivos hasta la fecha actual.

#### Scenario: Avance parcial
- **WHEN** el usuario ha leído 10 días de un año de 365
- **THEN** se muestra 10 de 365, 3% y la racha correspondiente

#### Scenario: Día bisiesto en el total
- **WHEN** el año en curso es bisiesto
- **THEN** el total mostrado es 366

### Requirement: El servidor se entera solo si el usuario leyó hoy
Cuando el usuario marca como leído el devocional de la fecha local y tiene el recordatorio activo, la app SHALL notificarlo al servidor para omitir ese recordatorio; el fallo de esa llamada no SHALL bloquear la interfaz.

#### Scenario: Recordatorio omitido
- **WHEN** el usuario marca el día como leído antes de su hora de recordatorio
- **THEN** el servidor no envía el recordatorio de ese día

#### Scenario: Notificación falla
- **WHEN** la llamada al servidor falla
- **THEN** la interfaz responde igual y el registro de leído se conserva
