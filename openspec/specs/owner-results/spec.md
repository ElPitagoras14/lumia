# owner-results Specification

## Purpose

Permite al dueño ver cómo votaron los invitados en un álbum propio (por foto, por persona y en detalle) y quitar participantes junto con sus votos.

## Requirements

### Requirement: El dueño consulta los resultados de un álbum propio

El dueño SHALL poder consultar los resultados de un álbum suyo. La respuesta SHALL incluir:

- **Resumen:**
  - la cantidad de participantes;
  - la cantidad de votos emitidos;
  - la cantidad de votos posibles (fotos × participantes).
- **Fotos:** en orden de subida. Cada una con su miniatura firmada, la cantidad de votos a favor, la de votos en contra y la de participantes que la tienen pendiente.
- **Participantes:** en orden de entrada. Cada uno con su identificador, su nombre, la cantidad de fotos que calificó y sus votos a favor y en contra.

Un par (foto, participante) sin voto SHALL contarse como pendiente, nunca como a favor ni como en contra. En cada foto, a favor + en contra + pendientes SHALL ser igual a la cantidad de participantes. En cada participante, las fotos calificadas SHALL ser igual a sus votos a favor + en contra, y nunca más que las fotos del álbum.

La consulta SHALL contar a todos los participantes del álbum, hayan entrado por el enlace actual o por uno revocado. La respuesta SHALL NOT incluir el token de cookie de ningún participante.

#### Scenario: Álbum con votos

- **WHEN** un álbum tiene 3 fotos y 2 participantes, María votó las 3 (2 a favor y 1 en contra) y Luis votó solo la primera, a favor
- **THEN** el resumen indica 2 participantes, 4 votos emitidos y 6 posibles
- **AND** la primera foto tiene 2 a favor, 0 en contra y 0 pendientes
- **AND** Luis figura con 1 foto calificada de 3

#### Scenario: Álbum sin participantes

- **WHEN** el dueño consulta los resultados de un álbum con fotos y sin participantes
- **THEN** el resumen indica 0 participantes y 0 votos posibles, y cada foto tiene 0 a favor, 0 en contra y 0 pendientes

#### Scenario: Álbum sin fotos

- **WHEN** el dueño consulta los resultados de un álbum sin fotos y con un participante
- **THEN** la lista de fotos está vacía y el participante figura con 0 fotos calificadas

#### Scenario: Participante de un enlace revocado

- **WHEN** un participante votó antes de que el dueño revocara el enlace
- **THEN** sus votos siguen contando en los resultados

### Requirement: El dueño ve qué votó cada participante

El dueño SHALL poder consultar los votos de un participante de un álbum suyo. La respuesta SHALL listar todas las fotos del álbum en orden de subida, cada una con su miniatura firmada y el voto de ese participante: a favor, en contra o pendiente.

#### Scenario: Detalle de un participante

- **WHEN** el dueño consulta los votos de Luis, que votó a favor la primera de 3 fotos
- **THEN** la respuesta lista las 3 fotos: la primera a favor y las otras dos pendientes

#### Scenario: Participante de otro álbum

- **WHEN** el dueño consulta los votos de un participante usando el identificador de otro de sus álbumes
- **THEN** la respuesta es 404

### Requirement: El dueño borra un participante con sus votos

El dueño SHALL poder borrar un participante de un álbum suyo. Borrarlo SHALL borrar todos sus votos y SHALL dejar intactos los votos de los demás participantes. Después del borrado, la cookie que tenía esa persona SHALL dejar de identificarla. Si vuelve a abrir el enlace vigente, SHALL ver la pantalla de nombre y, si entra, SHALL ser un participante nuevo, sin votos.

El borrado SHALL exigir un método de escritura explícito. Repetirlo sobre un participante ya borrado SHALL responder 404.

#### Scenario: Borrar un participante

- **WHEN** el dueño borra a Luis, que tenía votos, en un álbum donde María también votó
- **THEN** Luis ya no figura en los resultados, sus votos ya no cuentan y los de María se conservan

#### Scenario: La persona borrada vuelve

- **WHEN** Luis abre de nuevo el enlace vigente con su cookie después de ser borrado
- **THEN** ve la pantalla de nombre y, si entra, es un participante nuevo con todas las fotos pendientes

#### Scenario: Borrar dos veces

- **WHEN** el dueño borra un participante que ya fue borrado
- **THEN** la respuesta es 404

### Requirement: Los resultados y los participantes solo se alcanzan desde el álbum del dueño

