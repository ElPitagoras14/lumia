## Context

El esquema ya tiene `users` (`email` `COLLATE NOCASE UNIQUE`, `password_hash`) y `sessions` (`token_hash` SHA-256 `UNIQUE`, `expires_at`, cascada desde `users`), creados por `add-data-schema` (D6 de ese change). El backend es plano (`src/config.py`, `src/database.py`, `src/health.py`, `src/main.py`) y abre cada conexión con `foreign_keys=ON`. `src/database.py` expone hoy un `sessionmaker` del ORM y `get_session`, que solo usa el healthcheck para un `SELECT 1`. La decisión del proyecto es no usar el ORM: el acceso a datos es SQL explícito con SQLAlchemy Core 2. `bcrypt` 5.0 ya está declarado, y FastAPI 0.141 rechaza por defecto los cuerpos JSON con otro `Content-Type` (`strict_content_type`). Las pruebas construyen el esquema con dbmate en `pytest_configure` y fijan `DATA_DIR` antes de importar la app.

En el frontend, `main.tsx` crea el router sin `QueryClient`, `router.tsx` define un `getRouter()` que nadie usa y `/` es una portada de texto. Ver `proposal.md` para el porqué y `specs/owner-auth/spec.md` para el comportamiento exigido.

## Goals / Non-Goals

**Goals:**

- Que los changes de dominio reciban el usuario con una sola dependencia y no puedan obtenerlo de otra forma.
- Fijar en este change la estructura `src/packages/<dominio>/` y la forma de acceso a datos (SQL con Core, sin ORM) que seguirán los demás dominios.
- Que una copia de `lumia.db` no permita suplantar al dueño ni leer su contraseña.

**Non-Goals:**

- Protección contra fuerza bruta (no meta de 0.1.0). La espera de bcrypt hace lento cada intento, pero no hay límite de intentos.
- Renovar sesiones con el uso o mostrar al dueño la lista de sus sesiones abiertas.

## Decisions

### D1 - Estructura por paquetes, como `pixpick` y `aniseek`

El backend adopta la estructura de `pixpick` y `aniseek`: la infraestructura compartida en módulos de primer nivel bajo `src/` y cada dominio en un paquete autocontenido bajo `src/packages/<dominio>/`, que expone su propio `router`. Este change fija la estructura que seguirán los paquetes `albums`, `photos`, `shares`, `ratings` y `results`.

```text
backend/src/
├── main.py            # FastAPI app and lifespan (owner seeding)
├── routes.py          # api_router with prefix /api; includes health and every package router
├── config.py          # global Settings (DATA_DIR)
├── models.py          # ApiModel: snake_case inside, camelCase on the wire
├── responses.py       # Envelope[T], ErrorBody, error_envelope()
├── exceptions.py      # shared domain exceptions
├── handlers.py        # register_exception_handlers(app)
├── health.py          # GET /api/health
├── cli.py             # python -m src.cli reset-password <email>
├── database/
│   ├── __init__.py
│   ├── client.py      # engine, SQLite PRAGMAs, query helpers
│   ├── utils.py       # transaction() context manager
│   └── dependencies.py  # get_connection (one transaction per request)
└── packages/
    └── auth/
        ├── __init__.py
        ├── config.py        # AuthSettings (ADMIN_*), session lifetime, cookie name and path
        ├── exceptions.py    # InvalidCredentialsError
        ├── security.py      # bcrypt hash/verify, session secret and its SHA-256
        ├── schemas.py       # internal records (UserRecord) and request bodies (LoginRequest)
        ├── responses.py     # what crosses the API (CurrentUserResponse)
        ├── repository.py    # SQL only
        ├── service.py       # login, logout, resolve session, seed owner, reset password
        ├── dependencies.py  # current_user
        └── router.py        # APIRouter(prefix="/auth")
```

Reglas de capa, las mismas de las dos referencias:

