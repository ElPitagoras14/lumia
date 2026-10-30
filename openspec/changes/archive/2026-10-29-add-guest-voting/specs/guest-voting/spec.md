## Purpose

Define cómo un invitado ya identificado califica las fotos de un álbum compartido con un voto binario, retoma su avance al volver y cambia sus votos, sin cuenta y sin perder nada al cerrar el navegador.

## ADDED Requirements

### Requirement: El invitado consulta las fotos del álbum con su voto

Con un token vigente y una cookie de participante válida para ese álbum, la API SHALL devolver todas las fotos del álbum en orden de subida. Para cada foto SHALL incluir un identificador, las URLs firmadas de sus variantes de miniatura, mazo y visor, y el voto de ese participante: a favor, en contra o pendiente si no votó. La respuesta SHALL NOT incluir los votos de otros participantes, la clave de almacenamiento del original, el tamaño del archivo ni el identificador interno del álbum. Sin una cookie de participante válida para ese álbum, la respuesta SHALL ser 401. Un token desconocido o revocado SHALL responder 404 igual que al resolver el enlace, haya o no cookie.

#### Scenario: Fotos con el voto propio

- **WHEN** un participante que votó a favor la primera foto de un álbum de tres consulta las fotos
- **THEN** recibe las tres fotos en orden de subida
- **AND** la primera indica a favor y las otras dos indican pendiente

#### Scenario: Los votos de otros no se ven

- **WHEN** el participante A votó en contra una foto y el participante B, que no la votó, consulta las fotos
- **THEN** esa foto figura como pendiente para B

#### Scenario: Sin cookie de participante

- **WHEN** alguien consulta las fotos de un token vigente sin cookie, o con la cookie de un participante de otro álbum
- **THEN** la respuesta es 401 y no incluye fotos

#### Scenario: Enlace revocado

- **WHEN** un participante con su cookie consulta las fotos usando un token que el dueño ya revocó
- **THEN** la respuesta es 404 con el mismo cuerpo que un token que nunca existió

#### Scenario: Álbum sin fotos

- **WHEN** un participante consulta las fotos de un álbum vacío
- **THEN** la respuesta es una lista vacía

### Requirement: El invitado vota una foto y puede cambiar su voto

Con un token vigente y una cookie de participante válida, la API SHALL aceptar en JSON un voto booleano para una foto del álbum: verdadero es a favor, falso es en contra. El voto SHALL guardarse en el servidor antes de responder, y la respuesta SHALL devolver la foto con su voto guardado. Si el participante ya había votado esa foto, el voto nuevo SHALL reemplazar al anterior sin conservar historial. Repetir el mismo voto SHALL dejar el mismo estado. Un valor ausente o que no sea booleano SHALL responder 422 nombrando el campo `approved`, sin modificar el voto existente. Una foto que no existe o que pertenece a otro álbum SHALL responder 404 sin crear voto. Sin cookie de participante válida para el álbum, la respuesta SHALL ser 401, y un token desconocido o revocado SHALL responder 404. Un cuerpo que no sea JSON SHALL rechazarse sin guardar voto. La API SHALL NOT ofrecer una forma de borrar un voto para volver a pendiente.

#### Scenario: Votar

- **WHEN** un participante vota a favor una foto pendiente
- **THEN** la respuesta indica a favor para esa foto
- **AND** al consultar las fotos de nuevo, esa foto indica a favor

#### Scenario: Cambiar el voto

- **WHEN** un participante que votó a favor una foto la vota en contra
- **THEN** la foto indica en contra y existe un único voto de ese participante para esa foto

#### Scenario: Voto repetido

- **WHEN** un participante envía dos veces el mismo voto para la misma foto
- **THEN** ambas respuestas son exitosas y existe un único voto

#### Scenario: Valor inválido

- **WHEN** un participante envía como voto el texto "sí", el número 1 o un cuerpo sin el campo
- **THEN** la respuesta es 422, nombra el campo `approved` y el voto anterior, si había, no cambia

#### Scenario: Foto de otro álbum

- **WHEN** un participante del álbum X vota, con el token de X, el identificador de una foto del álbum Y
- **THEN** la respuesta es 404 y no se crea ningún voto

#### Scenario: Foto borrada

- **WHEN** el dueño borra una foto y después un participante intenta votarla
- **THEN** la respuesta es 404

#### Scenario: Sin cookie

- **WHEN** alguien sin cookie de participante intenta votar una foto de un token vigente
- **THEN** la respuesta es 401 y no se crea ningún voto

#### Scenario: Cuerpo de formulario

- **WHEN** se envía el voto como formulario en vez de JSON
- **THEN** la petición se rechaza y no se guarda voto

### Requirement: El avance del invitado se conserva y se retoma

El avance de un participante SHALL derivarse de los votos guardados en el servidor: fotos calificadas sobre fotos del álbum. Al volver con su cookie, desde el mismo navegador y aunque lo haya cerrado, el invitado SHALL retomar el mazo en la primera foto sin calificar en orden de subida. Si el dueño sube fotos después de que el participante terminó, esas fotos SHALL aparecer como pendientes y el mazo SHALL ofrecerlas. Si el dueño borra una foto, SHALL dejar de contar para el avance.

#### Scenario: Volver a mitad del mazo

- **WHEN** un participante calificó 7 de 24 fotos, cierra el navegador y vuelve a abrir el enlace
- **THEN** el mazo muestra la foto 8 y el avance indica 7 de 24

#### Scenario: Fotos nuevas tras terminar

