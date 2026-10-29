## Purpose

Define cómo el dueño abre un álbum suyo a otras personas mediante un enlace, cómo lo reemplaza cuando quiere cortar el acceso de quien todavía no entró, y qué ve del estado de ese enlace.

## ADDED Requirements

### Requirement: El dueño genera el enlace de un álbum propio

El dueño con sesión SHALL poder generar el enlace de compartir de uno de sus álbumes. La respuesta SHALL incluir el token del enlace. El token SHALL ser aleatorio, no derivado del álbum ni del dueño, y SHALL poder usarse tal cual dentro de una URL. Un álbum de otro dueño o inexistente SHALL responderse exactamente igual: 404, con el mismo código y el mismo mensaje, sin crear ningún enlace.

#### Scenario: Primer enlace

- **WHEN** el dueño genera el enlace de un álbum suyo que no tiene enlace
- **THEN** la respuesta incluye un token
- **AND** abrir ese token como invitado lleva a ese álbum

#### Scenario: Álbum ajeno o inexistente

- **WHEN** el dueño genera el enlace de un álbum de otro dueño y, aparte, de un álbum inexistente
- **THEN** ambas respuestas son 404 con el mismo cuerpo y no se crea ningún enlace

#### Scenario: Sin sesión

- **WHEN** se intenta generar un enlace sin una sesión válida
- **THEN** la respuesta es 401 y no se crea ningún enlace

### Requirement: Generar de nuevo revoca el enlace anterior

Generar el enlace de un álbum que ya tiene uno SHALL reemplazarlo por uno con un token distinto, en una sola operación. Desde ese momento, el token anterior SHALL tratarse como inexistente. Los participantes del álbum y sus votos SHALL conservarse, y un participante con su cookie SHALL ser reconocido al entrar por el enlace nuevo. Dos peticiones simultáneas de generar SHALL dejar el álbum con un único enlace.

#### Scenario: Revocar

- **WHEN** el dueño genera el enlace de un álbum que ya tenía uno
- **THEN** la respuesta incluye un token distinto del anterior
- **AND** abrir el token anterior como invitado responde igual que un token que nunca existió

#### Scenario: Participantes tras revocar

- **WHEN** un participante ya entró al álbum y el dueño revoca el enlace
- **THEN** el participante y sus votos siguen existiendo
- **AND** al abrir el enlace nuevo con su cookie, el participante es reconocido sin pedirle el nombre

#### Scenario: Peticiones simultáneas

- **WHEN** llegan dos peticiones de generar el enlace del mismo álbum a la vez
- **THEN** el álbum queda con un único enlace, cuyo token es el de una de las dos respuestas

### Requirement: El dueño ve el estado del enlace y cuántos entraron

Cada álbum que el dueño lista o consulta SHALL indicar el token de su enlace, o que no tiene enlace, y cuántos participantes tiene. La cantidad de participantes SHALL contar a todos los del álbum, hayan entrado por el enlace actual o por uno revocado.

#### Scenario: Álbum sin enlace

- **WHEN** el dueño consulta un álbum al que nunca le generó enlace
- **THEN** el álbum indica que no tiene enlace y cero participantes

#### Scenario: Álbum con enlace y participantes

- **WHEN** el dueño lista sus álbumes y uno tiene enlace y dos participantes
- **THEN** ese álbum indica el token de su enlace y dos participantes

#### Scenario: Participantes de un enlace revocado

- **WHEN** dos participantes entraron por un enlace que luego se revocó y uno más por el nuevo
- **THEN** el álbum indica tres participantes

### Requirement: La interfaz del dueño permite compartir, copiar y revocar

La pantalla de un álbum del dueño SHALL ofrecer una acción "Compartir" que muestre el enlace completo del álbum, listo para copiar, y cuántas personas entraron. Si el álbum no tiene enlace, SHALL ofrecer generarlo. Si lo tiene, SHALL ofrecer revocarlo y crear uno nuevo, con una confirmación previa que avise que el enlace actual dejará de funcionar. Copiar SHALL confirmar visualmente que se copió; si el navegador no permite copiar, el enlace SHALL quedar visible y seleccionable. La lista de álbumes SHALL indicar en cada álbum si tiene un enlace activo. Los textos SHALL estar en español.

#### Scenario: Generar desde la interfaz

- **WHEN** el dueño abre "Compartir" en un álbum sin enlace y lo genera
- **THEN** la interfaz muestra el enlace completo del álbum y la opción de copiarlo

#### Scenario: Revocar desde la interfaz

- **WHEN** el dueño elige revocar el enlace y confirma
- **THEN** la interfaz muestra un enlace distinto del anterior

#### Scenario: Cancelar la revocación

- **WHEN** el dueño elige revocar el enlace y cancela la confirmación
- **THEN** el enlace sigue siendo el mismo

#### Scenario: Insignia en la lista

- **WHEN** el dueño ve su lista con un álbum con enlace y otro sin enlace
- **THEN** el primero indica que tiene enlace activo y el segundo que no tiene enlace