- `router.py` solo traduce HTTP: valida el cuerpo, llama al servicio, pone o borra la cookie y arma la respuesta. No contiene SQL.
- `service.py` contiene las reglas (credenciales, expiración, sembrado) y recibe la conexión como argumento. No conoce FastAPI, así que el CLI y el `lifespan` lo reutilizan.
- `repository.py` es el único lugar con SQL del dominio. Cada función recibe la conexión y llama a los helpers de `src.database.client`.
- Un paquete importa de otro solo su `dependencies.py` o su `schemas.py` (por ejemplo, `albums` usará `current_user` y `UserRecord` de `auth`), nunca su repositorio.
- La configuración propia del dominio vive en el `config.py` del paquete (`AuthSettings` con `ADMIN_EMAIL` y `ADMIN_PASSWORD`, como `database/config.py` y `packages/auth/config.py` en `pixpick`). `src/config.py` conserva solo lo global (`DATA_DIR`).

`src/database.py` pasa a ser el paquete `src/database/`, y `main.py` deja de armar el `APIRouter` en línea: lo hace `routes.py`. Las pruebas siguen la misma estructura: `tests/packages/auth/test_repository.py`, `test_service.py`, `test_dependencies.py` y `test_router.py`, y `tests/packages/auth/test_cli.py`.

A diferencia de las referencias, todo es síncrono. SQLite con un solo worker no gana nada con un driver asíncrono, y uno síncrono evita una dependencia (`aiosqlite`). FastAPI ejecuta las rutas `def` en su threadpool.

**Alternativa descartada:** carpetas por capa (`routers/`, `services/`, `repositories/`). Un dominio nuevo quedaría repartido en cuatro carpetas, en vez de ser un paquete que se agrega o se quita entero.

### D2 - `src/database/`: helpers de consulta y una transacción por petición

Sin ORM y sin objetos `Table`. Todo el SQL es texto con parámetros con nombre (`:email`), y nunca se arma concatenando valores. Como no hay `MetaData`, el backend no tiene forma de crear tablas, lo que refuerza que el esquema es de dbmate (spec `database-migrations`). Declarar las tablas con `Table` de Core obligaría a repetir en Python el esquema que ya está en las migraciones.

- `client.py`: el `engine` y el listener de `PRAGMA` que hoy están en `src/database.py`, más los helpers que usan todos los repositorios, con la misma forma que en `pixpick`:
  - `write(conn, sql, params)`: una sentencia que escribe y no devuelve filas.
  - `fetch_one(conn, sql, Model, params)` y `fetch_all(conn, sql, Model, params)`: validan cada fila contra un modelo Pydantic, así que una consulta que deja de devolver un campo falla ahí y no más adelante.
  - `fetch_val(conn, sql, params)`: para una consulta que siempre devuelve una fila, como un `count`.
  - `fetch_val_or_none(conn, sql, params)`: para un valor que puede no existir.
- `utils.py`: `transaction()`, un context manager sobre `engine.begin()` que hace commit al salir sin error y rollback si hay una excepción. El límite de la unidad de trabajo es ese bloque, no la pila de llamadas. El `lifespan` (sembrado) y el CLI lo usan directamente.
- `dependencies.py`: `get_connection` hace `with transaction() as conn: yield conn`. Todas las escrituras de una petición se confirman juntas si la ruta termina bien y se deshacen juntas si lanza una excepción. Los servicios nunca llaman a `commit()`. Por defecto, FastAPI 0.141 ejecuta la salida de una dependencia con `yield` (`scope="request"`) **después** de enviar la respuesta: el cliente recibiría el `200` antes del commit, un `/me` inmediato al login podría no ver la sesión y un commit fallido no podría convertirse en error. Por eso la dependencia se declara con `scope="function"`, que termina antes de enviar la respuesta. Se expone como el alias `DbConnection = Annotated[Connection, Depends(get_connection, scope="function")]` en `dependencies.py`, para que ningún endpoint pueda olvidar el alcance. Una prueba comprueba que, cuando sale el encabezado de la respuesta, la escritura ya es visible desde otra conexión. Las pruebas pueden sobrescribir la dependencia.

El healthcheck pasa a depender de `get_connection`, y su prueba sobrescribe esa dependencia en vez de `get_session`.

