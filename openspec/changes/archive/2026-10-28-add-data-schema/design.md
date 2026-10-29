## Context

`add-local-environment` dejó dbmate aplicando migraciones SQL desde la imagen `migrate`, con `0001` vacía, y un backend que abre cada conexión con `foreign_keys=ON`, `busy_timeout` y WAL. Las pruebas del backend construyen el esquema con la misma imagen de dbmate (`backend/tests/migrate.py`), así que una migración nueva queda probada sin otro mecanismo. Ver `proposal.md` para el porqué de definir el modelo completo ahora y `specs/data-model/spec.md` para las reglas que la base tiene que cumplir.

## Goals / Non-Goals

**Goals:**

- Que cada regla de `data-model` la haga cumplir la base, de modo que un bug en un endpoint no pueda dejar votos duplicados, cruzados entre álbumes o huérfanos.
- Que añadir el multiusuario no requiera tocar tablas existentes: solo una ruta de registro.
- Que los changes de dominio mapeen las tablas con SQLAlchemy sin tener que reinterpretar tipos ni formatos de fecha.

**Non-Goals:**

- Mapear las tablas en el ORM: lo hace el change de cada dominio.
- Hacer cumplir en la base los límites de 50 fotos por álbum y 20 MiB por foto. Un trigger podría contarlas, pero el servicio ya tiene que validar antes de escribir el archivo, y duplicar el límite en dos lugares obliga a cambiarlo en ambos.

## Decisions

### D1 - Claves primarias enteras y un identificador de almacenamiento aparte

Todas las tablas usan `INTEGER PRIMARY KEY` (alias del `rowid`). Las fotos tienen además `storage_key`, un UUID en texto, único, que nombra el archivo en `/data/photos/<storage_key>` y la fuente de imgproxy. Los identificadores enteros nunca salen como secretos: lo que el invitado conoce es el token del enlace, y lo que expone imgproxy es `storage_key`.

El orden de subida es el orden por `id`. SQLite asigna a cada fila nueva un `rowid` mayor que el máximo actual, así que el orden entre las fotos existentes es siempre el de inserción, sin depender de la resolución de `created_at` cuando se suben varias en el mismo segundo.

**Alternativa descartada:** UUID como clave primaria en todas las tablas. Evita que los ids sean adivinables, pero ninguna ruta del 0.1.0 depende de que no lo sean (todas filtran por dueño o por participante), y complica los índices y las claves compuestas de D4.

### D2 - Tablas `STRICT` y fechas como texto UTC

Cada tabla se declara `STRICT`, para que SQLite rechace un valor de tipo equivocado en vez de guardarlo con afinidad. Las fechas son `TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`, que guarda UTC con formato `YYYY-MM-DD HH:MM:SS`, el mismo que lee el tipo `DateTime` de SQLAlchemy. `STRICT` exige SQLite 3.37; tanto la imagen de dbmate como el Python 3.13 del backend traen una versión posterior, y la tarea 1.1 lo verifica.

Los booleanos (`ratings.approved`) son `INTEGER` con `CHECK (approved IN (0, 1))`.

### D3 - Borrado: cascada desde el álbum, restricción desde el usuario

- `albums.owner_id` → `users` con `ON DELETE RESTRICT`. Borrar filas de fotos no borra sus archivos; si un usuario se pudiera borrar en cascada, los originales quedarían en disco sin fila que los nombre. El borrado de álbumes pasa por el servicio, que conoce los `storage_key` antes de borrar.
- `sessions.user_id` → `users` con `ON DELETE CASCADE`.
- `photos`, `share_tokens` y `participants` → `albums` con `ON DELETE CASCADE`.
- `ratings` → `photos` y `participants` con `ON DELETE CASCADE`.

Las cascadas funcionan porque cada conexión del backend activa `foreign_keys=ON`; las pruebas de este change lo comprueban sobre una conexión con ese pragma.

### D4 - El mismo álbum en un voto, garantizado con claves compuestas

