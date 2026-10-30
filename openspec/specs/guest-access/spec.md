# guest-access Specification

## Purpose

Define cómo una persona sin cuenta entra a un álbum compartido con solo un enlace y un nombre, y cómo el servidor la reconoce al volver sin que tenga que identificarse de nuevo ni pueda hacerse pasar por otra.

## Requirements

### Requirement: El enlace se resuelve sin sesión ni cuenta

Cualquiera SHALL poder consultar un enlace por su token sin sesión de dueño. Con un token vigente, la respuesta SHALL incluir el título del álbum, la cantidad de fotos y, si la petición trae una cookie de participante válida para ese álbum, el nombre de ese participante; si no, SHALL indicar que no hay participante. La respuesta SHALL NOT incluir el identificador interno del álbum, datos del dueño ni las fotos. Un token desconocido o revocado SHALL responderse exactamente igual: 404, con el mismo código y el mismo mensaje.

#### Scenario: Enlace vigente sin cookie

- **WHEN** alguien sin cookies consulta un token vigente
- **THEN** la respuesta incluye el título del álbum y la cantidad de fotos, e indica que no hay participante

#### Scenario: Enlace vigente con cookie

- **WHEN** un participante del álbum consulta el token vigente con su cookie
- **THEN** la respuesta incluye su nombre

#### Scenario: Token desconocido y token revocado

- **WHEN** se consulta un token que nunca existió y, aparte, uno que fue revocado
- **THEN** ambas respuestas son 404 con el mismo cuerpo

#### Scenario: La respuesta no revela al dueño

- **WHEN** se consulta un token vigente
- **THEN** la respuesta no contiene el email ni el identificador del dueño, ni el identificador interno del álbum

### Requirement: El invitado entra con un nombre

Con un token vigente, la API SHALL aceptar un nombre en JSON y crear un participante de ese álbum. El nombre SHALL recortarse de espacios en los extremos y tener entre 1 y 50 caracteres; si no, la respuesta SHALL ser 422 nombrando el campo `name` y no se crea participante. Al crearlo, la respuesta SHALL devolver el nombre guardado y entregar una cookie con un secreto aleatorio nuevo, `HttpOnly`, `SameSite=Lax`, válida para ese álbum y con una duración de al menos un año. La base SHALL guardar solo un resumen del secreto. Dos invitados con el mismo nombre SHALL ser participantes distintos. Un cuerpo que no sea JSON SHALL rechazarse sin crear participante. Un token desconocido o revocado SHALL responder 404 como en la consulta.

#### Scenario: Entrar

- **WHEN** un invitado sin cookie envía el nombre "Ana" a un token vigente
- **THEN** la respuesta incluye el nombre "Ana" y entrega una cookie `HttpOnly` y `SameSite=Lax`
- **AND** consultar el mismo token con esa cookie devuelve el nombre "Ana"

#### Scenario: Nombre con espacios alrededor

- **WHEN** un invitado envía el nombre "  Ana  "
- **THEN** el nombre guardado es "Ana"

#### Scenario: Nombre inválido

- **WHEN** un invitado envía un nombre vacío, formado solo por espacios o de 51 caracteres
- **THEN** la respuesta es 422, nombra el campo `name` y no se entrega cookie

#### Scenario: Mismo nombre en dos navegadores

- **WHEN** dos invitados sin cookie entran al mismo álbum con el nombre "Ana"
- **THEN** son dos participantes distintos y cada cookie identifica solo al suyo

#### Scenario: Cuerpo de formulario

- **WHEN** se envía el nombre como formulario en vez de JSON
- **THEN** la petición se rechaza y no se crea participante

#### Scenario: Secreto no guardado

- **WHEN** un invitado entra y se lee la fila del participante creado
- **THEN** la fila no contiene el valor de la cookie

### Requirement: Un participante ya identificado no se duplica

Si la petición para entrar trae una cookie de participante válida para ese álbum, la API SHALL devolver ese participante sin crear otro, sin cambiar su nombre y sin reemplazar su cookie. Una cookie de participante solo SHALL identificar a su participante en su propio álbum: en otro álbum SHALL tratarse como ausente. Una cookie cuyo secreto no corresponde a ningún participante SHALL tratarse como ausente.

#### Scenario: Doble envío

- **WHEN** un participante con su cookie vuelve a enviar un nombre al mismo álbum
- **THEN** la respuesta devuelve su nombre original y el álbum sigue teniendo un solo participante suyo

#### Scenario: Cookie de otro álbum

- **WHEN** un participante del álbum X consulta el enlace del álbum Y
- **THEN** la respuesta indica que no hay participante

#### Scenario: Cookie alterada

- **WHEN** se consulta un token vigente con una cookie de participante cuyo valor no corresponde a ningún participante
- **THEN** la respuesta indica que no hay participante

### Requirement: Un participante no recupera su identidad por el nombre

La API SHALL NOT ofrecer ninguna forma de reanudar un participante existente a partir de su nombre. Un invitado sin la cookie, aunque use el mismo nombre que un participante existente, SHALL ser un participante nuevo.

#### Scenario: Otro navegador con el mismo nombre

- **WHEN** un participante llamado "Ana" abre el enlace en otro navegador y entra como "Ana"
- **THEN** se crea un participante nuevo y el participante original conserva sus datos

### Requirement: La interfaz del invitado pide el nombre y lo reconoce al volver

Al abrir `/a/<token>`, la interfaz SHALL mostrar el título del álbum. Si el invitado no está identificado, SHALL mostrar una pantalla en español que:

- indique que lo invitaron a votar y cuántas fotos tiene el álbum;
- pida su nombre;
- avise que quien creó el álbum verá su nombre junto a sus votos;
- aclare que no necesita crear una cuenta y que su avance se guarda.

Tras entrar, o si ya estaba identificado, SHALL llevarlo a la votación del álbum con su nombre, sin volver a pedirlo. Un enlace desconocido o revocado SHALL mostrar un mensaje de enlace no válido, sin pedir nombre. La pantalla del invitado SHALL NOT exigir sesión de dueño ni ofrecer acciones del dueño, y SHALL verse bien en ancho de teléfono.

#### Scenario: Primera visita

- **WHEN** un invitado sin cookie abre un enlace vigente
- **THEN** ve el título del álbum, la cantidad de fotos y un campo para su nombre

#### Scenario: Entrar lleva a votar

- **WHEN** un invitado envía su nombre en un álbum con fotos
- **THEN** ve el mazo de votación con su nombre, empezando por la primera foto

#### Scenario: Volver

- **WHEN** un invitado que ya entró cierra el navegador y abre de nuevo el enlace
- **THEN** ve la votación del álbum con su nombre, sin que se le pida otra vez

#### Scenario: Enlace no válido

- **WHEN** alguien abre `/a/` con un token desconocido o revocado
- **THEN** ve un mensaje de enlace no válido y ningún campo de nombre

#### Scenario: Error de nombre en la interfaz

- **WHEN** el invitado envía un nombre de más de 50 caracteres
- **THEN** la pantalla muestra un mensaje de error en español y conserva lo escrito
