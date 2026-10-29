## 1. Infraestructura del backend

- [x] 1.1 Convertir `src/database.py` en el paquete `src/database/`: `client.py` (engine, `PRAGMA` y los helpers `write`, `fetch_one`, `fetch_all`, `fetch_val` y `fetch_val_or_none`), `utils.py` (`transaction()`) y `dependencies.py` (`get_connection`, una transacción por petición) (D2). Quitar `sessionmaker` y `get_session`, migrar `src/health.py`, `tests/test_health.py` y `tests/test_database.py`, y agregar pruebas de los helpers (una fila validada contra un modelo, ninguna fila, commit al salir de `transaction()` sin error y rollback si hay una excepción). Verificar que `uv run pytest` pasa y que `grep -rn "sqlalchemy.orm" backend/src` no devuelve nada.
- [x] 1.2 Crear `src/routes.py` con `api_router` (prefijo `/api`) que incluye el router de health, y dejar `src/main.py` con la app, el `lifespan` y `include_router(api_router)` (D1). Verificar que `GET /api/health` sigue respondiendo 200 en `tests/test_health.py`.

- [x] 1.3 Crear `src/models.py` (`ApiModel`), `src/responses.py` (`Envelope`, `ErrorBody`, `error_envelope`), `src/exceptions.py` y `src/handlers.py` con la tabla de D12, y registrar los manejadores en `src/main.py`. Hacer que los helpers de `src/database/client.py` envuelvan `SQLAlchemyError` en `QueryExecutionError` y que el healthcheck devuelva `Envelope[HealthData]` y lance `DatabaseUnavailableError`. Verificar con `tests/test_error_handling.py` cada escenario de `specs/api-conventions/spec.md` usando rutas de prueba montadas solo en la prueba (excepción inesperada con `requestId` en el cuerpo y en el log, conflicto 409, validación con `field`, ruta inexistente, camelCase), y actualizar `tests/test_health.py` a la forma nueva y al 503 sin detalles internos.

## 2. Paquete `auth`: configuración, seguridad y repositorio

- [x] 2.1 Crear `src/packages/auth/config.py` con `AuthSettings` (`admin_email` como `EmailStr`, `admin_password` de 8 caracteres a 72 bytes) y las constantes de sesión y cookie (30 días, `lumia_session`, `Path=/api`) (D3, D4, D6), y definir `ADMIN_EMAIL` y `ADMIN_PASSWORD` en `pytest_configure` de `tests/conftest.py`. Verificar con pruebas que `AuthSettings` falla nombrando la variable cuando falta o cuando la contraseña tiene 7 caracteres o 73 bytes.
- [x] 2.1b Crear `exceptions.py` con `InvalidCredentialsError` y registrar su manejador (401 `invalid_credentials`) en `src/handlers.py` (D12). Verificar con una prueba de `test_error_handling.py`.
- [x] 2.2 Crear `security.py` con el hash y la verificación bcrypt, el hash fijo para emails inexistentes, la generación del secreto de sesión y su SHA-256 (D4, D5). Verificar con pruebas unitarias que un hash verifica su contraseña y rechaza otra, y que dos secretos generados son distintos.
- [x] 2.3 Crear `schemas.py` (`UserRecord`, `LoginRequest`) y `repository.py` con el SQL de usuarios y sesiones, usando los helpers de `src.database.client`: contar usuarios, insertar usuario, buscar por email, actualizar contraseña, insertar sesión, resolver una sesión vigente con `JOIN`, borrar una sesión, borrar las del usuario y borrar las expiradas. Las fechas se calculan en SQL (D1, D2, D2b). Verificar con `tests/packages/auth/test_repository.py` que se insertan y leen un usuario y una sesión, y que una sesión con `expires_at` pasado no se resuelve.

## 3. Paquete `auth`: servicio, dependencias y router

- [x] 3.1 Crear `service.py` con login, logout, resolución de sesión, sembrado y restablecimiento de contraseña, recibiendo la conexión como argumento y sin importar FastAPI (D1, D3, D5). Llamar al sembrado desde el `lifespan` con `transaction()`. Verificar con `tests/packages/auth/test_service.py` que la fila de sesión no contiene el secreto, que el login borra las sesiones expiradas del usuario y, con una base temporal migrada con `run_dbmate`, los escenarios "Primer arranque", "Arranque posterior con otra contraseña" y "Contraseña no guardada en claro".
- [x] 3.2 Crear `responses.py` (`CurrentUserResponse`), `dependencies.py` (`current_user`) y `router.py` (`APIRouter(prefix="/auth")` con `POST /login`, `GET /me` y `POST /logout`) según D6 y D7, e incluirlo en `src/routes.py`. Verificar con `tests/packages/auth/test_dependencies.py` los escenarios "Sin cookie", "Secreto alterado" y "Sesión expirada" sobre `current_user`.
- [x] 3.3 Escribir `tests/packages/auth/test_router.py` con una prueba por escenario de los requisitos de login, sesiones, rutas del dueño y logout de `specs/owner-auth/spec.md`, incluidos los atributos `HttpOnly`, `SameSite=Lax`, `Path=/api` y `Max-Age` de la cookie, el rechazo de un cuerpo de formulario y los cuerpos con `Envelope` y los códigos de D7 (`invalid_credentials`, `unauthenticated`, `validation_failed` con `field: "password"`). Verificar que `uv run pytest tests/packages/auth` pasa.

