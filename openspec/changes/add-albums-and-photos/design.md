## Context

Ver `proposal.md` para la motivación. Lo que ya existe y condiciona el enfoque:

- `albums` y `photos` están en la migración `0002`: `photos.storage_key` es único y nombra el original en `/data/photos/<storage_key>`; borrar un álbum borra sus fotos en cascada, y una foto borra sus votos. No hace falta migración.
- El backend usa SQLAlchemy Core con SQL directo en un `repository`, un `service` que lanza excepciones de dominio (`NotFoundError`, `ValidationFailedError`, `StateConflictError`) y routers que devuelven `Envelope[...]`. Auth ya aporta la dependencia `current_user`; toda ruta del dueño debe acotar cada consulta por su `id`.
- La conexión de la petición se confirma (commit) *antes* de enviar la respuesta (`DbConnection` usa `scope="function"`).
- `transformer` (imgproxy) ya monta `/data` en solo lectura, acepta únicamente fuentes `local:///photos/` y valida firmas; nginx cachea `/images/`. El backend todavía no recibe `IMAGE_SIGNING_KEY` ni `IMAGE_SIGNING_SALT`.
- nginx no define `client_max_body_size`, así que vale 1 MiB por defecto y rechazaría cualquier foto real antes de que el backend la vea.

## Goals / Non-Goals

**Goals:**
- CRUD de álbumes y fotos acotado por dueño, sin que el disco y la base puedan quedar en desacuerdo, ni siquiera con subidas simultáneas.
- URLs de variantes firmadas y estables, para que la caché de nginx funcione.

**Non-Goals:**
- El enlace de compartir, los invitados, la votación y los resultados.
- Reordenar fotos, renombrar álbumes, mover fotos entre álbumes o peticiones por lotes (varios archivos).
- Pruebas automatizadas: por decisión del proyecto, este cambio no las lleva; se verifica levantando el stack y con las comprobaciones de lint y formato.

## Decisions

### D1 - Un archivo por petición de subida

`POST /api/albums/{id}/photos` recibe un único `file` multipart. El frontend sube varios archivos encolando peticiones. Un endpoint por lotes exigiría semántica de éxito parcial (unas aceptadas, otras rechazadas, un límite alcanzado a mitad); con un archivo por petición, cada resultado es un código de estado simple y la interfaz de progreso es por archivo. Alternativa: un endpoint multiarchivo con una lista de resultados por archivo; descartada por más superficie sin beneficio con 50 fotos.

### D2 - El tipo se decide a mano, por los primeros bytes del archivo

JPEG (`FF D8 FF`), PNG (la firma de 8 bytes) y WebP (`RIFF` + tamaño + `WEBP`) son tres firmas fijas, así que una función pequeña basta sin dependencias; el `Content-Type` declarado y la extensión se ignoran. El `content_type` guardado en `photos` sale de esa detección. Alternativa: Pillow o `python-magic` (dependencia nueva, librerías nativas en la imagen) o confiar en el tipo declarado (falsificable). La comprobación de firma no prueba que el archivo se decodifique; imgproxy falla de forma segura ante una imagen corrupta, así que el costo es una miniatura rota para el dueño por su propio archivo malo. Se acepta.

### D3 - Escritura por trozos a un nombre temporal y luego renombrar

La subida se lee por trozos, contando bytes y abortando al pasar 20 MiB, hacia `/data/photos/<uuid>.part`; el primer trozo se revisa contra las firmas antes de seguir. Si es válido, el archivo se renombra a `/data/photos/<uuid>` (el `storage_key`, `uuid4().hex`, nunca derivado del nombre que envía el cliente) y se inserta la fila. Cualquier fallo con el archivo ya creado lo borra. Los archivos `.part` solo pueden quedar por una caída a mitad de subida; nadie los referencia e imgproxy no podría servirlos (no hay fila ni URL firmada). Limpiarlos al arrancar no justifica una tarea. Alternativa: escribir directo al nombre final; descartada porque un archivo a medias sería visible bajo una clave válida.

### D4 - El límite de 50 fotos es una sola sentencia atómica

La inserción es `INSERT ... SELECT ... WHERE (SELECT COUNT(*) FROM photos WHERE album_id = :a) < 50 RETURNING ...`; si no devuelve filas, el álbum está lleno (409 `album_full`, `details: {limit: 50}`). SQLite serializa a los escritores, así que dos subidas simultáneas con 49 fotos no pueden pasar las dos. Alternativa: contar y luego insertar en dos sentencias (condición de carrera), o `BEGIN IMMEDIATE` alrededor de ambas (funciona, pero cambia el helper compartido `transaction()`). Antes, el servicio carga el álbum por `(id, owner_id)` para dar el 404 preciso.

### D5 - Los archivos se borran después del commit, en una tarea de fondo

Borrar un álbum o una foto elimina filas en la transacción de la petición y devuelve los `storage_key`; el router los pasa a `BackgroundTasks`, que corre después de enviar la respuesta y, por tanto, después del commit. Un commit fallido deja los archivos intactos; un borrado fallido (o un archivo ausente) se registra y se ignora, dejando como mucho un original sin referencia, nunca una fila sin archivo. Alternativa: borrar dentro del endpoint, antes del commit; descartada porque un commit fallido dejaría filas que apuntan a archivos borrados, la peor de las dos incoherencias.

