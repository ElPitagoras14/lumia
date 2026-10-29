## Purpose

Define cómo existe la cuenta del dueño, cómo inicia y cierra sesión, cuánto dura una sesión y cómo se protegen sus rutas, de modo que toda operación del dueño se resuelva contra el usuario de la sesión y nunca contra un usuario fijo.

## ADDED Requirements

### Requirement: La cuenta del dueño se crea una sola vez desde la configuración

Al arrancar, si no existe ningún usuario, el backend SHALL crear uno con el email y la contraseña de la configuración. Si ya existe al menos un usuario, el arranque SHALL NOT crear, modificar ni borrar usuarios, aunque la configuración haya cambiado. El email y la contraseña del dueño SHALL ser variables obligatorias. La contraseña SHALL tener entre 8 caracteres y 72 bytes, y un valor fuera de ese rango SHALL detener el arranque. La contraseña SHALL guardarse solo como hash de contraseña, nunca en claro.

#### Scenario: Primer arranque

- **WHEN** el backend arranca con una base sin usuarios
- **THEN** existe un único usuario con el email configurado, y su contraseña configurada permite iniciar sesión

#### Scenario: Arranque posterior con otra contraseña

- **WHEN** ya existe el usuario del dueño y el backend arranca con otra contraseña en la configuración
- **THEN** la contraseña anterior sigue siendo la válida y la nueva es rechazada

#### Scenario: Variable ausente

- **WHEN** el backend arranca sin el email o sin la contraseña del dueño
- **THEN** el arranque falla con un error que nombra la variable que falta

#### Scenario: Contraseña demasiado corta

- **WHEN** el backend arranca con una contraseña del dueño de 7 caracteres
- **THEN** el arranque falla con un error que nombra la variable

#### Scenario: Contraseña no guardada en claro

- **WHEN** se lee la fila del usuario sembrado
- **THEN** no contiene la contraseña configurada en claro

### Requirement: El dueño inicia sesión con email y contraseña

La API SHALL aceptar un email y una contraseña en JSON. Si corresponden a un usuario, SHALL abrir una sesión nueva, devolver el usuario (identificador y email) y entregar el secreto de la sesión en una cookie `HttpOnly` con `SameSite=Lax`. El email SHALL compararse sin distinguir mayúsculas de minúsculas. Si el email no existe o la contraseña no coincide, la API SHALL responder 401 con el mismo mensaje en ambos casos y SHALL NOT entregar cookie. Un cuerpo que no sea JSON o al que le falten campos SHALL rechazarse sin abrir sesión.

#### Scenario: Credenciales correctas

- **WHEN** se inicia sesión con el email y la contraseña del dueño
- **THEN** la respuesta es exitosa, incluye el email del usuario y entrega una cookie de sesión `HttpOnly` y `SameSite=Lax`

#### Scenario: Email con otras mayúsculas

- **WHEN** se inicia sesión con el email del dueño escrito con otras mayúsculas y la contraseña correcta
- **THEN** la sesión se abre

#### Scenario: Contraseña incorrecta

- **WHEN** se inicia sesión con el email del dueño y otra contraseña
- **THEN** la respuesta es 401 y no entrega cookie de sesión

#### Scenario: Email inexistente

- **WHEN** se inicia sesión con un email que no corresponde a ningún usuario
- **THEN** la respuesta es 401 con el mismo mensaje que para una contraseña incorrecta

#### Scenario: Cuerpo de formulario

- **WHEN** se envían las credenciales correctas como formulario en vez de JSON
- **THEN** la petición se rechaza y no se abre sesión

### Requirement: Las sesiones expiran y su secreto solo vive en la cookie

Cada inicio de sesión SHALL crear una sesión independiente con un secreto aleatorio nuevo, de modo que el dueño pueda tener varias abiertas a la vez (por ejemplo, teléfono y computadora). La base SHALL guardar solo un resumen del secreto. Una sesión SHALL expirar 30 días después de abrirse, sin renovarse con el uso, y la cookie SHALL tener la misma duración. Una sesión expirada SHALL tratarse como inexistente.

#### Scenario: Dos sesiones simultáneas

- **WHEN** el dueño inicia sesión dos veces
- **THEN** ambas cookies identifican al dueño, y cerrar una no cierra la otra

#### Scenario: Sesión expirada

