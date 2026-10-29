## Why

El dueño ya tiene álbumes con fotos, pero nadie más puede verlos: las tablas `share_tokens` y `participants` existen desde la migración `0002` y no tienen API ni pantallas. Sin enlace ni invitados no se puede construir ni probar el mazo de votación ni los resultados, así que este es el cambio que desbloquea el resto de 0.1.0.

## What Changes

- El dueño genera el enlace de compartir de un álbum suyo y puede reemplazarlo por uno nuevo (revocar). El token anterior deja de existir en el mismo paso; los participantes y sus votos no se tocan.
- La respuesta de un álbum del dueño incluye el token de su enlace (o ninguno) y cuántos participantes entraron, para mostrar "Enlace activo" / "Sin enlace" y "N personas entraron".
- Un invitado abre `/a/<token>`. Con un token desconocido o revocado ve que el enlace no es válido, sin distinguir entre ambos casos.
- Sin cookie de participante para ese álbum, el invitado ve una pantalla que le pide un nombre (1 a 50 caracteres). Al enviarlo se crea un participante y su secreto se guarda en una cookie `HttpOnly` de larga duración, propia de ese álbum.
- Con una cookie válida, el invitado es reconocido sin volver a pedir el nombre, también cuando entra por un enlace nuevo del mismo álbum después de una revocación.
- Mientras no exista el mazo, tras entrar el invitado ve una pantalla de bienvenida con el título del álbum, su nombre y la cantidad de fotos. El cambio de votación la reemplaza.
- Frontend del dueño: diálogo "Compartir álbum" en el detalle del álbum para generar, copiar y revocar el enlace, y la insignia del estado del enlace en la lista de álbumes.
- Sin cambios de esquema ni dependencias nuevas.

## Capabilities

### New Capabilities

- `album-sharing`: el dueño genera, consulta, copia y revoca el enlace de compartir de sus álbumes, y ve cuántos participantes entraron.
- `guest-access`: el invitado resuelve un enlace, se identifica con un nombre, recibe su cookie de participante y es reconocido al volver.

### Modified Capabilities

Ninguna. `data-model` ya fija un enlace por álbum, que revocar es reemplazar o borrar y que los participantes cuelgan del álbum; este cambio no altera esas reglas.

## Impact

- Backend: nuevo `packages/sharing` (router, service, repository, schemas, responses, config) con las rutas del dueño bajo `/api/albums/{album_id}/share` y las del invitado bajo `/api/share/{token}`. `AlbumResponse` y su consulta suman `shareToken` y `participantCount`.
- Frontend: nueva ruta pública `/a/$token` (fuera del layout `_owner`), diálogo de compartir en `_owner/albums/$albumId`, insignia en la lista de álbumes y nuevas llamadas en `lib/api.ts`.
- `README.md`: describir el flujo de compartir y la cookie del invitado.
- Fuera de este cambio: el mazo de swipe y los votos, la vista de resultados, borrar participantes y desactivar el enlace sin reemplazarlo.