### D6 - `variant_url(storage_key, variant)` en un módulo `images` pequeño

Construye `/images/<firma>/rs:fit:<n>:<n>/plain/local:///photos/<storage_key>@webp` y firma la ruta con HMAC-SHA256 sobre `sal + ruta`, usando la clave y la sal en hexadecimal, en base64url sin relleno, como espera imgproxy. Sin expiración ni marca de tiempo, de modo que la URL es función pura de la foto y la variante. La salida es WebP en todas las variantes. Tamaños (lado mayor, ajuste sin ampliar, que es el comportamiento por defecto de imgproxy): miniatura 320, mazo 1080, visor 1920. `IMAGE_SIGNING_KEY` e `IMAGE_SIGNING_SALT` viven en una clase `PhotoSettings` junto al paquete de fotos, igual que `auth_settings`, y son obligatorias: el backend se niega a arrancar sin ellas antes que emitir URLs que imgproxy rechazaría. Alternativa: un puerto con adaptadores, como en Pixpick; fuera de alcance según el diseño de 0.1.0.

### D7 - Calentar la miniatura tras la subida, sin garantía

Una tarea de fondo pide la URL de la miniatura a través de nginx (`IMAGE_WARMUP_BASE_URL`, por defecto `http://nginx`) con un timeout corto, usando `urllib` (ya está en la biblioteca estándar, sin dependencia) y traga cualquier error. En modo nativo, donde no hay nginx, simplemente falla en silencio.

### D8 - Estructura

`packages/albums` y `packages/photos`, cada uno con `router`, `service`, `repository`, `schemas` y `responses`, siguiendo `packages/auth`; el de fotos añade `storage.py` (operaciones de archivo y comprobación del tipo) y `config.py`. Rutas: `POST/GET /api/albums`, `GET/DELETE /api/albums/{album_id}`, `GET/POST /api/albums/{album_id}/photos`, `DELETE /api/albums/{album_id}/photos/{photo_id}`. Las creaciones responden 201; los borrados responden 200 con `Envelope(data=None)`, como el logout. Un álbum ajeno o inexistente es un `NotFoundError` con el código y el mensaje únicos que el manejador común ya asigna (`not_found`); la consulta de borrado de foto une el álbum y filtra por el álbum de la foto y por el dueño, de modo que una foto de otro álbum o de otro dueño es el mismo `not_found`. Las respuestas nunca incluyen `storage_key`.

### D9 - nginx acepta subidas

`location /api/` recibe `client_max_body_size 21m` (20 MiB más el sobrecosto multipart), de modo que una foto de 20 MiB pasa y es la comprobación de 20 MiB del backend la que rechaza las mayores con la forma de error común. Por encima de eso, nginx responde 413 con su propio cuerpo; el frontend comprueba el tamaño antes de enviar, así que normalmente el dueño no lo ve.

### D10 - Frontend

La pantalla de inicio del dueño pasa a ser la lista de álbumes (tarjetas con miniatura de portada, cantidad de fotos, diálogo de creación, borrado con confirmación); una ruta nueva `_owner/albums/$albumId` muestra la cuadrícula de fotos y una zona de subida que acepta varios archivos y los envía de uno en uno con un estado por archivo (en espera, subiendo, listo, fallido con el mensaje de la API). El cliente prefiltra por tipo, tamaño y capacidad restante para dar respuesta inmediata; el servidor sigue siendo la autoridad. TanStack Query invalida el álbum y sus fotos tras cada mutación. Interfaz en español; los componentes shadcn (diálogo o diálogo de alerta, skeleton y lo que aporte el MCP) se añaden con el MCP de shadcn y no a mano. Las maquetas `local/lumia-*.html` son la referencia visual.

## Risks / Trade-offs

- [Una caída entre escribir el archivo e insertar la fila] → el original sin referencia queda en disco; nunca se sirve (no existe URL firmada) y solo cuesta espacio.
- [Rotar `IMAGE_SIGNING_KEY` o la sal invalida todas las URLs ya emitidas] → las URLs se recalculan en cada respuesta, así que recargar lo arregla; solo las entradas viejas de la caché de nginx, indexadas por URI, envejecen sin daño.
- [La comprobación de firma acepta una imagen corrupta] → ver D2; el fallo queda limitado a la miniatura de esa foto.
- [URLs de imagen estables y sin autenticación] → ya aceptado en el diseño de 0.1.0; los nombres de los originales son UUID no adivinables y la URL está firmada.
- [Peticiones de un solo archivo implican 50 peticiones para un álbum lleno] → aceptable en un despliegue local; el cliente las ejecuta en secuencia para cuidar la memoria y al único escritor de SQLite.

## Migration Plan

Sin cambios de esquema. Desplegar requiere que `IMAGE_SIGNING_KEY` e `IMAGE_SIGNING_SALT` lleguen al backend (`compose.yaml`; el perfil nativo ya las documenta) y reconstruir la imagen de nginx para el cambio de tamaño de cuerpo. Revertir es deshacer el cambio; no se altera ningún dato.

## Open Questions

Ninguna.