`ratings` guarda `album_id` además de `photo_id` y `participant_id`, y sus dos claves foráneas son compuestas: `(photo_id, album_id)` → `photos(id, album_id)` y `(participant_id, album_id)` → `participants(id, album_id)`. Para eso `photos` y `participants` declaran `UNIQUE (id, album_id)`. Así la base rechaza un voto cruzado entre álbumes sin triggers. La clave primaria de `ratings` es `(photo_id, participant_id)`, que da la unicidad del voto y permite el reemplazo con `INSERT ... ON CONFLICT DO UPDATE`.

`album_id` en `ratings` también sirve a la vista de resultados, que agrega votos por álbum sin unir con `photos`.

**Alternativa descartada:** un trigger `BEFORE INSERT` que compare los álbumes. Funciona igual, pero esconde la regla en código procedural y hay que repetirlo para `UPDATE`.

### D5 - Un enlace por álbum, revocar es reemplazar

`share_tokens` tiene `album_id UNIQUE` y `token UNIQUE`. Revocar borra la fila o actualiza su `token`; el token anterior deja de existir y `GET /a/<token>` con él no encuentra álbum. Los participantes cuelgan de `albums`, no de `share_tokens`, así que revocar no los toca (decisión del usuario). El token se guarda en claro porque el dueño necesita volver a verlo para copiar el enlace.

**Alternativa descartada:** conservar los enlaces revocados con `revoked_at` y un índice único parcial. Permitiría distinguir "enlace revocado" de "enlace inexistente", pero ninguna pantalla del 0.1.0 lo usa.

### D6 - Secretos de cookie guardados como SHA-256

`sessions.token_hash` y `participants.token_hash` guardan el SHA-256 en hexadecimal del secreto aleatorio de la cookie, con `UNIQUE`. Quien lea `lumia.db` (por ejemplo, una copia del volumen) no puede suplantar al dueño ni a un invitado. Basta un hash rápido sin sal porque el secreto tiene 256 bits de entropía; bcrypt solo hace falta para contraseñas.

### D7 - Validaciones de texto en la base

- `users.email` con `COLLATE NOCASE` y `UNIQUE`.
- `albums.title`: `CHECK (length(trim(title)) BETWEEN 1 AND 100)`.
- `participants.name`: `CHECK (length(trim(name)) BETWEEN 1 AND 50)`. Sin unicidad por álbum: en otro navegador el invitado entra de nuevo con su nombre y es otro participante.
- `photos.content_type`: `CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp'))`; `photos.size_bytes`: `CHECK (size_bytes > 0)`.

### D8 - Índices

Además de los que crean `UNIQUE` y las claves primarias: `albums(owner_id)`, `photos(album_id)`, `participants(album_id)`, `sessions(user_id)` y `ratings(participant_id)`. La clave primaria de `ratings` empieza por `photo_id`, así que ya cubre las búsquedas por foto.

## Risks / Trade-offs

- [Un change de dominio necesita otra forma de una tabla] → Se añade una migración nueva; ninguna base desplegada depende de este esquema todavía.
- [`ON DELETE RESTRICT` sorprende a quien intente borrar un usuario] → No existe esa operación en 0.1.0; el error es explícito y protege los archivos.
- [Una conexión sin `foreign_keys=ON` ignora claves y cascadas] → El backend lo activa en cada conexión (spec `database-migrations`); las pruebas de este change abren las conexiones con el pragma.
- [`STRICT` no disponible en un SQLite antiguo] → La tarea 1.1 verifica la versión en las dos imágenes antes de escribir la migración.

## Migration Plan

`0002` se aplica sola en el siguiente `docker compose up` o `docker compose run --rm migrate`. `0001` no creó tablas, así que no hay datos que convertir. La sección `migrate:down` borra las tablas en orden inverso de dependencias, para poder volver a `0001` durante el desarrollo.

## Open Questions

Ninguna.
