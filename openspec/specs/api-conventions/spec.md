# api-conventions Specification

## Purpose
Fija la forma de lo que devuelve la API y qué código de estado corresponde a cada situación, para que un cliente trate respuestas y errores de manera uniforme sin conocer el endpoint y para que ninguna respuesta revele más de lo que corresponde. Rige para todos los endpoints del proyecto, no solo para los que introduce este change.

## Requirements

### Requirement: Todas las respuestas comparten una misma forma

Todo cuerpo que devuelva la API SHALL tener la misma estructura externa: un campo con el resultado cuando la petición es satisfactoria y un campo con el error cuando falla. Exactamente uno de los dos SHALL tener valor. Ningún endpoint SHALL devolver una forma propia, ni siquiera el healthcheck o una ruta inexistente.

#### Scenario: Dos endpoints devuelven la misma estructura

- **WHEN** se comparan las respuestas satisfactorias del healthcheck y del usuario actual
- **THEN** comparten la misma estructura externa

#### Scenario: Un cliente distingue éxito de error sin conocer el endpoint

- **WHEN** un cliente recibe una respuesta de cualquier endpoint
- **THEN** puede saber si fue satisfactoria o un error a partir de cuál de los dos campos tiene valor

#### Scenario: Ruta inexistente

- **WHEN** se pide una ruta de la API que no existe
- **THEN** la respuesta es 404 con la estructura común de error

### Requirement: Un error se identifica por un código estable

Todo error SHALL incluir un código legible por máquina, estable entre versiones, y un mensaje legible por una persona. El cliente SHALL poder decidir qué hacer a partir del código, sin interpretar el mensaje.

#### Scenario: Error con código y mensaje

- **WHEN** se inspecciona cualquier respuesta de error
- **THEN** contiene un código y un mensaje

### Requirement: Los campos que llegan al cliente usan una sola convención de nombres

Los nombres de campo de los cuerpos SHALL seguir una única convención en toda la API, camelCase, que es la del cliente y no la del esquema de la base. La nomenclatura interna SHALL NOT filtrarse hacia afuera.

#### Scenario: Campo compuesto

- **WHEN** una respuesta incluye un dato que en la base se llama con guion bajo, por ejemplo `created_at`
- **THEN** la respuesta lo nombra en camelCase, por ejemplo `createdAt`

### Requirement: Falta de sesión y falta de permiso se distinguen entre sí

Pedir algo que requiere sesión sin presentar una válida SHALL responderse con 401. Pedir algo con una sesión válida pero sin autorización sobre un recurso cuya existencia ya le consta a quien pide SHALL responderse con 403.

#### Scenario: Sin sesión, no autenticado

- **WHEN** se pide un recurso que requiere sesión sin presentar una válida
- **THEN** la respuesta es 401 con un código que indica que falta autenticación

### Requirement: Cuando conocer la existencia es en sí una filtración, no existir y no tener acceso se responden igual

Para los recursos a los que se llega por un identificador opaco que funciona como credencial, como el enlace de compartir, o que pertenecen a otro dueño, un recurso existente al que quien pide no tiene acceso SHALL responderse exactamente igual que uno inexistente: 404 con el mismo código y el mismo mensaje.

#### Scenario: Existente sin acceso e inexistente son indistinguibles

- **WHEN** se pide un recurso que existe pero al que quien pide no tiene acceso, y se pide otro que no existe
- **THEN** las dos respuestas tienen el mismo estado y el mismo cuerpo

### Requirement: Un error de validación indica qué campo lo causó

Cuando el cuerpo o los parámetros de una petición no cumplan lo que el endpoint espera, la respuesta SHALL ser 422 con un código de validación, el nombre del campo que lo provocó y una descripción de lo esperado.

#### Scenario: La respuesta nombra el campo inválido

- **WHEN** se inicia sesión con un cuerpo JSON sin el campo de contraseña
- **THEN** la respuesta es 422 y nombra el campo `password`

### Requirement: Una operación rechazada por el estado del recurso se distingue de un error de validación

Cuando una petición bien formada no pueda completarse por el estado del recurso, la respuesta SHALL ser 409 con un código propio del conflicto, SHALL NOT señalar ningún campo como inválido, y SHALL incluir los datos que permitan corregir la situación cuando existan.

#### Scenario: Conflicto de estado

- **WHEN** una petición bien formada choca con el estado del recurso
- **THEN** la respuesta es 409, con un código de conflicto y sin campo inválido

### Requirement: Ninguna respuesta de error revela el interior del sistema

Las respuestas de error SHALL NOT contener trazas, texto de consultas, nombres de tablas o columnas, rutas de archivos ni mensajes originados en dependencias. Un fallo inesperado SHALL responderse con 500, un mensaje genérico y un identificador que permita encontrar el detalle en los registros del servidor. Una base que no se puede consultar SHALL responderse con 503 y un mensaje genérico.

#### Scenario: Fallo inesperado

- **WHEN** una ruta lanza una excepción que el sistema no previó
- **THEN** la respuesta es 500 con un mensaje genérico y un identificador, y el registro del servidor contiene ese identificador junto con la traza

#### Scenario: Base inaccesible

- **WHEN** el healthcheck no puede consultar la base
- **THEN** la respuesta es 503 y su cuerpo no menciona SQLite, tablas, consultas ni rutas de archivos
