## Context

Ver `proposal.md` para la motivación. Lo que ya existe y condiciona el enfoque:

- La migración `0002` ya define `share_tokens` (`album_id UNIQUE`, `token UNIQUE`, token en claro porque el dueño necesita volver a verlo) y `participants` (`album_id`, `name` con `CHECK` de 1 a 50 caracteres tras recortar, `token_hash UNIQUE`). Borrar un álbum borra ambos en cascada. No hace falta migración.
- `packages/auth` resuelve la sesión del dueño: cookie `lumia_session` con `path=/api`, `HttpOnly`, `SameSite=Lax`, sin `Secure` porque 0.1.0 se sirve por HTTP; el secreto sale de `secrets.token_urlsafe(32)` y la base guarda su SHA-256 (`generate_session_secret`, `hash_session_secret`). El login ya rechaza cuerpos que no sean JSON, que es lo que cubre CSRF en este alcance.
- `AlbumResponse` y `_ALBUM_COLUMNS` (en `packages/albums`) son la única forma en que el dueño ve un álbum, tanto en la lista como en el detalle.
- En el frontend, todo lo que cuelga de `_owner` exige sesión; las rutas fuera de ese layout son públicas. Ya están instalados `dialog`, `alert-dialog`, `drawer`, `input`, `label`, `card` y `skeleton`.
- Las maquetas (`local/lumia-mobile.html`) ya dibujan el diálogo "Compartir álbum" (enlace, "N personas entraron con este enlace", "Revocar y crear enlace nuevo"), las insignias "Enlace activo" / "Sin enlace" y la pantalla de nombre del invitado.

## Goals / Non-Goals

**Goals:**
- Que un participante sea reconocido por el álbum, no por el enlace, para que revocar no lo deje fuera.
- Que generar y revocar sean la misma operación atómica, sin ventana en la que un álbum tenga dos enlaces o ninguno por una carrera.

**Non-Goals:**
- Desactivar el enlace sin crear otro: el diseño de 0.1.0 define revocar como reemplazar, y `data-model` permite agregar el borrado después sin migración.
- Mostrar las fotos al invitado o registrar votos: es el cambio de votación, que reemplaza la pantalla de bienvenida.
- Listar o borrar participantes: es el cambio de resultados.
- Pruebas automatizadas: por decisión del proyecto, este cambio no las lleva; se verifica con `curl`, el navegador y las comprobaciones de lint y formato.

## Decisions

### D1 - Una cookie de participante por álbum, con el id del álbum en el nombre

La cookie se llama `lumia_guest_<album_id>`, con `path=/api`, `HttpOnly`, `SameSite=Lax`, sin `Secure` (mismo criterio que la sesión del dueño) y `max_age` de 400 días, el máximo que hoy aceptan los navegadores. Al resolver un token, el backend obtiene el álbum y solo entonces lee la cookie de ese álbum (`request.cookies`, porque el nombre depende de un dato que no se conoce al declarar la ruta), hace su SHA-256 y busca el participante por `(token_hash, album_id)`. El participante así no depende del token: tras revocar, el enlace nuevo lleva al mismo álbum, lee la misma cookie y lo reconoce, que es lo que exige `album-sharing`. Un mismo navegador puede ser participante de varios álbumes a la vez sin que una cookie pise a otra. El id del álbum en el nombre de la cookie no expone nada: la cookie solo la ve el propio navegador del invitado.

Alternativas: una cookie con `path=/api/share/<token>` (se pierde al revocar, porque el navegador deja de enviarla al nuevo path); una sola cookie con un mapa de álbumes a secretos (crece sin límite, se reescribe entera en cada entrada y mezcla la identidad de varios álbumes en un valor).

### D2 - El secreto del participante reusa el de la sesión del dueño

`generate_session_secret` y `hash_session_secret` de `packages/auth/security.py` ya hacen exactamente lo que necesita el participante (256 bits, SHA-256 sin sal, justificado por la entropía). Se importan desde `packages/sharing` en vez de duplicarlos. Alternativa: moverlos a un módulo común; se descarta por ahora porque solo hay dos consumidores y el nombre del módulo de auth no confunde.

### D3 - Generar o revocar es un único upsert

`POST /api/albums/{album_id}/share` carga el álbum por `(id, owner_id)` para dar el 404 preciso y luego ejecuta `INSERT INTO share_tokens (album_id, token) VALUES (...) ON CONFLICT (album_id) DO UPDATE SET token = excluded.token, created_at = CURRENT_TIMESTAMP RETURNING token`. Es una sola sentencia: SQLite serializa a los escritores, así que dos peticiones simultáneas dejan un único enlace (el de la última) y el token anterior desaparece en el mismo paso. El token es `secrets.token_urlsafe(16)` (128 bits, 22 caracteres URL-safe): suficiente para no poder adivinarse y corto para pegar en un chat. Una colisión del `UNIQUE (token)` es prácticamente imposible y, si ocurriera, sería un 500 que se resuelve repitiendo la acción, sin datos corruptos. Responde 200 con el token: un solo endpoint para "generar" y "revocar", porque para el servidor son la misma operación. Alternativa: `PUT` (idempotente por definición, y esta operación no lo es) o `DELETE` + `POST` (dos pasos con una ventana sin enlace).

### D4 - Entrar no duplica a un participante ya identificado

