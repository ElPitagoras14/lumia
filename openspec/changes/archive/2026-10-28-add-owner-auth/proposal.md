## Why

Todas las rutas del dueño de 0.1.0 (álbumes, subida, enlace de compartir y resultados) necesitan saber quién hace la petición y filtrar por ese usuario. Hoy existen las tablas `users` y `sessions`, pero nada las llena ni las lee: no hay cuenta, login ni forma de proteger una ruta. Este change crea esa base antes del primer endpoint de dominio, para que cada uno dependa desde el principio de un único `current_user` y nunca de "el primer usuario", que es una de las anti-metas del diseño.

## What Changes

- Sembrado de la cuenta del dueño al arrancar el backend: si `users` está vacía, se crea con `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Ocurre una sola vez; cambiar las variables después no modifica la cuenta.
- Login con email y contraseña (bcrypt) que abre una sesión de servidor y la entrega en una cookie `HttpOnly` con `SameSite=Lax`. Logout que la cierra, y una ruta que devuelve el usuario de la sesión actual.
- Una dependencia `current_user` que resuelve la sesión desde la cookie y responde 401 si no es válida. Será la única puerta de las rutas del dueño.
- Un comando CLI `reset-password` para cambiar la contraseña de una cuenta existente, que además cierra sus sesiones abiertas.
- Acceso a `users` y `sessions` con SQL explícito sobre SQLAlchemy Core 2, sin ORM ni migraciones nuevas. El backend abandona el `sessionmaker` del ORM y pasa a conexiones de Core, que es la forma de acceso a datos que seguirán los demás dominios.
- La paleta de la interfaz: Caffeine con el acento Miel tostada y el modo oscuro Grafito, elegida en los mockups de `local/`.
- En la interfaz, una pantalla de login en español, la página de inicio del dueño protegida (redirige al login sin sesión) y un botón para cerrar sesión.
- El formato de respuestas y errores de `pixpick` para toda la API: un sobre común `{data, error}`, errores con código estable, campos en camelCase y manejadores centralizados que no filtran detalles internos. El healthcheck pasa a ese formato.
- Dos variables de entorno nuevas y obligatorias, `ADMIN_EMAIL` y `ADMIN_PASSWORD`, en `.env.example`, `compose.yaml` y el README.

### Fuera de alcance

- Registro de usuarios, recuperación de contraseña por correo y cualquier proveedor de identidad externo (no metas de 0.1.0).
- Rate limiting o bloqueo por intentos fallidos de login (no meta de 0.1.0).
- Álbumes y cualquier otra ruta de dominio: la página de inicio del dueño queda como un esqueleto que el change de álbumes llenará.
- Cookie `Secure`: como decidió el usuario en `add-data-schema`, 0.1.0 va por HTTP y no hay `PUBLIC_URL`. Si se añade HTTPS, se introducirá `COOKIE_SECURE`.
- La cookie y la identificación de los invitados, que llegan con el change de compartir.

## Capabilities

### New Capabilities

- `owner-auth`: cómo existe la cuenta del dueño, cómo inicia y cierra sesión, cuánto dura una sesión, cómo se protegen las rutas del dueño y cómo se restablece la contraseña.
- `api-conventions`: la forma común de las respuestas, la convención de nombres y qué estado y código corresponde a cada situación de error. Es la misma capacidad que en `pixpick`, sin el caso de falta de capacidad.

### Modified Capabilities

Ninguna. Las variables nuevas siguen los requisitos de `local-environment`: tienen consumidor, existen con el mismo nombre en ambos perfiles y su ausencia detiene el arranque. `data-model` no cambia porque el change usa las tablas tal como están.

## Impact

**Backend**

- Estructura por paquetes, como `pixpick` y `aniseek`: `src/database.py` pasa a ser el paquete `src/database/` (engine, helpers de consulta, `transaction()` y `get_connection`), y un `src/routes.py` nuevo monta los routers bajo `/api`.
- Paquete nuevo `backend/src/packages/auth/` con `config`, `security`, `schemas`, `responses`, `repository` (SQL), `service`, `dependencies` y `router`.
- `backend/src/health.py`, `backend/src/main.py` y las pruebas de health y de base de datos pasan a la nueva infraestructura. `src/main.py` agrega el sembrado en el `lifespan`.
- `src/models.py`, `src/responses.py`, `src/exceptions.py` y `src/handlers.py` nuevos, con el contrato de `pixpick`.
- Módulo CLI nuevo para `reset-password`.
- Pruebas nuevas de sembrado, login, sesión, `current_user`, logout y `reset-password`. `backend/tests/conftest.py` define las variables nuevas.

**API nueva**

- `POST /api/auth/login`, `POST /api/auth/logout` y `GET /api/auth/me`.
- **BREAKING** (solo local): `GET /api/health` responde `{"data": {"status": "ok"}, "error": null}` en vez de `{"status": "ok"}`. El healthcheck de Compose solo mira el código HTTP y no se ve afectado.

**Frontend**

- Proveedor de TanStack Query, cliente de la API, ruta `/login`, guard de la ruta del dueño y componentes de shadcn para el formulario (`input`, `label`, `card`).

**Configuración y documentación**

- `.env.example`, `compose.yaml` y `README.md`: las variables `ADMIN_EMAIL` y `ADMIN_PASSWORD`, más el uso de `reset-password`.

**Dependencias**

Ninguna nueva. `bcrypt`, `axios` y `@tanstack/react-query` ya están declaradas.

**Sistemas afectados**

Ninguno desplegado. Una instalación local existente necesita las dos variables nuevas en `.env` antes del próximo `docker compose up`.
