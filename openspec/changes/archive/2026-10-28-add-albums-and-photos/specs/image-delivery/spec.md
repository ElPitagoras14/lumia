## ADDED Requirements

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
