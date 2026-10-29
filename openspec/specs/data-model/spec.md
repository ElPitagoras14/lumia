# data-model Specification

## Purpose
Define qué entidades guarda Lumia, cómo se relacionan y qué reglas de integridad hace cumplir la propia base, para que la propiedad por usuario, la unicidad de los votos y las cascadas al borrar no dependan solo del código de la API.

## Requirements

### Requirement: Cada álbum pertenece a un usuario

Todo álbum SHALL referenciar a un usuario existente como dueño. La base SHALL NOT permitir un álbum sin dueño. Un usuario con álbumes SHALL NOT poder borrarse mientras los conserve, para que nunca se pierdan filas de fotos cuyos archivos siguen en disco. El email de un usuario SHALL ser único sin distinguir mayúsculas de minúsculas.

#### Scenario: Álbum sin dueño válido

- **WHEN** se inserta un álbum que referencia un usuario inexistente
- **THEN** la inserción se rechaza

#### Scenario: Borrar un usuario con álbumes

- **WHEN** se borra un usuario que todavía tiene álbumes
- **THEN** el borrado se rechaza y el usuario y sus álbumes siguen existiendo

#### Scenario: Email repetido con otras mayúsculas

- **WHEN** existe un usuario con `ana@example.com` y se inserta otro con `Ana@Example.com`
- **THEN** la inserción se rechaza

#### Scenario: Dos usuarios con álbumes propios

- **WHEN** dos usuarios tienen un álbum cada uno
- **THEN** filtrar los álbumes por el identificador de uno de ellos devuelve solo el suyo

### Requirement: Las sesiones del dueño expiran y no guardan el secreto en claro

Cada sesión SHALL referenciar a un usuario y SHALL registrar cuándo expira. La sesión SHALL guardar un resumen criptográfico del secreto de la cookie, nunca el secreto en claro, y ese resumen SHALL ser único. Borrar un usuario SHALL borrar sus sesiones.

#### Scenario: Resumen repetido

- **WHEN** se insertan dos sesiones con el mismo resumen de secreto
- **THEN** la segunda inserción se rechaza

#### Scenario: Sesión sin expiración

- **WHEN** se inserta una sesión sin fecha de expiración
- **THEN** la inserción se rechaza

#### Scenario: Usuario borrado

- **WHEN** se borra un usuario sin álbumes que tiene sesiones
- **THEN** sus sesiones desaparecen

### Requirement: Las fotos pertenecen a un álbum y conservan el orden de subida

Toda foto SHALL pertenecer a un álbum existente y SHALL tener un identificador de almacenamiento único, que nombra su archivo original. El tipo de contenido SHALL ser JPEG, PNG o WebP, y el tamaño en bytes SHALL ser positivo. El orden en que se registraron las fotos de un álbum SHALL poder recuperarse de forma estable, porque es el orden del mazo.

#### Scenario: Tipo no admitido

- **WHEN** se inserta una foto con tipo de contenido `image/heic`
- **THEN** la inserción se rechaza

#### Scenario: Identificador de almacenamiento repetido

- **WHEN** se insertan dos fotos con el mismo identificador de almacenamiento, aunque sea en álbumes distintos
- **THEN** la segunda inserción se rechaza

#### Scenario: Orden de subida

- **WHEN** se registran las fotos A, B y C en ese orden en un álbum
- **THEN** ordenarlas por su identificador devuelve A, B, C

### Requirement: Un álbum tiene como mucho un enlace de compartir

Un álbum SHALL tener cero o un enlace de compartir. El token de cada enlace SHALL ser único entre todos los álbumes. Revocar un enlace SHALL equivaler a reemplazarlo o eliminarlo, de modo que el token anterior deje de existir.

#### Scenario: Segundo enlace para el mismo álbum

- **WHEN** un álbum ya tiene enlace y se inserta otro para el mismo álbum
- **THEN** la inserción se rechaza

#### Scenario: Token repetido entre álbumes

- **WHEN** se inserta un enlace cuyo token ya usa otro álbum
- **THEN** la inserción se rechaza

#### Scenario: Revocar no afecta a los participantes

- **WHEN** se borra o reemplaza el enlace de un álbum que tiene participantes con votos
- **THEN** los participantes y sus votos siguen existiendo

### Requirement: Los participantes pertenecen a un álbum, no a un usuario

Todo participante SHALL pertenecer a un álbum existente, con un nombre no vacío de como mucho 50 caracteres. El participante SHALL guardar un resumen criptográfico único del secreto de su cookie, nunca el secreto en claro. Los participantes SHALL NOT referenciar a la tabla de usuarios. Dos participantes del mismo álbum SHALL poder tener el mismo nombre.

#### Scenario: Nombre vacío

- **WHEN** se inserta un participante con un nombre vacío o formado solo por espacios
- **THEN** la inserción se rechaza

#### Scenario: Nombre demasiado largo

- **WHEN** se inserta un participante con un nombre de 51 caracteres
- **THEN** la inserción se rechaza

#### Scenario: Mismo nombre en el mismo álbum

- **WHEN** se insertan dos participantes llamados "Ana" en el mismo álbum con secretos distintos
- **THEN** ambas inserciones se aceptan y son participantes distintos

### Requirement: Un voto por foto y participante, dentro del mismo álbum

Un voto SHALL relacionar una foto y un participante del mismo álbum, con un valor binario: a favor o en contra. SHALL existir como mucho un voto por pareja de foto y participante; cambiar un voto SHALL reemplazar el valor existente sin conservar historial. La ausencia de voto SHALL significar que la foto está pendiente para ese participante, no que la rechazó.

#### Scenario: Voto duplicado

- **WHEN** un participante ya votó una foto y se inserta otro voto para la misma pareja
- **THEN** la inserción se rechaza

#### Scenario: Foto de otro álbum

- **WHEN** se inserta un voto de un participante del álbum X sobre una foto del álbum Y
- **THEN** la inserción se rechaza

#### Scenario: Valor no binario

- **WHEN** se inserta un voto con un valor distinto de a favor o en contra
- **THEN** la inserción se rechaza

#### Scenario: Cambio de voto

- **WHEN** un participante cambia su voto de a favor a en contra
- **THEN** la pareja tiene un único voto, en contra

### Requirement: Borrar un álbum, una foto o un participante borra lo que depende de él

Borrar un álbum SHALL borrar sus fotos, su enlace de compartir, sus participantes y todos los votos asociados. Borrar una foto SHALL borrar sus votos. Borrar un participante SHALL borrar sus votos. Ningún borrado SHALL dejar votos, fotos ni participantes huérfanos.

#### Scenario: Borrar un álbum

- **WHEN** se borra un álbum con fotos, enlace, participantes y votos
- **THEN** no queda ninguna fila de fotos, enlaces, participantes ni votos de ese álbum

#### Scenario: Borrar una foto

- **WHEN** se borra una foto con votos de varios participantes
- **THEN** sus votos desaparecen y los votos de las demás fotos se conservan

#### Scenario: Borrar un participante

- **WHEN** se borra un participante con votos
- **THEN** sus votos desaparecen y los de los demás participantes se conservan
