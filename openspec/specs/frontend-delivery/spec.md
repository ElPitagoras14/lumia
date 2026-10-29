# frontend-delivery

## Purpose

Gobierna cómo se construye la interfaz de Lumia y cómo se entrega al navegador, incluida la resolución de rutas del lado del cliente y el cacheo de lo que se sirve. No cubre por dónde entra el tráfico, que es asunto de `local-environment`.

## Requirements

### Requirement: La interfaz se entrega ya construida

Lo que se sirve al navegador SHALL ser el resultado de una construcción previa. SHALL NOT compilarse ni transformarse al atender una petición, y servirla SHALL NOT depender de herramientas de desarrollo ni de acceso a la red.

#### Scenario: Servir no requiere herramientas de construcción

- **WHEN** se atiende una petición de la interfaz en el entorno en contenedores
- **THEN** se entregan archivos ya construidos
- **AND** no se ejecuta ninguna herramienta de construcción

### Requirement: Cualquier ruta de la aplicación cargada directamente entrega la aplicación

Pedir directamente una ruta interna de la interfaz SHALL devolver el documento de la aplicación con una respuesta satisfactoria, para que el cliente resuelva la vista. Las rutas reservadas a la API y a imágenes SHALL NOT resolverse con el documento de la aplicación.

#### Scenario: Recargar en una ruta profunda

- **WHEN** se abre o recarga directamente una ruta interna de la aplicación
- **THEN** se recibe el documento de la aplicación con una respuesta satisfactoria

#### Scenario: Ruta inexistente de la API

- **WHEN** se pide una ruta inexistente del espacio de la API
- **THEN** la respuesta proviene del backend
- **AND** no es el documento de la interfaz

### Requirement: El cacheo permite ver un despliegue nuevo sin intervención

Los recursos cuyo nombre identifica su contenido SHALL servirse con un cacheo prolongado. El documento de entrada SHALL servirse de forma que el navegador lo revalide, para que una versión nueva se vea al recargar sin vaciar la caché a mano.

#### Scenario: Recursos identificados por contenido

- **WHEN** el navegador recibe un recurso cuyo nombre identifica su contenido
- **THEN** la respuesta permite conservarlo en caché por un período prolongado

#### Scenario: Versión nueva al recargar

- **WHEN** se reconstruye la interfaz con cambios y el usuario recarga
- **THEN** el navegador obtiene la versión nueva

### Requirement: La interfaz está en español y toma el teléfono como caso base

El documento de la interfaz SHALL declarar el español como idioma. La interfaz SHALL ser operable en un viewport de teléfono como caso primario, sin desplazamiento horizontal.

#### Scenario: Idioma declarado

- **WHEN** se inspecciona el documento de la aplicación
- **THEN** declara el idioma español

#### Scenario: Viewport angosto

- **WHEN** se abre la interfaz en un viewport de 360 px de ancho
- **THEN** no aparece desplazamiento horizontal
