## Purpose

Define cómo el dueño sube, lista y borra las fotos de sus álbumes, qué archivos se aceptan y con qué límites, y cómo se mantiene el disco coherente con la base. Las fotos suben una a una; el orden de subida es el del mazo.

## ADDED Requirements

### Requirement: Subir una foto a un álbum propio

El dueño con sesión SHALL poder subir una foto a un álbum suyo enviando el archivo. La foto SHALL quedar registrada al final del orden de subida del álbum, y su original SHALL guardarse en el disco con un nombre que no se pueda adivinar y que no se derive del nombre original del archivo. Subir a un álbum de otro dueño SHALL responderse como un álbum inexistente y SHALL NOT guardar nada.

#### Scenario: Subida válida

- **WHEN** el dueño sube un JPEG de 2 MiB a su álbum
- **THEN** la respuesta describe la foto
- **AND** la foto aparece en el álbum después de las que ya tenía
- **AND** el original existe en el disco

#### Scenario: Nombre del archivo original

- **WHEN** el dueño sube un archivo llamado `../../etc/passwd.jpg`
- **THEN** el original se guarda con un nombre propio dentro del directorio de fotos
- **AND** ningún archivo se crea fuera de ese directorio

#### Scenario: Álbum de otro dueño

- **WHEN** un dueño sube una foto al álbum de otro dueño
- **THEN** la respuesta es la de un álbum inexistente
- **AND** no se registra ninguna foto ni se guarda ningún archivo

#### Scenario: Sin sesión

- **WHEN** se sube una foto sin una sesión válida
- **THEN** la respuesta es 401 y no se guarda nada

### Requirement: Solo se aceptan JPEG, PNG y WebP, según su contenido

El sistema SHALL aceptar únicamente imágenes JPEG, PNG y WebP, y SHALL decidirlo por el contenido del archivo, no por el tipo de contenido ni la extensión que declare quien lo envía. Cualquier otro archivo SHALL rechazarse con 422 que nombre el campo del archivo, sin guardar nada.

#### Scenario: Formato admitido

- **WHEN** el dueño sube un PNG válido
- **THEN** la foto se acepta y queda registrada como PNG

#### Scenario: HEIC

- **WHEN** el dueño sube una imagen HEIC
- **THEN** la respuesta es 422 y no se guarda nada

#### Scenario: Extensión de imagen con otro contenido

- **WHEN** el dueño sube un archivo de texto llamado `foto.jpg` y declarado como `image/jpeg`
- **THEN** la respuesta es 422 y no se guarda nada

#### Scenario: Imagen con extensión engañosa

- **WHEN** el dueño sube un WebP válido llamado `foto.jpg`
- **THEN** la foto se acepta y queda registrada como WebP

### Requirement: Límite de 20 MiB por foto

El sistema SHALL rechazar con 422, nombrando el campo del archivo, cualquier archivo de más de 20 MiB, sin guardar nada. Un archivo de exactamente 20 MiB SHALL aceptarse. El rechazo SHALL producirse sin dejar el archivo parcial en el disco.

#### Scenario: Archivo demasiado grande

- **WHEN** el dueño sube un archivo de 20 MiB más un byte
- **THEN** la respuesta es 422 y no queda ningún archivo en el disco ni fila en la base

#### Scenario: Archivo en el límite

- **WHEN** el dueño sube una imagen válida de exactamente 20 MiB
- **THEN** la foto se acepta

### Requirement: Límite de 50 fotos por álbum

Un álbum SHALL tener como mucho 50 fotos. Subir una más SHALL rechazarse con 409 con un código propio del conflicto, que incluya el límite, sin guardar nada. Borrar una foto SHALL liberar un lugar.

#### Scenario: Álbum lleno

- **WHEN** el dueño sube una foto a un álbum que ya tiene 50
- **THEN** la respuesta es 409 con el código de álbum lleno y el límite en los detalles
- **AND** no se guarda ningún archivo

#### Scenario: Lugar liberado

- **WHEN** el dueño borra una foto de un álbum de 50 y sube otra
- **THEN** la subida se acepta

#### Scenario: Subidas simultáneas

- **WHEN** dos subidas llegan a la vez a un álbum con 49 fotos
- **THEN** exactamente una se acepta y el álbum queda con 50

### Requirement: Una subida fallida no deja rastro

Si una subida no se completa, por validación, por límite o por un fallo al guardar o registrar, el sistema SHALL NOT dejar un original en el disco sin su fila ni una fila sin su original.

#### Scenario: Fallo al registrar

- **WHEN** el archivo se guardó pero el registro en la base falla
- **THEN** el archivo guardado se elimina

#### Scenario: Fallo al guardar

- **WHEN** el archivo no puede escribirse en el disco
- **THEN** no queda ninguna fila de la foto
- **AND** la respuesta es un error genérico que no revela rutas

### Requirement: Listar las fotos de un álbum propio en orden de subida

El dueño SHALL poder listar las fotos de un álbum suyo, en el orden en que se subieron. Un álbum de otro dueño SHALL responderse como inexistente.

#### Scenario: Orden de subida

- **WHEN** el dueño sube las fotos A, B y C, en ese orden, y lista el álbum
- **THEN** las fotos aparecen como A, B, C

#### Scenario: Álbum de otro dueño

- **WHEN** un dueño lista las fotos del álbum de otro dueño
- **THEN** la respuesta es la de un álbum inexistente

### Requirement: Borrar una foto propia

El dueño SHALL poder borrar una foto de un álbum suyo. El borrado SHALL eliminar la foto, sus votos y su original del disco. Borrar una foto de otro dueño, o una foto que no pertenece al álbum indicado, SHALL responderse como inexistente y SHALL NOT borrar nada.

#### Scenario: Borrado correcto

- **WHEN** el dueño borra una foto suya
- **THEN** la foto ya no está en el álbum ni su original en el disco
- **AND** las demás fotos siguen intactas

#### Scenario: Foto de otro dueño

- **WHEN** un dueño intenta borrar una foto de otro dueño
- **THEN** la respuesta es la de una foto inexistente y la foto sigue existiendo

#### Scenario: Foto de otro álbum

- **WHEN** el dueño pide borrar una foto de su álbum X usando el identificador de su álbum Y
- **THEN** la respuesta es la de una foto inexistente y la foto sigue existiendo

### Requirement: Cada foto se describe con variantes firmadas

Toda foto que la API devuelva SHALL incluir una URL para cada variante (miniatura, mazo y visor), cada una firmada de modo que el servicio de transformación la acepte. La API SHALL NOT exponer la ruta del original en el disco ni su identificador de almacenamiento.

#### Scenario: Variantes presentes

- **WHEN** el dueño lista un álbum con fotos
- **THEN** cada foto trae las URLs de miniatura, mazo y visor

#### Scenario: El original no se expone

- **WHEN** se inspecciona cualquier respuesta que describe una foto
- **THEN** no contiene la ruta del original ni su identificador de almacenamiento