Las rutas de resultados, de votos de un participante y de borrado de participantes SHALL exigir una sesión de dueño válida (401 sin ella) y SHALL resolverse contra el usuario de esa sesión:

- Un álbum de otro dueño SHALL responderse exactamente igual que uno inexistente: 404, con el mismo código y el mismo mensaje.
- Un participante que no pertenece al álbum indicado SHALL responderse igual que uno inexistente.

Un participante, con su cookie de invitado, SHALL NOT poder consultar los resultados ni los votos de otros participantes.

#### Scenario: Sin sesión

- **WHEN** alguien sin sesión de dueño consulta los resultados de un álbum
- **THEN** la respuesta es 401

#### Scenario: Álbum de otro dueño

- **WHEN** un dueño consulta los resultados o borra un participante de un álbum de otro dueño
- **THEN** la respuesta es la misma que para un álbum inexistente y no se borra nada

#### Scenario: Participante de otro álbum

- **WHEN** el dueño intenta borrar, desde su álbum A, un participante que pertenece a su álbum B
- **THEN** la respuesta es 404 y el participante sigue existiendo en B

### Requirement: La interfaz del dueño muestra los resultados del álbum

La pantalla de un álbum del dueño SHALL ofrecer un selector entre "Fotos" y "Resultados". La vista elegida SHALL conservarse al recargar y al usar el botón "atrás". "Resultados" SHALL mostrar:

- **El resumen:** personas, votos emitidos de los posibles y porcentaje completado.
- **Un selector entre "Por foto" y "Por persona".**
- **"Por foto":**
  - Cada foto con su miniatura, su número de orden ("Foto N"), los votos a favor y en contra, y una barra proporcional.
  - Una nota "Todos votaron" o "N pendientes".
  - La barra SHALL tener un nombre accesible con los tres números.
  - SHALL poder ordenarse por "Más gustadas" (más votos a favor primero; ante empate, el orden de subida) y volver al orden de subida.
- **"Por persona":**
  - Cada participante con su inicial, su nombre, "N de M" fotos calificadas y una barra de avance con nombre accesible.
  - Sus votos a favor y en contra, y "Terminó" o "N pendientes".
  - Un botón para eliminarlo, con nombre accesible "Eliminar a <nombre> y sus votos".
- **Detalle de una persona:** al tocar un participante, una vista con las miniaturas del álbum y el voto de esa persona en cada una (me gusta, no me gusta o pendiente).

Eliminar un participante SHALL pedir confirmación, avisando que se borrarán sus votos y que no se puede deshacer. Cancelar SHALL dejarlo intacto. Tras confirmar, los resultados SHALL actualizarse sin recargar la página.

Un álbum sin participantes SHALL mostrar un aviso que invite a compartirlo, en lugar de las listas. Los textos SHALL estar en español y la vista SHALL verse bien en ancho de teléfono.

#### Scenario: Ver resultados

- **WHEN** el dueño abre un álbum con votos y elige "Resultados"
- **THEN** ve el resumen y la lista "Por foto" con los votos a favor, en contra y pendientes de cada foto

#### Scenario: Ordenar por más gustadas

- **WHEN** el dueño elige "Más gustadas" en "Por foto"
- **THEN** la foto con más votos a favor aparece primero

#### Scenario: Ver el avance por persona

- **WHEN** el dueño elige "Por persona" en un álbum de 24 fotos donde Ana calificó 20
- **THEN** Ana figura con "20 de 24" y "4 pendientes"

#### Scenario: Ver qué votó una persona

- **WHEN** el dueño toca a Ana en "Por persona"
- **THEN** ve cada foto del álbum con el voto de Ana o como pendiente

#### Scenario: Eliminar un participante desde la interfaz

- **WHEN** el dueño elige eliminar a Diego y confirma
- **THEN** Diego desaparece de la lista y el resumen y los totales por foto se recalculan

#### Scenario: Cancelar la eliminación

- **WHEN** el dueño elige eliminar a Diego y cancela la confirmación
- **THEN** Diego sigue en la lista con sus votos

#### Scenario: Recargar en resultados

- **WHEN** el dueño recarga la página estando en "Resultados" › "Por persona"
- **THEN** sigue viendo "Resultados" › "Por persona"

#### Scenario: Álbum sin participantes

- **WHEN** el dueño abre "Resultados" en un álbum al que nadie entró
- **THEN** ve un aviso que lo invita a compartir el álbum