No hace falta configurar un pool: en SQLAlchemy 2.0, `create_engine` sobre un archivo SQLite ya usa `QueuePool` (5 conexiones más 10 de desborde), y `engine.connect()` toma una del pool y la devuelve al cerrarse. Los `PRAGMA` del evento `connect` se aplican una vez por conexión física, así que las conexiones reutilizadas los conservan. Con un solo worker, y las rutas síncronas corriendo en el threadpool de FastAPI, ese tamaño basta. SQLite admite un solo escritor a la vez, y `busy_timeout=5000` hace que las escrituras concurrentes esperen en vez de fallar. A diferencia de `pixpick`, que fija `pool_size` y `max_overflow` para no superar las conexiones que acepta Postgres, aquí no hay un servidor que limite conexiones. Si las pruebas de carga mostraran esperas por conexión, se ajustaría `pool_size`, pero no se cambia por adelantado.

### D2b - Las fechas las calcula SQLite

Las fechas no se formatean en Python. Las inserciones usan `CURRENT_TIMESTAMP` o `datetime('now', '+30 days')` y las comparaciones usan `expires_at > CURRENT_TIMESTAMP`. Todas las fechas quedan en UTC con el formato `YYYY-MM-DD HH:MM:SS` de la migración, comparar como texto equivale a comparar fechas, y el backend no necesita un tipo de fecha propio. Los demás dominios siguen la misma regla.

### D3 - Sembrado en el `lifespan`, condicionado a una tabla vacía

En el `lifespan` de FastAPI, el servicio de auth cuenta las filas de `users`. Si es cero, inserta `ADMIN_EMAIL` con el hash bcrypt de `ADMIN_PASSWORD`. En cualquier otro caso no hace nada. Es escritura de datos, no de esquema, así que no contradice "El backend no modifica el esquema". Con un solo worker de uvicorn no hay carrera, y si la hubiera, el `UNIQUE` de `email` rechazaría el duplicado.

`ADMIN_EMAIL` y `ADMIN_PASSWORD` son campos obligatorios de `AuthSettings` (`src/packages/auth/config.py`) aunque solo se usen en el primer arranque. Así se cumple el requisito de `local-environment` (una variable requerida ausente detiene el arranque) y los dos perfiles declaran las mismas variables. `ADMIN_EMAIL` se valida con `EmailStr`; `email-validator` ya llega con `fastapi[standard]`.

**Alternativa descartada:** sembrar con un comando aparte o en una migración. Una migración no puede leer secretos del entorno sin dejarlos en el SQL, y un comando aparte añade un paso al `docker compose up`.

### D4 - Contraseñas con bcrypt y límites de 8 caracteres a 72 bytes

`bcrypt.hashpw` con `gensalt()` (costo por defecto, 12). bcrypt 5.0 lanza error con más de 72 bytes en vez de truncar, así que el límite se valida antes: en `AuthSettings` (para `ADMIN_PASSWORD`), en el CLI y en el esquema de login. Si una contraseña de login supera los 72 bytes, se trata como incorrecta, con el mismo 401.

Si el email no existe, el login verifica igualmente la contraseña contra un hash bcrypt fijo calculado al importar el módulo. Así el tiempo de respuesta no revela si el email existe. Ambos casos lanzan `InvalidCredentialsError` (`packages/auth/exceptions.py`), que se responde con 401 y el código `invalid_credentials` (D12). La interfaz decide qué mostrar a partir del código.

### D5 - Secreto de sesión: 32 bytes aleatorios, SHA-256 en la base

Al iniciar sesión se genera `secrets.token_urlsafe(32)`, se guarda su SHA-256 hexadecimal en `sessions.token_hash` (D6 de `add-data-schema`) con `expires_at = datetime('now', '+30 days')` (D2b), y el secreto va en la cookie. `current_user` calcula el hash de la cookie y busca con un `JOIN` entre `sessions` y `users`, filtrando por `token_hash = :token_hash AND expires_at > CURRENT_TIMESTAMP`. Al iniciar sesión también se borran las sesiones expiradas de ese usuario, para que la tabla no crezca sin límite.

Duración fija de 30 días y sin renovación: es simple y no escribe en la base en cada petición. Para un dueño que entra cada pocos días, iniciar sesión una vez al mes es aceptable.

**Alternativa descartada:** cookies firmadas sin estado (`itsdangerous`). No permiten cerrar una sesión concreta ni invalidar todas al restablecer la contraseña, que la spec exige.

