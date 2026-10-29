## 1. Verificaciones previas

- [x] 1.1 Comprobar que el SQLite de la imagen `ghcr.io/amacneil/dbmate:2.35.1` y el de Python 3.13 del backend (nativo y `backend/Dockerfile`) soportan tablas `STRICT` (≥ 3.37) (D2). Verificar aplicando con dbmate una migración temporal con una tabla `STRICT` y leyéndola con `python -c "import sqlite3; print(sqlite3.sqlite_version)"`; descartar la migración temporal.

## 2. Migración

- [x] 2.1 Crear `dbmate/migrations/0002_data_model.sql` con `users`, `sessions`, `albums`, `photos`, `share_tokens`, `participants` y `ratings` según D1-D7: tablas `STRICT`, claves foráneas con las acciones de D3, claves compuestas de `ratings` (D4), `UNIQUE` y `CHECK` de D5-D7. Verificar que `docker compose run --rm --build migrate` termina con código 0 y registra `0002` en `schema_migrations`.
- [x] 2.2 Agregar los índices de D8 en la misma migración; verificar con `PRAGMA index_list` sobre cada tabla.
- [x] 2.3 Escribir la sección `-- migrate:down` que borra las tablas en orden inverso de dependencias; verificar que `dbmate rollback` vuelve a `0001` sin tablas de dominio y que un nuevo `up` vuelve a `0002`.

## 3. Pruebas

- [x] 3.1 Actualizar `backend/tests/test_migrations.py` para que la última versión esperada sea `["0001", "0002"]`; verificar que `uv run pytest tests/test_migrations.py` pasa.
- [x] 3.2 Crear `backend/tests/test_data_model.py` con una fixture que abra una conexión al esquema migrado de la sesión de pruebas con `foreign_keys=ON` y deshaga sus cambios al terminar cada prueba, para que las pruebas no dependan entre sí. Verificar que dos pruebas que insertan el mismo email no chocan.
- [x] 3.3 Escribir una prueba por escenario de los requisitos de propiedad y usuarios de `specs/data-model/spec.md` (álbum sin dueño, borrar usuario con álbumes, email con otras mayúsculas, filtrado por dueño, sesiones: resumen repetido, sin expiración, cascada al borrar usuario). Verificar que `uv run pytest tests/test_data_model.py` pasa.
- [x] 3.4 Escribir una prueba por escenario de fotos, enlace y participantes (tipo no admitido, `storage_key` repetido, orden de subida, segundo enlace, token repetido, revocar sin afectar participantes, nombre vacío, nombre de 51 caracteres, nombre repetido). Verificar que pasan.
- [x] 3.5 Escribir una prueba por escenario de votos y cascadas (voto duplicado, foto de otro álbum, valor no binario, cambio de voto con `INSERT ... ON CONFLICT DO UPDATE`, borrar álbum, foto y participante). Verificar que pasan.
- [x] 3.6 Verificar que `uv run pytest` completo, `uv run ruff check` y `uv run ruff format --check` pasan en `backend/`.

## 4. Documentación

- [x] 4.1 Añadir al `README.md` una sección breve del modelo de datos: tabla con las siete tablas y su propósito, y las reglas que hace cumplir la base (cascadas, un voto por pareja, secretos con hash). Verificar que respeta el estilo de `CLAUDE.md` (un único `#`, tablas para listados).

## 5. Verificación integral

- [x] 5.1 Con una base existente en `0001` (volumen `lumia-data` de antes del change), ejecutar `docker compose up --build` y verificar que `migrate` aplica solo `0002`, que el backend queda `healthy` y que `sqlite3 /data/lumia.db ".tables"` dentro del contenedor del backend lista las siete tablas.
