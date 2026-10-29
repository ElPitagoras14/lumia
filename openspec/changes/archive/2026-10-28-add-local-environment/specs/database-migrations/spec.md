## Purpose

Gobierna cómo Lumia lleva su base SQLite al esquema vigente y con qué garantías se conecta el backend a ella, para que cada change que agregue tablas lo haga con una migración que se aplica sola al levantar el entorno.

## ADDED Requirements

### Requirement: Las migraciones se aplican en un paso propio antes de que arranque el backend

Al levantar el entorno, un paso de migración separado del backend SHALL aplicar todas las migraciones pendientes y terminar. Si la base no existe, SHALL crearla. El backend SHALL arrancar solo después de que ese paso termine con éxito. Si una migración falla, el backend SHALL NOT arrancar. El paso de migración SHALL poder ejecutarse por sí solo, sin arrancar la API.

#### Scenario: Base inexistente

- **WHEN** se levanta el entorno y el archivo de la base no existe
- **THEN** el paso de migración crea la base y la deja en la última versión
- **AND** el backend arranca después de que ese paso terminó

#### Scenario: Base ya migrada

- **WHEN** se levanta el entorno y la base ya está en la última versión
- **THEN** el paso de migración termina con éxito sin aplicar ninguna migración
- **AND** el backend arranca normalmente

#### Scenario: Migración fallida

- **WHEN** una migración pendiente falla al aplicarse
- **THEN** el paso de migración termina con error
- **AND** el backend no arranca

#### Scenario: Migrar sin la API

- **WHEN** se ejecuta solo el paso de migración
- **THEN** la base queda en la última versión sin que el backend se haya iniciado

### Requirement: Las migraciones son archivos versionados que viajan dentro de la imagen de migración

El esquema SHALL definirse únicamente en archivos de migración versionados del repositorio, nombrados con un número secuencial de cuatro dígitos seguido de una descripción, y aplicados en orden ascendente de número. La imagen del paso de migración SHALL contener esos archivos, de modo que migrar no requiera el repositorio en el host.

#### Scenario: Migrar con la imagen sola

- **WHEN** se ejecuta la imagen del paso de migración contra una base vacía sin montar archivos del repositorio
- **THEN** la base queda en la última versión

#### Scenario: El orden numérico se respeta

- **WHEN** existen las migraciones `0009` y `0010`
- **THEN** la `0010` se aplica después de la `0009`

#### Scenario: Cada migración declara aplicación y reversión

- **WHEN** se inspecciona cualquier archivo de migración
- **THEN** contiene las secciones de aplicación y de reversión, aunque alguna quede vacía

### Requirement: El backend no modifica el esquema

El backend SHALL NOT aplicar migraciones ni crear tablas al arrancar. El esquema SHALL cambiar únicamente a través del paso de migración.

#### Scenario: Backend con base sin migrar

- **WHEN** el backend arranca contra una base que no está en la última versión
- **THEN** el backend no aplica ninguna migración

### Requirement: Las conexiones a la base hacen cumplir las claves foráneas y toleran concurrencia

Toda conexión del backend a la base SHALL hacer cumplir las restricciones de clave foránea. La base SHALL operar en un modo que permita lecturas concurrentes con una escritura en curso, y una conexión que encuentra la base bloqueada SHALL esperar un tiempo acotado antes de fallar, en vez de fallar de inmediato.

#### Scenario: Clave foránea violada

- **WHEN** una conexión del backend inserta una fila que referencia una fila inexistente de otra tabla
- **THEN** la inserción se rechaza

#### Scenario: Lectura durante una escritura

- **WHEN** una conexión lee mientras otra tiene una transacción de escritura abierta
- **THEN** la lectura se completa sin error de bloqueo

### Requirement: El healthcheck refleja la disponibilidad de la base

El healthcheck de la API SHALL responder satisfactoriamente solo si el backend puede consultar la base. Si la base no se puede consultar, SHALL responder con un error.

#### Scenario: Base disponible

- **WHEN** se pide el healthcheck con la base accesible
- **THEN** la respuesta es satisfactoria

#### Scenario: Base inaccesible

- **WHEN** se pide el healthcheck y la base no se puede consultar
- **THEN** la respuesta indica un error de servicio no disponible