### D6 - Cookie `lumia_session`

`Set-Cookie: lumia_session=<secreto>; HttpOnly; SameSite=Lax; Path=/api; Max-Age=2592000`. Lleva `Path=/api` porque solo la API la lee y así no viaja con `/images/` ni con los recursos estáticos. No lleva `Secure` (ver `proposal.md`, fuera de alcance). Logout responde con la misma cookie vacía y `Max-Age=0`, con el mismo `Path`.

CSRF: `SameSite=Lax` impide que un `POST` desde otro sitio envíe la cookie, y el login exige JSON (`strict_content_type`), así que un formulario de otro sitio tampoco puede abrir una sesión a nombre de otro.

### D7 - Contrato de la API

Todas las respuestas usan el `Envelope` de D12.

| Ruta | Respuesta exitosa | Errores |
| --- | --- | --- |
| `POST /api/auth/login` `{email, password}` | `200 {data: {id, email}}` + cookie | `401 invalid_credentials`, `422 validation_failed` |
| `GET /api/auth/me` | `200 {data: {id, email}}` | `401 unauthenticated` |
| `POST /api/auth/logout` | `200 {data: null}` + cookie vacía | ninguno |

`current_user` es una dependencia que devuelve el `UserRecord` de la sesión o lanza `UnauthenticatedError`. Como en `pixpick`, la comprobación de que existe la cookie es una subdependencia declarada antes de `get_connection`, para que una petición sin cookie no tome una conexión del pool. Ninguna ruta del dueño sortea `current_user` ni lee la cookie por su cuenta. Logout responde `200` con `data: null` en vez de `204`, porque un `204` no tiene cuerpo y rompería la forma común.

### D8 - CLI `reset-password` con `argparse`

`backend/src/cli.py` usa `argparse` con un solo subcomando y llama al servicio de `auth`: `python -m src.cli reset-password <email>`. Pide la contraseña con `getpass` dos veces, valida los límites de D4 y, en una sola transacción (`transaction()` de `src/database/utils.py`), actualiza `password_hash` y borra las sesiones del usuario. Sale con código 1 y un mensaje en stderr ante email inexistente, confirmación distinta o contraseña inválida. En contenedores se usa `docker compose exec backend python -m src.cli reset-password <email>` (con TTY, que `exec` da por defecto).

**Alternativa descartada:** Typer. Llega solo como dependencia transitiva de `fastapi[standard]`; usarlo exigiría declararlo, y un único subcomando no lo justifica.

### D9 - Frontend: Query, cliente con axios y guard en `beforeLoad`

- `main.tsx` usa `getRouter()` de `router.tsx`, que crea el `QueryClient` y lo pasa como contexto del router (`createRootRouteWithContext<{ queryClient }>`), y envuelve la app en `QueryClientProvider`. Así queda un solo lugar donde se crea el router.
- `src/lib/api.ts`: instancia de axios con `baseURL: "/api"`; `withCredentials` no hace falta porque todo es del mismo origen. Desenvuelve el `Envelope` (D12): las funciones `login`, `logout` y `getMe` devuelven `data`, y ante un error lanzan un `ApiError` con `status`, `code` y `field`, para que las pantallas decidan por el código y no por el mensaje.
- Ruta de layout sin path `_owner` (`src/routes/_owner.tsx`). Su `beforeLoad` hace `queryClient.ensureQueryData` de `["me"]` y, ante un `ApiError` con código `unauthenticated`, lanza `redirect({ to: "/login", search: { redirect: location.href } })`. La página de inicio actual pasa a `src/routes/_owner/index.tsx`, como esqueleto con el email del dueño y el botón "Cerrar sesión".
- `src/routes/login.tsx` sigue el mockup `b-Main` de `local/lumia-mobile.html`: un logo cuadrado con el color primario, el título "Lumia" con la frase de la app, los campos "Correo" y "Contraseña" con su etiqueta encima y controles de 48 px de alto, el botón primario de ancho completo "Iniciar sesión" y, al pie, la nota "¿Olvidaste la contraseña? Restablécela desde el servidor con el comando `reset-password`". Valida `search.redirect` con zod, y solo acepta rutas internas que empiezan por `/`, para que no sirva de redirección abierta. Al iniciar sesión guarda el usuario en la caché `["me"]` y navega al destino. Ante un `ApiError` con código `invalid_credentials`, muestra "Email o contraseña incorrectos" y conserva el email. Ante cualquier otro error, muestra un mensaje genérico de reintento. Si ya hay sesión al entrar a `/login`, redirige a `/`.
- Logout: llama a la API, hace `queryClient.clear()` y navega a `/login`.
- Los componentes `input`, `label` y `card` se agregan con el MCP de shadcn (`CLAUDE.md`).