- **WHEN** se usa la cookie de una sesión cuya fecha de expiración ya pasó
- **THEN** la petición se trata como sin sesión

#### Scenario: Secreto no guardado

- **WHEN** se inicia sesión y se lee la fila de la sesión creada
- **THEN** la fila no contiene el valor de la cookie

### Requirement: Las rutas del dueño exigen una sesión válida y se resuelven contra su usuario

Toda ruta del dueño SHALL identificar al usuario únicamente a partir de la sesión de la petición. Sin cookie, con un secreto desconocido o con una sesión expirada, SHALL responder 401 sin ejecutar la operación. La API SHALL ofrecer una ruta que devuelva el usuario de la sesión actual (identificador y email).

#### Scenario: Usuario actual

- **WHEN** se consulta el usuario actual con una cookie de sesión válida
- **THEN** la respuesta contiene el email del dueño

#### Scenario: Sin cookie

- **WHEN** se consulta el usuario actual sin cookie de sesión
- **THEN** la respuesta es 401

#### Scenario: Secreto alterado

- **WHEN** se consulta el usuario actual con una cookie cuyo valor no corresponde a ninguna sesión
- **THEN** la respuesta es 401

#### Scenario: Dos usuarios

- **WHEN** existen dos usuarios y cada uno consulta el usuario actual con su propia cookie
- **THEN** cada uno recibe su propio email

### Requirement: El dueño cierra sesión

La API SHALL ofrecer una ruta para cerrar sesión que elimine la sesión de la petición y borre la cookie. Cerrar sesión sin una sesión válida SHALL responder con éxito igualmente.

#### Scenario: Cerrar sesión

- **WHEN** el dueño cierra sesión y después consulta el usuario actual con la misma cookie
- **THEN** la segunda consulta responde 401

#### Scenario: Cerrar sesión sin sesión

- **WHEN** se cierra sesión sin cookie
- **THEN** la respuesta es exitosa

### Requirement: La contraseña se restablece con un comando del backend

El backend SHALL ofrecer un comando de línea de comandos que reciba un email, pida la contraseña nueva dos veces sin mostrarla y la guarde para ese usuario. La contraseña nueva SHALL cumplir los mismos límites que la del sembrado. Al cambiarla, el comando SHALL cerrar todas las sesiones abiertas de ese usuario. Si el email no existe, si las dos entradas no coinciden o si la contraseña no cumple los límites, el comando SHALL terminar con un código distinto de cero sin modificar nada.

#### Scenario: Restablecer la contraseña

- **WHEN** se ejecuta el comando con el email del dueño y una contraseña nueva válida
- **THEN** la contraseña nueva permite iniciar sesión, la anterior no, y las sesiones abiertas antes del cambio responden 401

#### Scenario: Email inexistente

- **WHEN** se ejecuta el comando con un email que no corresponde a ningún usuario
- **THEN** el comando termina con error y ningún usuario cambia

#### Scenario: Confirmación distinta

- **WHEN** las dos entradas de la contraseña nueva no coinciden
- **THEN** el comando termina con error y la contraseña anterior sigue siendo válida

### Requirement: La interfaz exige iniciar sesión para el área del dueño

La interfaz SHALL ofrecer una pantalla de inicio de sesión en español con email y contraseña. Al abrir una pantalla del dueño sin sesión válida, la interfaz SHALL llevar a la pantalla de inicio de sesión y, tras iniciarla, volver a la pantalla pedida. Las credenciales rechazadas SHALL mostrar un mensaje de error sin borrar el email escrito. La interfaz SHALL ofrecer una acción para cerrar sesión que vuelva a la pantalla de inicio de sesión.

#### Scenario: Entrar sin sesión

- **WHEN** se abre la página de inicio del dueño sin sesión
- **THEN** se muestra la pantalla de inicio de sesión

#### Scenario: Iniciar sesión

- **WHEN** se ingresan las credenciales correctas en la pantalla de inicio de sesión
- **THEN** se muestra la pantalla del dueño que se había pedido

#### Scenario: Credenciales rechazadas

- **WHEN** se ingresa una contraseña incorrecta
- **THEN** la pantalla muestra un mensaje de error en español y conserva el email

#### Scenario: Cerrar sesión desde la interfaz

- **WHEN** el dueño usa la acción de cerrar sesión
- **THEN** la interfaz muestra la pantalla de inicio de sesión, y volver a la página del dueño la pide de nuevo
