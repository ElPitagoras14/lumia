## Why

Lumia 0.1.0 tiene que levantarse con `docker compose up`, sin cuentas externas, y con el navegador entrando siempre por una sola puerta que reparte la interfaz, la API y las imágenes. Esa topología condiciona a todo lo que viene después: el login del dueño necesita cookies del mismo origen, el mazo de swipe necesita variantes de imagen cacheadas y las reglas de negocio necesitan una base con migraciones. Si cada change de producto arma además su parte del entorno, el alcance de esos changes crece, que es justo lo que Lumia intenta evitar después de Pixpick.

Hoy el repositorio es el `scaffold-base` sin modificar: un `main.py` con un solo endpoint, una ruta de bienvenida en el frontend y ninguna infraestructura declarada. Este change deja el entorno levantado y verificable, sin ninguna funcionalidad de producto, para que los changes siguientes solo agreguen comportamiento.

## What Changes

- **Orquestación**: un `compose.yaml` con los cuatro servicios (`nginx`, `frontend`, `backend`, `transformer`), un servicio `migrate` de un solo uso y un volumen `/data`. Solo `nginx` publica un puerto al host.
- **nginx como única puerta**: `/api` va al backend sin reescritura y sin fallback al SPA, `/images/` va a imgproxy con `proxy_cache`, y `/` va al frontend.
- **Backend**: configuración con Pydantic Settings, conexión a SQLite en `/data/lumia.db` con modo WAL y claves foráneas activas, y un healthcheck que prueba la base. La migración inicial está vacía, porque las tablas llegan con el change que las use.
- **Migraciones con dbmate en una imagen propia**, como en aniseek: SQL plano en `dbmate/migrations/` empaquetado en una imagen `migrate` ligera, que aplica lo pendiente y termina. El backend arranca solo si `migrate` terminó bien. Así migrar no depende de la API, y pasar a Postgres más adelante conserva la herramienta, la imagen y la forma del compose.
- **Imágenes**: imgproxy lee los originales de `/data` en solo lectura y rechaza las URLs que no estén firmadas con `IMAGE_SIGNING_KEY` y `IMAGE_SIGNING_SALT`.
- **Frontend**: imagen multi-etapa que construye con pnpm y sirve los estáticos con su propio nginx, con fallback para el enrutado del cliente. La ruta índice del scaffold se reemplaza por una pantalla mínima de Lumia en español.
- **Imágenes propias**: un `Dockerfile` para `nginx`, `frontend` y `backend`. `transformer` usa la imagen oficial de imgproxy con la versión fijada.
- **Modo nativo**: el backend corre con `uv` contra un archivo SQLite local y el servidor de desarrollo de Vite reenvía `/api` al backend, sin variables distintas entre modos.
- **Dependencias del backend**: se agrega `pytest` (dev). Se quita `psycopg`, porque la base es SQLite.
- **`.env.example`** con solo las variables que este change usa, y el `README.md` con el arranque.

### Fuera de alcance

Estos puntos pertenecen a changes posteriores de 0.1.0:

- Tablas de dominio (`users`, `sessions`, `albums`, `photos`, `share_tokens`, `participants`, `ratings`), el sembrado del dueño y el login.
- El módulo `images` con `variant_url` y el calentado de la caché al subir. En este change imgproxy y la caché se verifican con una URL firmada a mano.
- Álbumes, subida, compartir, mazo de swipe y resultados.
- La política de revocación del enlace para participantes existentes, que sigue pendiente de decisión del usuario.
- Lo que el diseño de 0.1.0 deja fuera: TLS, rate limiting, cuotas, retención, pipeline de release y despliegue.

## Capabilities

### New Capabilities

- `local-environment`: qué servicios componen Lumia, cómo se levanta con un comando, por dónde entra el tráfico, qué se expone al host y dónde persisten los datos.
- `frontend-delivery`: cómo se construye y se sirve la interfaz, incluida la resolución de rutas del lado del cliente y el cacheo de los estáticos.
- `database-migrations`: cómo un paso de migración separado del backend lleva la base SQLite al esquema vigente antes de que arranque la API, y con qué garantías se conecta el backend a ella.
- `image-delivery`: cómo se entregan las variantes de imagen: firma obligatoria, acceso de solo lectura a los originales y caché en la puerta de entrada.

### Modified Capabilities

Ninguna. `openspec/specs/` está vacío: este es el primer change del proyecto.

## Impact

**Archivos nuevos**

- `compose.yaml`, `VERSION`
- `nginx/Dockerfile`, `nginx/nginx.conf`
- `dbmate/Dockerfile`, `dbmate/migrations/0001_initial.sql`
- `backend/Dockerfile`, `backend/.dockerignore`
- `backend/src/config.py`, `backend/src/database.py`, `backend/src/health.py`, `backend/tests/`
- `frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/nginx.conf`

**Archivos modificados**

- `backend/src/main.py`: router bajo `/api`.
- `backend/pyproject.toml` y `backend/uv.lock`: `pytest`, sin `psycopg`.
- `frontend/vite.config.ts`: proxy de `/api` para el modo nativo.
- `frontend/src/routes/index.tsx`, `frontend/index.html`: pantalla mínima e idioma `es`.
- `.env.example`, `.gitignore` (directorio de datos local), `README.md`.

**Dependencias**

- Python: `pytest` (dev). Se quita `psycopg`.
- npm: ninguna.
- Imágenes de terceros con versión exacta: `python`, `node`, `nginx`, `imgproxy` y `dbmate`.

**Sistemas afectados**

Ninguno en producción: Lumia no está desplegado. Para el entorno completo hace falta Docker, y el modo nativo sigue funcionando sin él.