**Alternativa descartada:** guardar el estado de sesión en `localStorage`. La cookie `HttpOnly` es la fuente de verdad y `/api/auth/me` la consulta. Una copia en el navegador podría desincronizarse.

### D10 - Tema: Caffeine con Miel tostada y Grafito

La interfaz adopta la paleta elegida en `local/lumia-caffeine.html`: el acento Miel tostada y el modo oscuro Grafito. Este change la instala porque la pantalla de login es la primera que ve el usuario. Los tokens de shadcn en `frontend/src/styles.css` (`:root` y su variante oscura) se reemplazan por los que genera ese archivo para esa combinación (los mismos de los mockups de `local/lumia-mobile.html`):

- Claro: `--primary` y `--ring` en `oklch(0.56 0.09 58)`, con `--primary-foreground` blanco, y fondo, tarjetas, bordes y textos en grises neutros (`--background: oklch(0.9821 0 0)`, `--foreground: oklch(0.2435 0 0)`). `--secondary` es un tono miel claro.
- Oscuro: `--primary` y `--ring` en `oklch(0.76 0.1 65)`, con `--primary-foreground: oklch(0.2 0.02 55)`, y las superficies grafito sin croma (`--background: oklch(0.17 0 0)`, `--card: oklch(0.215 0 0)`, `--border: oklch(0.3 0 0)`).
- Tokens propios `--like`, `--like-foreground` y `--dislike`, expuestos en `@theme inline` como `--color-like`, etc. Los usará el mazo, pero se definen ahora para que la paleta quede completa en un solo lugar.
- `--radius: 0.5rem` (los 8 px de los mockups).

El modo oscuro sigue la preferencia del sistema. Para eso, `@custom-variant dark` pasa a `@media (prefers-color-scheme: dark)` y los tokens oscuros se definen dentro de esa media query, sin selector de tema ni JavaScript. La tipografía se mantiene en Inter, que ya está instalada; los mockups solo fijan la paleta.

**Alternativa descartada:** un selector de tema en la interfaz. No está en el alcance de 0.1.0 y la preferencia del sistema cubre el caso del teléfono.

### D11 - Pruebas

Las pruebas usan la base migrada de la sesión (`conftest.py`), que además define `ADMIN_EMAIL` y `ADMIN_PASSWORD` en `pytest_configure`. Como los datos persisten entre pruebas, cada prueba crea sus usuarios con emails únicos mediante el servicio, en vez de depender del usuario sembrado. El sembrado se prueba aparte con una base temporal propia, migrada con `run_dbmate`, y un engine apuntado a ella. La expiración se prueba insertando una sesión con `expires_at = datetime('now', '-1 minute')`. La prueba del healthcheck que hoy sobrescribe `get_session` pasa a sobrescribir `get_connection`. El CLI se prueba llamando a su función `main(argv)` con `getpass` sustituido por `monkeypatch`.

El frontend no tiene framework de pruebas; los escenarios de interfaz se verifican en el navegador contra `docker compose up` (tareas finales).

### D12 - Formato de respuestas y errores de `pixpick`

Se adopta tal cual el contrato de `pixpick` (spec `api-conventions`), para que el frontend y los próximos paquetes tengan una sola forma que manejar:

- `src/models.py`: `ApiModel`, la base de todo modelo que cruza la API. Usa `alias_generator=to_camel`, `populate_by_name=True` y `from_attributes=True`. Los campos se declaran en snake_case y se serializan en camelCase. Los routers devuelven los modelos y FastAPI los serializa por alias.
- `src/responses.py`: `Envelope[T]` (`data`, `error`) y `ErrorBody` (`code`, `message`, `field`, `requestId`, `details`, `retryAfterSeconds`), más `error_envelope(...)`, que arma el cuerpo de error. `retryAfterSeconds` se conserva para que la forma sea idéntica a la de `pixpick`, aunque en 0.1.0 ningún error lo usa.
- `src/exceptions.py`: las excepciones de dominio compartidas: `DatabaseError` (`DatabaseUnavailableError`, `QueryExecutionError`), `UnauthenticatedError`, `ForbiddenError`, `NotFoundError`, `ValidationFailedError(field, message)` y `StateConflictError(code, message, details)`. Los servicios lanzan estas excepciones, nunca `HTTPException`.
- Las excepciones propias de un paquete viven en su `exceptions.py` (`packages/auth/exceptions.py` con `InvalidCredentialsError`).
- `src/handlers.py`: `register_exception_handlers(app)` asigna a cada excepción su estado y su código:

| Excepción | Estado | `code` |
| --- | --- | --- |
| `DatabaseError` | 503 | `service_unavailable` |
| `UnauthenticatedError` | 401 | `unauthenticated` |
| `InvalidCredentialsError` | 401 | `invalid_credentials` |
| `ForbiddenError` | 403 | `forbidden` |
| `NotFoundError` | 404 | `not_found` |
| `ValidationFailedError` y `RequestValidationError` | 422 | `validation_failed`, con `field` |
| `StateConflictError` | 409 | el `code` de la excepción, con `details` |
| `StarletteHTTPException` (incluye rutas inexistentes) | el de la excepción | `http_error` |
| `Exception` | 500 | `internal_error`, con `requestId` |

El 500 genera un `uuid4`, lo registra con la traza mediante `loguru` (ya declarado) y solo devuelve el identificador. Los helpers de `src/database/client.py` envuelven `SQLAlchemyError` en `QueryExecutionError`, y el healthcheck lanza `DatabaseUnavailableError` en vez de un `HTTPException(503)`, como en `pixpick`. El healthcheck devuelve `Envelope[HealthData]` con `{"data": {"status": "ok"}}`; el healthcheck de `compose.yaml` solo mira el código HTTP, así que sigue funcionando.

No se adopta la falta de capacidad (`InsufficientCapacityError`, 503 con `Retry-After`). En `pixpick` cubre el agotamiento del pool de Postgres; con SQLite, una espera por el escritor ya la absorbe `busy_timeout`. Si apareciera el caso, el campo `retryAfterSeconds` ya está en la forma.

**Alternativa descartada:** el formato por defecto de FastAPI (`{"detail": ...}`). Cambia de forma según el error (cadena o lista de errores de validación), no tiene código estable y obligaría a cambiar todos los endpoints y el cliente cuando se quisiera uniformar.

## Risks / Trade-offs

- [Sin límite de intentos, un atacante con acceso a la red puede probar contraseñas] → Cada intento cuesta ~250 ms de bcrypt, el mínimo es de 8 caracteres y el uso previsto es local. El rate limiting queda como no meta explícita.
- [Cookie sin `Secure` si se expone por HTTPS sin cambios] → Documentado en el README; añadir `COOKIE_SECURE` es un cambio de una línea cuando haga falta.
- [`ADMIN_PASSWORD` queda en `.env` después del primer arranque] → El README recomienda cambiarla con `reset-password` y borrar el valor real del `.env`, dejando uno de relleno que cumpla los límites, porque la variable sigue siendo obligatoria.
- [Una prueba que dependa de datos de otra] → Emails únicos por prueba (D11).
- [El backend arranca contra una base sin migrar en modo nativo y el sembrado falla al no encontrar `users`] → Es el comportamiento deseado: falla rápido con un error de SQLAlchemy que nombra la tabla. El README de modo nativo ya indica migrar primero.

## Migration Plan

No hay migraciones de esquema. Una instalación local existente debe añadir `ADMIN_EMAIL` y `ADMIN_PASSWORD` a `.env`; sin ellas el backend no arranca y el error nombra la variable. En el primer arranque se siembra la cuenta. Para revertir basta con volver al commit anterior; la fila sembrada en `users` no estorba.

## Open Questions

Ninguna.