`POST /api/share/{token}/participants` primero resuelve el participante por la cookie del álbum (D1). Si existe, responde 200 con ese participante y no toca la cookie; si no, valida el nombre, inserta el participante, entrega la cookie y responde 201. Así un doble clic o una pestaña duplicada no crean participantes huérfanos. Alternativas: crear siempre uno nuevo (deja al primero sin cookie y sin forma de volver a él) o responder 409 (obliga al cliente a manejar un error en un caso que no lo es).

### D5 - Lo que ve el invitado y lo que no

`GET /api/share/{token}` devuelve `{ album: { title, photoCount }, participant: { name } | null }`. No se devuelve el id del álbum ni nada del dueño: el token es la única referencia que el invitado necesita. Un token inexistente lanza `NotFoundError`, que ya produce el mismo `not_found` para "nunca existió" y "revocado" porque una fila revocada simplemente no existe (D5 de `add-data-schema`). Las rutas del invitado no dependen de `current_user`.

### D6 - El dueño ve el enlace dentro del álbum

`_ALBUM_COLUMNS` suma `(SELECT token FROM share_tokens s WHERE s.album_id = a.id) AS share_token` y `(SELECT COUNT(*) FROM participants pa WHERE pa.album_id = a.id) AS participant_count`; `AlbumResponse` expone `shareToken: string | null` y `participantCount: number`. Así la lista (insignia) y el detalle (diálogo) salen de las consultas que ya existen, sin endpoint de lectura del enlace. El endpoint de generar devuelve el `AlbumResponse` actualizado, de modo que el frontend reemplaza la caché del álbum sin otra petición. La URL completa la arma el frontend con `window.location.origin + "/a/" + token`: el backend no sabe por qué host llegó el dueño (localhost, IP de la red local o un proxy), y el navegador sí.

### D7 - Estructura

Nuevo `packages/sharing` con `router`, `service`, `repository`, `schemas`, `responses` y `config` (nombre base y duración de la cookie), siguiendo `packages/albums`. Dos routers en el mismo paquete: el del dueño, con prefijo `/albums/{album_id}/share` y detrás de `current_user`, y el del invitado, con prefijo `/share/{token}`. El nombre del participante se valida con un esquema Pydantic (recorte y 1 a 50 caracteres) para que el 422 nombre `name` con el manejador común, igual que el título de un álbum.

### D8 - Frontend

- `lib/api.ts`: `Album` suma `shareToken` y `participantCount`; nuevas funciones `generateShareLink(albumId)`, `getSharedAlbum(token)` y `joinSharedAlbum(token, name)`.
- `_owner/albums/$albumId.tsx`: botón "Compartir" que abre un `Dialog` en escritorio y un `Drawer` en móvil (el mismo patrón que la subida) con el enlace en un `Input` de solo lectura, botón "Copiar" (`navigator.clipboard`, que en HTTP solo existe en `localhost`; fuera de un contexto seguro el botón selecciona el texto y avisa que hay que copiarlo a mano), "N personas entraron con este enlace" y "Revocar y crear enlace nuevo" tras un `AlertDialog`. Sin enlace, muestra "Crear enlace".
- `_owner/index.tsx`: insignia "Enlace activo" o "Sin enlace" en cada tarjeta. Si hace falta el componente `badge`, se agrega con el MCP de shadcn.
- Nueva ruta pública `routes/a/$token.tsx`: consulta `getSharedAlbum`; con 404 muestra "Este enlace no es válido"; sin participante, la pantalla de nombre de la maqueta; con participante, la bienvenida provisional (título, "Hola, <nombre>", cantidad de fotos y un aviso de que la votación todavía no está disponible). Al entrar, el resultado de `joinSharedAlbum` reemplaza la consulta en la caché.

### D9 - El texto de revocar describe lo que de verdad pasa

La maqueta dice "El enlace actual dejará de funcionar para quien aún no haya entrado". Con D1, quien ya entró tampoco puede usar el enlace viejo: necesita el nuevo, y con él retoma con su nombre y sus votos. El texto de la confirmación pasa a ser "El enlace actual dejará de funcionar. Quienes ya entraron conservan su nombre y sus votos al abrir el enlace nuevo." Alternativa: seguir aceptando el token viejo para quien trae cookie, lo que exige conservar los tokens revocados (descartado en `add-data-schema`, D5) y debilita el sentido de revocar.

## Risks / Trade-offs

- [El invitado borra cookies o cambia de navegador] → entra como participante nuevo; es la decisión de diseño de 0.1.0 para evitar suplantaciones por nombre, y el dueño podrá borrar al duplicado en el cambio de resultados.
- [Un enlace reenviado llega a quien no debía] → el dueño revoca; quien ya entró por error conserva su participante, pero no puede volver a entrar sin el enlace nuevo.
- [Sin `Secure`, la cookie del invitado viaja en claro por HTTP] → mismo riesgo aceptado para la sesión del dueño en 0.1.0, pensado para `localhost` o una red local; cuando haya HTTPS detrás de un proxy, ambas cookies deben pasar a `Secure` en el mismo cambio.
- [Muchos álbumes en un navegador crean muchas cookies, todas con `path=/api`] → cada una pesa unos 60 bytes y viaja en cada petición a la API; con decenas de álbumes sigue siendo despreciable.
- [El portapapeles no está disponible por HTTP fuera de `localhost`] → el enlace queda visible y seleccionable, y el botón lo selecciona.

## Migration Plan

Sin cambios de esquema ni de configuración. Desplegar es reconstruir `backend` y `frontend`; revertir es deshacer el cambio. Los enlaces y participantes creados quedan en la base y no estorban a una versión anterior, que simplemente no los usa.

## Open Questions

Ninguna.