## 4. CLI

- [x] 4.1 Crear `src/cli.py` con el subcomando `reset-password`, que usa `transaction()` y el servicio de `auth` (D8). Verificar con `tests/packages/auth/test_cli.py`, sustituyendo `getpass` con `monkeypatch`, los escenarios "Restablecer la contraseña", "Email inexistente" y "Confirmación distinta", más una contraseña de 7 caracteres.
- [x] 4.2 Verificar que `uv run pytest`, `uv run ruff check` y `uv run ruff format --check` pasan en `backend/`.

## 5. Configuración y documentación

- [x] 5.1 Añadir `ADMIN_EMAIL` y `ADMIN_PASSWORD` a `.env.example` (ambos perfiles, con un comentario sobre que solo se usan en el primer arranque) y al `environment` del servicio `backend` en `compose.yaml`; verificar que `docker compose config` las resuelve y que el backend sin `ADMIN_PASSWORD` no arranca y nombra la variable en el log.
- [x] 5.2 Actualizar `README.md`: filas nuevas en la tabla de variables de entorno, una sección breve de la cuenta del dueño (sembrado único, `reset-password` en contenedores y en modo nativo, cookie sin `Secure` y cómo quitar la contraseña real del `.env`); verificar que respeta el estilo de `CLAUDE.md`.

## 6. Frontend

- [x] 6.1 Agregar `input`, `label` y `card` con el MCP de shadcn en `frontend/src/components/ui`; verificar que los archivos existen y que `pnpm check` pasa.
- [x] 6.1b Reemplazar los tokens de color de `frontend/src/styles.css` por la paleta Caffeine con Miel tostada y Grafito: los de modo claro y oscuro, `--like`, `--like-foreground` y `--dislike` en `@theme inline`, `--radius: 0.5rem` y la variante `dark` ligada a `prefers-color-scheme` (D10). Verificar que el CSS compilado por `pnpm build` contiene `oklch(0.56 0.09 58)` y `oklch(0.76 0.1 65)`, y que con el sistema en modo oscuro el fondo cambia a grafito.
- [x] 6.2 Unificar la creación del router en `router.tsx` con `QueryClient` como contexto y `QueryClientProvider` en `main.tsx`, y crear `src/lib/api.ts` con `login`, `logout` y `getMe`, que desenvuelven el `Envelope` y lanzan `ApiError` con `status`, `code` y `field` (D9, D12); verificar que `pnpm build` termina sin errores.
- [x] 6.3 Crear la ruta de layout `_owner` con el guard en `beforeLoad` y mover la página de inicio a `_owner/index.tsx` con el email del dueño y el botón "Cerrar sesión" (D9); verificar en `pnpm dev` que abrir `/` sin sesión lleva a `/login?redirect=...`.
- [x] 6.4 Crear `src/routes/login.tsx` según el mockup `b-Main` de `local/lumia-mobile.html`, con el formulario en español, la nota de `reset-password`, el manejo de 401, la validación de `redirect` (solo rutas internas) y la redirección a `/` si ya hay sesión (D9); verificar que `pnpm check` y `pnpm build` pasan.

## 7. Verificación integral

- [x] 7.1 Con `docker compose up --build` y un volumen nuevo, verificar en el navegador los escenarios del requisito de interfaz de `specs/owner-auth/spec.md` (entrar sin sesión, iniciar sesión y volver a la ruta pedida, credenciales rechazadas que conservan el email, cerrar sesión), que la cookie `lumia_session` aparece con `HttpOnly`, `SameSite=Lax` y `Path=/api`, y que a 360 px no hay desplazamiento horizontal.
- [x] 7.2 Ejecutar `docker compose exec backend python -m src.cli reset-password <ADMIN_EMAIL>` y verificar que la sesión abierta en el navegador pasa a pedir login y que solo la contraseña nueva funciona. Reiniciar el backend y verificar que sigue valiendo la contraseña nueva, no la de `ADMIN_PASSWORD`.
