## MODIFIED Requirements

### Requirement: La interfaz del dueño permite compartir, copiar y revocar

La pantalla de un álbum del dueño SHALL ofrecer una acción "Compartir" que muestre el enlace completo del álbum, listo para copiar, y cuántas personas entraron. La acción SHALL ser un botón de icono en la barra superior de la pantalla, con el nombre accesible "Compartir" y un tooltip con el mismo texto al pasar el puntero o enfocarlo con el teclado, y SHALL estar disponible tanto en "Fotos" como en "Resultados". Si el álbum no tiene enlace, SHALL ofrecer generarlo. Si lo tiene, SHALL ofrecer revocarlo y crear uno nuevo, con una confirmación previa que avise que el enlace actual dejará de funcionar. Copiar SHALL confirmar visualmente que se copió; si el navegador no permite copiar, el enlace SHALL quedar visible y seleccionable. La lista de álbumes SHALL indicar en cada álbum si tiene un enlace activo. Los textos SHALL estar en español.

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

#### Scenario: Compartir desde la barra superior

- **WHEN** el dueño, en "Fotos" o en "Resultados", activa el botón de icono "Compartir" de la barra superior
- **THEN** se abre el diálogo de compartir del álbum

#### Scenario: Compartir es descubrible sin texto visible

- **WHEN** el dueño pasa el puntero sobre el botón de icono "Compartir" o lo enfoca con el teclado
- **THEN** ve un tooltip "Compartir"
- **AND** un lector de pantalla lo anuncia como "Compartir"
