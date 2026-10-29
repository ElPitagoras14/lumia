# image-delivery

## Purpose

Gobierna cómo Lumia entrega las variantes de imagen al navegador: solo mediante URLs firmadas, a partir de originales que el servicio de transformación puede leer pero no modificar, y con una caché en la puerta de entrada. No cubre qué variantes existen ni quién genera las URLs, que llegan con la subida de fotos.

## Requirements

### Requirement: Solo se sirven variantes con firma válida

El servicio de transformación SHALL servir una variante solo si su URL lleva una firma válida para la clave y la sal configuradas. Una URL sin firma o con firma inválida SHALL rechazarse sin revelar el contenido del original.

#### Scenario: URL firmada válida

- **WHEN** el navegador pide por la ruta de imágenes una variante firmada correctamente de un original existente
- **THEN** recibe la imagen transformada

#### Scenario: URL sin firma o alterada

- **WHEN** el navegador pide una variante sin firma, o con la firma de otra URL
- **THEN** la petición se rechaza con un error
- **AND** no se entrega ninguna imagen

#### Scenario: Original inexistente

- **WHEN** se pide una variante firmada de un original que no existe
- **THEN** la respuesta es un error y no una imagen

### Requirement: Los originales no son accesibles fuera del volumen de datos

El servicio de transformación SHALL leer originales únicamente dentro del volumen de datos. Una URL firmada que apunte fuera de ese volumen SHALL rechazarse.

#### Scenario: Ruta fuera del volumen

- **WHEN** se pide una variante firmada cuya fuente apunta fuera del volumen de datos
- **THEN** la petición se rechaza

### Requirement: Las variantes se cachean en la puerta de entrada

La puerta de entrada SHALL cachear las respuestas satisfactorias de la ruta de imágenes, de modo que una variante ya servida no vuelva a transformarse mientras siga en caché. Las respuestas de error SHALL NOT cachearse como si fueran imágenes.

#### Scenario: Segunda petición de la misma variante

- **WHEN** se pide dos veces la misma variante firmada
- **THEN** la segunda respuesta sale de la caché sin llegar al servicio de transformación

#### Scenario: Un error no queda cacheado

- **WHEN** se pide una variante de un original inexistente y después se crea ese original
- **THEN** la siguiente petición de esa variante devuelve la imagen

### Requirement: Las URLs de variantes las firma el backend y son estables

El backend SHALL generar las URLs de las variantes con la misma clave y sal con las que el servicio de transformación las valida. Una URL SHALL depender solo de la foto y de la variante, sin fecha de expiración, de modo que pedir dos veces la misma variante produzca la misma URL y la caché de la puerta de entrada pueda servirla. El backend SHALL NOT transformar imágenes él mismo.

#### Scenario: Misma foto, misma URL

- **WHEN** se describe dos veces la misma foto
- **THEN** cada variante tiene la misma URL las dos veces

#### Scenario: Variantes distintas, URLs distintas

- **WHEN** se describe una foto
- **THEN** sus URLs de miniatura, mazo y visor son distintas entre sí

#### Scenario: La URL firmada se sirve

- **WHEN** el navegador pide la URL de una variante de una foto recién subida
- **THEN** recibe la imagen transformada

### Requirement: Existen tres variantes con tamaño acotado

El sistema SHALL ofrecer tres variantes de cada foto: una miniatura para cuadrículas, una de mazo para la tarjeta de votación y una de visor para verla en grande. Ninguna SHALL ampliar la imagen por encima de su tamaño original, y ninguna SHALL superar un lado máximo propio, de menor a mayor: miniatura, mazo, visor.

#### Scenario: Foto pequeña

- **WHEN** se pide el visor de una foto cuyo lado mayor es menor que el máximo del visor
- **THEN** la imagen servida no es más grande que la original

#### Scenario: Foto grande

- **WHEN** se pide cada variante de una foto muy grande
- **THEN** el lado mayor de la miniatura es menor que el del mazo, y este menor que el del visor

### Requirement: Una subida calienta las miniaturas

Al completarse una subida, el sistema SHALL pedir la miniatura de esa foto para dejarla en la caché de la puerta de entrada. Si ese calentamiento falla, la subida SHALL seguir siendo satisfactoria.

#### Scenario: Calentamiento fallido

- **WHEN** el servicio de transformación no responde justo después de una subida
- **THEN** la subida se completa y la foto queda registrada
