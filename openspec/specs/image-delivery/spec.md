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
