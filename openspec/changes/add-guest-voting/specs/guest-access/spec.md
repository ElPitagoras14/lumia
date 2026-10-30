## MODIFIED Requirements

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
