## Why

Toda la funcionalidad de 0.1.0 (login del dueño, álbumes, subida, enlace de compartir, mazo y resultados) lee y escribe sobre el mismo modelo de datos, y las anti-metas del diseño se juegan en él: que un voto no se pierda, que las consultas no asuman un solo usuario y que el multiusuario no exija migrar datos. Hoy la base solo tiene la migración `0001`, vacía. Definir el modelo completo en un único change permite revisarlo como un todo y hacer que la base, no solo el código, garantice esas reglas antes de que exista el primer endpoint.

Esto se aparta de lo que anticipaba `add-local-environment` ("cada tabla llega con el change que la usa"). Las siete tablas se diseñaron juntas y se referencian entre sí; repartirlas obligaría a revisar fragmentos de un modelo que solo tiene sentido completo.

## What Changes

- Una migración dbmate `0002` que crea `users`, `sessions`, `albums`, `photos`, `share_tokens`, `participants` y `ratings`, con claves foráneas, borrado en cascada, unicidad y restricciones `CHECK`.
- Propiedad multiusuario desde el esquema: cada álbum pertenece a un usuario y todo lo demás cuelga del álbum.
- Integridad de votos en la base: un voto por foto y participante, y la foto y el participante de un voto pertenecen siempre al mismo álbum.
- Los invitados cuelgan del álbum, no del enlace: revocar o regenerar el enlace no afecta a los participantes ni a sus votos (decisión del usuario sobre la pregunta pendiente del diseño).
- Los secretos de sesión de dueño y de participante se guardan como hash, no en claro.
- Pruebas que verifican cada regla de integridad contra la base migrada con dbmate, y actualización de las pruebas de migración que hoy esperan solo `0001`.

### Fuera de alcance

- Modelos ORM, repositorios, endpoints y frontend: llegan con el change de cada dominio, que mapea las tablas que ya existen.
- Sembrado de la cuenta del dueño, login, `reset-password` y la política de cookies.
- Límites que dependen del contexto de la petición (50 fotos por álbum, 20 MiB por foto): los aplica el servicio, no el esquema.
- `PUBLIC_URL`: el usuario decidió no introducirlo. El backend no necesita conocer su URL pública (el enlace `/a/<token>` lo arma el frontend con su origen y las URLs de `/images/` son relativas) y en 0.1.0 todo va por HTTP, así que las cookies no llevan `Secure`. Si más adelante hay HTTPS, se añadirá una variable `COOKIE_SECURE`.

## Capabilities

### New Capabilities

- `data-model`: qué entidades guarda Lumia, cómo se relacionan y qué reglas de integridad y aislamiento hace cumplir la propia base (propiedad por usuario, unicidad de votos, cascadas al borrar, secretos con hash).

### Modified Capabilities

Ninguna. `database-migrations` no cambia: la nueva migración sigue sus requisitos (archivo numerado con secciones de aplicación y reversión, aplicado por el paso `migrate`).

## Impact

**Archivos nuevos**

- `dbmate/migrations/0002_data_model.sql`
- `backend/tests/test_data_model.py`

**Archivos modificados**

- `backend/tests/test_migrations.py`: la última versión pasa a ser `0002`.
- `README.md`: breve descripción del modelo de datos.

**Dependencias**

Ninguna. La imagen de dbmate y SQLite ya están en el entorno.

**Sistemas afectados**

Ninguno desplegado. Una base local existente se actualiza sola en el próximo `docker compose up`, porque `0001` no creó tablas.