- **WHEN** un participante calificó todas las fotos y el dueño sube dos más
- **THEN** al volver, el avance indica las dos nuevas como pendientes y el mazo las muestra

#### Scenario: Votos salteados

- **WHEN** un participante calificó las fotos 1, 2 y 4 desde el visor, pero no la 3
- **THEN** el mazo retoma en la foto 3

### Requirement: La interfaz del invitado ofrece un mazo de swipe

Un invitado identificado en un álbum con fotos pendientes SHALL ver un mazo con una foto a la vez, usando la variante de mazo, en orden de subida y empezando por la primera pendiente. Deslizar la carta a la derecha SHALL votar "me gusta" y deslizarla a la izquierda SHALL votar "no me gusta". Un deslizamiento corto SHALL devolver la carta a su lugar sin votar. El mazo SHALL ofrecer además botones "Me gusta" y "No me gusta", accesibles por teclado y con nombre accesible, y las flechas derecha e izquierda del teclado SHALL votar igual que deslizar. Mientras se arrastra, la carta SHALL indicar qué voto se está por emitir. El mazo SHALL mostrar el título del álbum, el nombre del invitado, el avance "N de M" con una barra de progreso y un acceso a "Mis votos". Tocar la carta SHALL abrir la foto en el visor. La interfaz SHALL precargar las siguientes fotos del mazo para que la siguiente carta aparezca sin espera visible. Si guardar un voto falla, la interfaz SHALL avisarlo en español y SHALL NOT darlo por guardado. Los textos SHALL estar en español y la pantalla SHALL funcionar con el tacto en ancho de teléfono.

#### Scenario: Votar deslizando

- **WHEN** el invitado desliza la carta de la foto 8 hacia la derecha más allá del umbral
- **THEN** la foto 8 queda votada "me gusta", aparece la siguiente pendiente y el avance sube en uno

#### Scenario: Deslizamiento corto

- **WHEN** el invitado arrastra la carta un poco y la suelta antes del umbral
- **THEN** la carta vuelve a su lugar y no se guarda ningún voto

#### Scenario: Votar con botones o teclado

- **WHEN** el invitado pulsa "No me gusta" o la flecha izquierda
- **THEN** la foto actual queda votada "no me gusta" y aparece la siguiente pendiente

#### Scenario: Fallo al guardar

- **WHEN** el servidor no responde al guardar un voto
- **THEN** la interfaz muestra un aviso en español y la foto sigue pendiente

#### Scenario: Álbum vacío

- **WHEN** un invitado identificado abre un álbum sin fotos
- **THEN** ve un aviso de que el álbum todavía no tiene fotos, sin mazo

### Requirement: El invitado revisa y cambia sus votos

La interfaz SHALL ofrecer una vista "Mis votos" con todas las fotos del álbum en orden de subida, como miniaturas que indiquen si cada una es "me gusta", "no me gusta" o pendiente. La vista SHALL ofrecer filtros Todas, Me gusta, No me gusta y Pendientes, con la cantidad de fotos de cada uno. Tocar una miniatura SHALL abrir el visor. Si quedan fotos pendientes, la vista SHALL ofrecer volver al mazo indicando cuántas quedan. El visor SHALL mostrar la foto con la variante de visor, su posición "N / M", el voto actual y botones "Me gusta" y "No me gusta" que indiquen cuál está elegido. Elegir el otro voto SHALL reemplazar el anterior. El visor SHALL permitir pasar a la foto anterior y a la siguiente dentro de la lista que se estaba viendo, y cerrarse para volver a donde se abrió. Los textos SHALL estar en español y las miniaturas SHALL tener un nombre accesible con su número y su estado.

#### Scenario: Filtrar

- **WHEN** un invitado con 5 "me gusta", 2 "no me gusta" y 17 pendientes abre "Mis votos" y elige "Pendientes"
- **THEN** ve solo las 17 fotos pendientes y los filtros muestran 24, 5, 2 y 17

#### Scenario: Cambiar un voto desde el visor

- **WHEN** el invitado abre en el visor una foto votada "me gusta" y elige "No me gusta"
- **THEN** la foto queda votada "no me gusta" y el visor marca ese botón como elegido
- **AND** los contadores de "Mis votos" se actualizan

#### Scenario: Votar una pendiente desde el visor

- **WHEN** el invitado abre en el visor una foto pendiente y elige "Me gusta"
- **THEN** la foto queda votada "me gusta" y el mazo ya no la ofrece

### Requirement: El invitado ve una pantalla final al terminar

Cuando un invitado identificado no tiene fotos pendientes en un álbum con fotos, la interfaz SHALL mostrar, en lugar del mazo, una pantalla "¡Listo, <nombre>!" que indique cuántas fotos calificó del álbum y cuántas votó "me gusta" y "no me gusta". La pantalla SHALL ofrecer ir a "Mis votos" y SHALL avisar que puede volver con el mismo enlace a cambiar sus votos. Al volver con su cookie después de haber terminado, el invitado SHALL ver esta misma pantalla.

#### Scenario: Terminar el mazo

- **WHEN** una invitada llamada María vota la última foto pendiente de un álbum de 24 fotos, con 15 "me gusta" y 9 "no me gusta"
- **THEN** ve "¡Listo, María!", que calificó las 24 fotos y los totales 15 y 9

#### Scenario: Volver tras terminar

- **WHEN** un invitado que ya calificó todas las fotos abre de nuevo el enlace
- **THEN** ve la pantalla final, no el mazo
