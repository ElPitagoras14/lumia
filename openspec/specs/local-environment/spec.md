# local-environment

## Purpose

Gobierna cómo se levanta Lumia completo en una máquina: qué servicios lo componen, por dónde entra el tráfico, qué se expone al host y dónde persisten los datos. No cubre cómo se entrega la interfaz (`frontend-delivery`), cómo se migra la base (`database-migrations`) ni cómo se sirven las imágenes (`image-delivery`).

## Requirements

### Requirement: El entorno completo se levanta con un comando y sin cuentas externas

El entorno completo SHALL levantarse con un único comando a partir de un clon limpio y de un archivo de entorno copiado del ejemplo del repositorio. SHALL NOT requerir cuentas, claves ni servicios de terceros, ni pasos manuales adicionales.

#### Scenario: Arranque desde un clon limpio

- **WHEN** se copia el archivo de entorno de ejemplo y se ejecuta el comando de arranque documentado
- **THEN** el paso de migración termina con éxito y los cuatro servicios quedan en ejecución
- **AND** la aplicación carga en el navegador en la dirección documentada

#### Scenario: Sin acceso a servicios de terceros

- **WHEN** se levanta el entorno con las imágenes ya descargadas y sin conexión a internet
- **THEN** la aplicación carga y la API responde igual

### Requirement: El navegador entra por una única puerta

Todo el tráfico del navegador SHALL entrar por un único servicio de entrada, que reparte las rutas reservadas a la API hacia el backend, las rutas reservadas a imágenes hacia el servicio de transformación y el resto hacia la interfaz. La interfaz, la API y las imágenes SHALL compartir origen.

#### Scenario: La API se alcanza por la puerta de entrada

- **WHEN** el navegador pide el healthcheck de la API en el origen de la aplicación
- **THEN** la respuesta proviene del backend

#### Scenario: Sin peticiones de origen cruzado

- **WHEN** la interfaz se comunica con la API
- **THEN** no se emiten peticiones de verificación previa de origen cruzado

### Requirement: La ruta de la API se entrega al backend sin cambios ni fallback

La ruta que el backend recibe SHALL ser idéntica a la que pidió el navegador, prefijo incluido. Si el backend no responde, la puerta de entrada SHALL devolver un error de gateway. SHALL NOT devolver el documento de la interfaz en su lugar.

#### Scenario: El prefijo llega intacto

- **WHEN** el navegador pide una ruta de la API
- **THEN** el backend recibe la misma ruta, con el prefijo de la API incluido

#### Scenario: Backend caído

- **WHEN** el backend está detenido y se pide una ruta de la API
- **THEN** la respuesta es un error de gateway
- **AND** no es el documento de la interfaz con una respuesta satisfactoria

### Requirement: Solo la puerta de entrada se expone al host

La puerta de entrada SHALL ser el único servicio que publica un puerto al host, y ese puerto SHALL poder cambiarse con una variable de entorno. El backend, la interfaz y el servicio de transformación SHALL NOT ser alcanzables desde el host sin pasar por la puerta de entrada.

#### Scenario: Servicios internos inalcanzables

- **WHEN** se intenta alcanzar desde el host el backend, la interfaz o el servicio de transformación por un puerto propio
- **THEN** la conexión no se establece

#### Scenario: Cambiar el puerto publicado

- **WHEN** se cambia la variable del puerto de entrada y se vuelve a levantar el entorno
- **THEN** la aplicación queda accesible en el puerto nuevo sin editar la declaración de servicios

### Requirement: Los datos persisten en un único volumen

La base de datos y los archivos originales SHALL vivir en un único volumen de datos que sobrevive a detener, recrear y volver a levantar los servicios. El backend y el paso de migración SHALL montarlo con lectura y escritura, y el servicio de transformación SHALL montarlo en solo lectura.

#### Scenario: Los datos sobreviven a recrear los servicios

- **WHEN** se escribe en la base, se recrean los servicios y se vuelve a levantar el entorno
- **THEN** el dato escrito sigue presente

#### Scenario: El servicio de transformación no puede escribir

- **WHEN** el servicio de transformación intenta escribir en el volumen de datos
- **THEN** la escritura falla

### Requirement: Las imágenes de terceros llevan versión exacta

Toda imagen de contenedor de terceros SHALL referenciarse con una versión exacta. SHALL NOT usarse etiquetas móviles como `latest` o una etiqueta de familia mayor.

#### Scenario: Ninguna etiqueta móvil

- **WHEN** se revisan las imágenes base y de servicio declaradas en el repositorio
- **THEN** cada una lleva una versión exacta

### Requirement: El backend y la interfaz pueden correr fuera de contenedores con los mismos nombres de variable

El backend y la interfaz SHALL poder ejecutarse directamente en el host para desarrollar. El modo nativo SHALL usar los mismos nombres de variable de entorno que el modo en contenedores, cambiando solo sus valores. La interfaz en modo nativo SHALL seguir pidiendo la API por rutas relativas. El código SHALL NOT tener condiciones que distingan un modo del otro.

#### Scenario: Modo nativo funcional

- **WHEN** se aplican las migraciones y se ejecutan el backend y el servidor de desarrollo de la interfaz en el host con el perfil nativo
- **THEN** la interfaz carga y el healthcheck de la API responde a través del servidor de desarrollo

#### Scenario: Mismas variables en ambos modos

- **WHEN** se comparan los perfiles de configuración de ambos modos
- **THEN** declaran exactamente los mismos nombres de variable

### Requirement: El archivo de entorno de ejemplo solo declara variables con consumidor

El archivo de entorno de ejemplo SHALL declarar todas las variables que el entorno necesita para arrancar. SHALL NOT declarar variables que ningún servicio o código consuma todavía.

#### Scenario: Toda variable tiene consumidor

- **WHEN** se recorre cada variable del archivo de ejemplo
- **THEN** cada una es leída por un servicio o por el código

#### Scenario: Una variable requerida ausente detiene el arranque

- **WHEN** el backend arranca sin una variable requerida
- **THEN** el arranque falla con un error que nombra esa variable
