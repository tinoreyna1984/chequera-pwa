# Devotional Data Specification

## Purpose

Garantiza que `public/data/devotionals.json` contenga las 366 lecturas del devocional con la forma del dominio, extraídas del PDF original y verificadas antes de publicarse.

## Requirements

### Requirement: Extracción del PDF a JSON
El sistema SHALL generar `public/data/devotionals.json` a partir de `data/raw/chequera-spurgeon.pdf` mediante `npm run data:build`, ejecutando `pdftotext -layout` e interpretando la salida sin intervención manual.

#### Scenario: Generación completa
- **WHEN** se ejecuta `npm run data:build` con el PDF original presente
- **THEN** el sistema escribe `public/data/devotionals.json` y termina con código 0

#### Scenario: PDF ausente
- **WHEN** se ejecuta `npm run data:build` sin `data/raw/chequera-spurgeon.pdf`
- **THEN** el sistema reporta el error y termina con código distinto de 0 sin modificar el JSON existente

### Requirement: Cada entrada cumple el modelo de dominio
Cada objeto de `devotionals` SHALL incluir `id` con formato `MM-DD`, `month`, `day`, `verse`, `reference`, `content` y `pdfPage`; `verse` y `reference` no SHALL estar vacíos y `content` SHALL contener al menos un párrafo.

#### Scenario: Primera lectura del año
- **WHEN** se examina la entrada generada para el 1 de enero
- **THEN** tiene `id` "01-01", `month` 1, `day` 1, un `verse` no vacío, una `reference` no vacía y al menos un párrafo en `content`

#### Scenario: Anotación de versión bíblica
- **WHEN** el original indica la versión entre paréntesis, como en el 5 de abril
- **THEN** la entrada conserva la versión en `translationNote` y la referencia queda en `reference`

### Requirement: Cobertura exacta de 366 días únicos
El archivo SHALL contener exactamente 366 entradas con fechas válidas sin repetir, incluida la fecha `02-29`.

#### Scenario: Verificación de cobertura
- **WHEN** se genera el JSON
- **THEN** hay 366 entradas, todas las fechas existen en el calendario y ninguna se repite

#### Scenario: Día bisiesto presente
- **WHEN** se busca la entrada con `id` "02-29"
- **THEN** existe y corresponde al 29 de febrero

### Requirement: Validación obligatoria del resultado
El sistema SHALL verificar antes de escribir que no queden encabezados de página, números de página ni referencias partidas en los campos; si algo no cumple, SHALL terminar con código distinto de 0 y mostrar las advertencias por `id`.

#### Scenario: Resto de encabezado detectado
- **WHEN** el texto de algún `verse` o `content` aún contiene "CHEQUERA DEL BANCO DE LA FE"
- **THEN** el sistema reporta el `id` afectado y no publica el JSON

#### Scenario: Reporte de advertencias
- **WHEN** alguna entrada queda sin `reference` o con la referencia incompleta
- **THEN** el sistema imprime el `id` y el motivo antes de fallar

### Requirement: Correcciones manuales por id
El sistema SHALL aplicar `data/overrides.json` sobre los datos extraídos, sobrescribiendo por `id`, para corregir los casos que la heurística no resuelve.

#### Scenario: Override aplicado
- **WHEN** `data/overrides.json` define una corrección para `09-08`
- **THEN** la entrada `09-08` del JSON resultante usa el contenido del override

#### Scenario: Override con id desconocido
- **WHEN** `data/overrides.json` menciona un `id` que no existe entre las 366 fechas
- **THEN** el sistema reporta el error y termina con código distinto de 0

### Requirement: Referencia bíblica normalizada
El sistema SHALL publicar la referencia sin comillas, sin punto final y con el formato `Libro Capítulo:Versículo`, uniendo los saltos de línea de la fuente.

#### Scenario: Referencia partida en la fuente
- **WHEN** la referencia aparece como "Génesis 3:" en una línea y "15." en la siguiente
- **THEN** el campo `reference` resulta en `Génesis 3:15`
