# album-management Specification

## Purpose
Define cómo el dueño crea, lista y borra sus álbumes, y garantiza que cada dueño solo vea y toque los suyos. Es la base sobre la que cuelgan las fotos, el enlace de compartir y los resultados.

## Requirements

### Requirement: Crear un álbum

El dueño con sesión SHALL poder crear un álbum indicando un título. El título SHALL recortarse de espacios en los extremos y tener entre 1 y 100 caracteres. El álbum creado SHALL pertenecer al dueño que lo creó y SHALL quedar sin fotos.

#### Scenario: Álbum creado

- **WHEN** el dueño crea un álbum con el título "Vacaciones"
- **THEN** la respuesta describe el álbum con ese título, sin fotos
- **AND** el álbum aparece en su listado

#### Scenario: Título con espacios alrededor

- **WHEN** el dueño crea un álbum con el título "  Boda  "
- **THEN** el título guardado es "Boda"

#### Scenario: Título vacío o demasiado largo

- **WHEN** el dueño crea un álbum con un título vacío, formado solo por espacios o de más de 100 caracteres
- **THEN** la respuesta es 422 y nombra el campo `title`
- **AND** no se crea ningún álbum

#### Scenario: Sin sesión

- **WHEN** se intenta crear un álbum sin una sesión válida
- **THEN** la respuesta es 401 y no se crea ningún álbum

### Requirement: Listar solo los álbumes propios

El listado SHALL devolver únicamente los álbumes del dueño que lo pide, del más reciente al más antiguo. Cada álbum SHALL indicar cuántas fotos tiene y las imágenes de portada de hasta sus tres primeras fotos subidas, en orden de subida.

#### Scenario: Dos dueños, dos listados

- **WHEN** dos dueños tienen un álbum cada uno y uno de ellos pide su listado
- **THEN** la respuesta contiene solo su álbum

#### Scenario: Álbum sin fotos

- **WHEN** el dueño lista un álbum que no tiene fotos
- **THEN** el álbum indica cero fotos y ninguna imagen de portada

#### Scenario: Portada en mosaico

- **WHEN** el dueño lista un álbum con cuatro o más fotos
- **THEN** la portada son las tres primeras fotos subidas, en ese orden

#### Scenario: Pocas fotos

- **WHEN** el dueño lista un álbum con una o dos fotos
- **THEN** la portada contiene solo esas fotos

### Requirement: Ver un álbum propio

El dueño SHALL poder consultar un álbum suyo por su identificador. Un álbum de otro dueño SHALL responderse exactamente igual que uno inexistente: 404, con el mismo código y el mismo mensaje.

#### Scenario: Álbum propio

- **WHEN** el dueño consulta uno de sus álbumes
- **THEN** la respuesta describe el álbum

#### Scenario: Álbum de otro dueño e inexistente

- **WHEN** un dueño consulta el álbum de otro dueño y, aparte, uno que no existe
- **THEN** las dos respuestas tienen el mismo estado y el mismo cuerpo

### Requirement: Borrar un álbum borra sus fotos y sus archivos

El dueño SHALL poder borrar un álbum suyo. El borrado SHALL eliminar el álbum y todo lo que depende de él, y SHALL eliminar del disco los originales de todas sus fotos. Un álbum de otro dueño SHALL responderse como inexistente y SHALL NOT borrarse.

#### Scenario: Álbum con fotos

- **WHEN** el dueño borra un álbum con tres fotos
- **THEN** el álbum deja de existir
- **AND** los tres originales ya no están en el disco

#### Scenario: Álbum de otro dueño

- **WHEN** un dueño intenta borrar el álbum de otro dueño
- **THEN** la respuesta es la de un álbum inexistente
- **AND** el álbum y sus fotos siguen intactos

#### Scenario: Archivo ya ausente

- **WHEN** el dueño borra un álbum cuyo original ya no está en el disco
- **THEN** el borrado se completa igualmente
