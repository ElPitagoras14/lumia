## MODIFIED Requirements

### Requirement: La interfaz del dueño muestra los resultados del álbum

La pantalla de un álbum del dueño SHALL ofrecer dos pestañas de navegación, "Fotos" y "Resultados", con la pestaña activa marcada visualmente (subrayada) y anunciada como la vista actual a los lectores de pantalla. Las pestañas SHALL navegar entre vistas y SHALL NOT presentarse como botones de acción. La vista elegida SHALL conservarse al recargar y al usar el botón "atrás".

La acción "Subir fotos" SHALL ser un botón flotante extendido, con un icono "+" y el texto "Subir fotos", fijo abajo a la derecha de la pantalla:

- SHALL mostrarse solo en la pestaña "Fotos"; "Resultados" SHALL NOT mostrar botón flotante.
- SHALL NOT mostrarse cuando el álbum tiene 50 fotos; en su lugar, la pantalla SHALL indicar "El álbum está lleno.".
- La grilla de fotos SHALL reservar espacio inferior suficiente para que, al llegar al final, el botón no tape ninguna foto ni su botón de borrar.

"Resultados" SHALL mostrar:

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

#### Scenario: Cambiar de pestaña

- **WHEN** el dueño está en "Fotos" y toca la pestaña "Resultados"
- **THEN** ve los resultados, la pestaña "Resultados" queda marcada como activa
- **AND** al usar "atrás" vuelve a "Fotos"

#### Scenario: Subir fotos desde el botón flotante

- **WHEN** el dueño está en "Fotos" en un álbum con menos de 50 fotos y toca "Subir fotos"
- **THEN** se abre el diálogo para subir fotos

#### Scenario: Sin botón flotante en resultados

- **WHEN** el dueño está en "Resultados"
- **THEN** no ve el botón flotante "Subir fotos"

#### Scenario: Álbum lleno

- **WHEN** el dueño abre "Fotos" en un álbum con 50 fotos
- **THEN** no ve el botón flotante "Subir fotos" y ve el aviso "El álbum está lleno."

#### Scenario: El botón flotante no tapa la última fila

- **WHEN** el dueño, en un teléfono, baja hasta el final de la grilla de un álbum con fotos
- **THEN** la última fila de fotos y sus botones de borrar quedan visibles por encima del botón flotante
