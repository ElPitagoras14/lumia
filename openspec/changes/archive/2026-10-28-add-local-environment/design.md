## Context

El repositorio es el `scaffold-base` sin modificar. El backend es un paquete `src` con un único `main.py` y dependencias pensadas para Postgres (`psycopg`). El frontend trae TanStack Router con generación de rutas por archivo y una ruta índice de bienvenida. No hay Dockerfiles, compose ni configuración de nginx.

El diseño de 0.1.0 (`local/2026-10-28-lumia-0.1.0-design.md`) fija las restricciones que este change concreta. Los servicios son `nginx`, `frontend`, `backend` y `transformer` (imgproxy). SQLite y los originales van en un volumen `/data`, y se usan solo componentes locales. Ese diseño aplicaba migraciones Alembic desde el backend al arrancar. Al revisar este change, el usuario decidió usar dbmate en una imagen `migrate` ligera, como aniseek, para facilitar un futuro paso a Postgres (D6). Pixpick (`ElPitagoras14/pixpick`) sirve de referencia para la forma del edge, los Dockerfiles y las convenciones, pero no para su alcance: allí había Postgres, un servicio `dbmate`, MinIO, rate limiting y dos archivos de compose.

El entorno de desarrollo es Windows. Todo script o archivo de configuración que termine dentro de una imagen tiene que ser inmune al final de línea del working tree. `.gitattributes` ya fuerza `eol=lf` para `*.sh`.

## Goals / Non-Goals

**Goals:**

- Que `docker compose up` deje la aplicación accesible por un único origen, con la misma topología que tendrá cuando exista funcionalidad.
- Que el primer change que agregue tablas solo tenga que escribir una migración. Conexión, pragmas, dbmate y la imagen que la aplica ya quedan resueltos aquí.
- Que la ruta de imágenes, la firma y la caché queden verificadas antes de que existan fotos. Así el change de subida solo agrega `variant_url` y no depura infraestructura.
- Que el backend y la interfaz se puedan desarrollar fuera de contenedores sin variables distintas.

**Non-Goals:**

- Tablas de dominio, sembrado del dueño, login y cualquier endpoint que no sea el healthcheck.
- El módulo `images` del backend y el calentado de caché al subir.
- Ver imágenes en el modo nativo. imgproxy solo corre en contenedor, y el modo nativo de este change cubre backend e interfaz. El change de subida decide si hace falta.
- TLS, despliegue, rate limiting y límites de memoria finos. El diseño de 0.1.0 deja los límites de memoria al builder, y en este change se omiten porque no hay carga que medir.

## Decisions

### D1 - nginx es un servicio propio y el frontend conserva su nginx interno

Hay dos capas de nginx, como en Pixpick. El servicio `nginx` decide a dónde va cada petición y qué se cachea. El nginx de la imagen `frontend` solo entrega estáticos y aplica el fallback del enrutado del cliente. Ninguna directiva de cacheo de imágenes vive en el frontend y ninguna decisión sobre estáticos vive en el edge.

**Alternativa descartada:** un solo nginx que sirva los estáticos y además haga proxy de `/api` e `/images/`. Ahorra un contenedor, pero el diseño de 0.1.0 ya fija `frontend` como servicio aparte. Además, la caché de imágenes (volumen, zona y política) quedaría mezclada con la entrega del SPA, y esas dos cosas cambian por motivos distintos.

### D2 - `/api` se proxea sin reescritura y sin fallback

El backend monta su router bajo `/api` y nginx pasa la ruta tal cual. Cualquier URL que genere el backend (OpenAPI, redirecciones) es entonces la misma que ve el navegador. La location de `/api` no tiene `try_files` ni `error_page` hacia el SPA, así que un backend caído responde 502 y no el HTML con 200.

Los upstreams se declaran por variable con el resolver de Docker (`resolver 127.0.0.11`). Si no, nginx se niega a arrancar cuando un servicio todavía no existe y no vuelve a resolver la dirección cuando un contenedor se recrea. Es la misma solución que usa Pixpick.

### D3 - imgproxy se monta bajo `/images` con su propio prefijo, sin reescritura

imgproxy acepta un prefijo de ruta configurable (`IMGPROXY_PATH_PREFIX=/images`), así que nginx tampoco reescribe esta ruta. La firma se calcula sobre la ruta sin el prefijo, que es lo que documenta imgproxy y lo que usará `variant_url`.

- Los originales se leen con `IMGPROXY_LOCAL_FILESYSTEM_ROOT=/data`, con fuentes `local:///photos/<uuid>`. imgproxy rechaza las rutas que salen de esa raíz.
- `IMGPROXY_KEY` e `IMGPROXY_SALT` se alimentan de `IMAGE_SIGNING_KEY` y `IMAGE_SIGNING_SALT`, en hexadecimal. Los nombres del proyecto son los que verá el backend cuando firme; el compose los traduce a los nombres de imgproxy.
- El volumen se monta `:ro` en `transformer`.
- nginx cachea con `proxy_cache` y `proxy_cache_valid 200` de larga duración, sin entradas para códigos de error, así que un 404 no queda cacheado. Las variantes son inmutables porque la URL firmada identifica fuente y transformación.

**Alternativa descartada:** posponer `transformer` y la ruta `/images/` al change de subida, como hizo Pixpick para no tener servicios sin consumidor. Aquí el usuario ya fijó los cuatro servicios para 0.1.0. Además, verificar ahora firma, solo lectura y caché con una URL firmada a mano saca esa depuración del change de subida, que ya trae bastante.

### D4 - Un solo `compose.yaml`

Un único archivo declara los cuatro servicios, el servicio de un solo uso `migrate` (D6), la red y el volumen `lumia-data`. Publica solo el puerto de `nginx`, como `${HTTP_PORT}:80`. Los servicios propios se construyen desde su `Dockerfile` con `build:`, no se descargan de un registro.

**Alternativa descartada:** el par `compose.yaml` y `compose.dev.yaml` de Pixpick. Ese par existía porque el archivo base describía un despliegue real en Dokploy. Lumia no tiene despliegue ni pipeline de release en 0.1.0, así que un segundo archivo solo agregaría combinaciones que verificar. Si llega un despliegue, separarlo es un change acotado.

### D5 - SQLite con SQLAlchemy síncrono, WAL y pragmas por conexión

El backend crea un `Engine` síncrono sobre `sqlite:///<DATA_DIR>/lumia.db`. Un listener de `connect` aplica `PRAGMA foreign_keys=ON` y `PRAGMA busy_timeout=5000` a cada conexión, porque SQLite no los persiste. `PRAGMA journal_mode=WAL` sí persiste en el archivo. Lo fija el mismo listener, porque es idempotente, y no una migración: así las migraciones de dbmate corren dentro de su transacción normal (WAL no se puede activar dentro de una) y el esquema queda libre de detalles de SQLite.

- Los endpoints síncronos de FastAPI corren en su threadpool, así que la API no se bloquea. Un driver asíncrono para SQLite no daría paralelismo real de escritura, y sí sumaría una dependencia y otro estilo de sesión.
- El backend corre con un único proceso de uvicorn. Varias instancias competirían por el único escritor de SQLite, sin beneficio en este alcance.
- `DATA_DIR` es obligatoria y no tiene valor por defecto. Si falta, Pydantic Settings falla al arrancar nombrando la variable. La base no debe crearse en silencio en una ruta inesperada.

**Alternativa descartada:** SQLAlchemy asíncrono con `aiosqlite`. Se descarta por lo dicho arriba: más piezas sin ganancia con un solo escritor.

### D6 - Las migraciones son SQL de dbmate, empaquetadas en una imagen `migrate` propia

Se replica el esquema de aniseek. Las migraciones viven en `dbmate/migrations/`, en la raíz del repositorio, como SQL plano con las secciones `-- migrate:up` y `-- migrate:down`. `dbmate/Dockerfile` parte de `ghcr.io/amacneil/dbmate` en versión exacta y copia `migrations/` a `/db/migrations`, la ruta por defecto de dbmate. No declara `ENTRYPOINT` ni `CMD`: hereda los de la base.

En compose, `migrate` se construye desde `./dbmate` con `command: ["--no-dump-schema", "up"]`, `DATABASE_URL=sqlite:/data/lumia.db` y el volumen `/data` con lectura y escritura. Aplica lo pendiente y termina. `backend` declara `depends_on: migrate: condition: service_completed_successfully`. Si una migración falla, `migrate` sale con error, `backend` no arranca y `/api` responde con error de gateway. El backend no conoce las migraciones ni toca el esquema.

- **Imagen ligera:** un binario de dbmate más archivos SQL, sin Python ni dependencias del backend. Las migraciones viajan dentro de la imagen, así que un despliegue con imágenes ya construidas no necesita el repositorio en el host. Nada se monta sobre `/db`, porque eso reemplazaría lo empaquetado.
- **Nombres:** `NNNN_descripcion.sql`, con número secuencial de cuatro dígitos, como aniseek. dbmate registra la versión numérica en `schema_migrations`.
- **Migración inicial:** `0001_initial.sql` existe pero no crea tablas. Fija el punto de partida y permite verificar el mecanismo sin inventar tablas que pertenecen a otros changes. Su sección `down` queda vacía a propósito.
- **`--no-dump-schema`:** el volcado de `schema.sql` necesita el cliente `sqlite3` y no aporta nada en este alcance.
- **Sin `ALTER TABLE` automático:** dbmate no reescribe nada, así que en SQLite cada cambio que no sea agregar una columna se escribe a mano recreando la tabla. Es el costo de tener SQL plano.
- **Paso a Postgres:** el servicio, la imagen y el `depends_on` siguen iguales. Cambia `DATABASE_URL`, se agrega la espera a que Postgres esté sano, igual que `aniseek-migrate`, y la URL del backend. El SQL escrito para SQLite no se trasladará tal cual: los tipos y las recreaciones de tabla difieren, así que el paso implica una migración inicial nueva para Postgres. Lo que se gana desde hoy es que la herramienta, la imagen y la forma de desplegar ya son las definitivas.

**Alternativas descartadas:** aplicar Alembic desde el lifespan del backend, como proponía el diseño de 0.1.0. Ata el esquema al arranque de la API y no permite migrar sin levantarla. También se descartó Alembic en una imagen `migrate` aparte: esa imagen necesitaría Python, SQLAlchemy y la configuración del backend, así que no sería ligera, y se apartaría de la convención de aniseek. El usuario eligió dbmate.

### D7 - El healthcheck consulta la base

`GET /api/health` ejecuta `SELECT 1` en una conexión. Si funciona responde 200, y si falla responde 503. Es lo que usa el `healthcheck` del servicio `backend` en compose. A diferencia del primer change de Pixpick, aquí la base existe desde el arranque, así que un healthcheck que no la tocara mentiría.

### D8 - El modo nativo comparte nombres de variable y un origen

En modo nativo `DATA_DIR` vale `./data` (ignorado por git) en vez de `/data`, y ese es el único valor que cambia. El paso de migración se ejecuta a mano antes de arrancar el backend, con la misma imagen de dbmate en un `docker run --rm` que monta `dbmate/` en `/db` y el directorio de datos local en `/data`. El `README.md` documenta el comando exacto. Así los dos modos aplican las migraciones con la misma versión de dbmate, y el modo nativo solo necesita Docker para ese paso. El servidor de desarrollo de Vite reenvía `/api` a `http://localhost:8000`. El destino es fijo en `vite.config.ts` porque solo existe en desarrollo y no es configuración de la aplicación. Así la interfaz pide rutas relativas en ambos modos y no hace falta CORS.

### D9 - La interfaz no necesita configuración en runtime

Pixpick inyectaba configuración al arrancar el contenedor del frontend con un entrypoint. En Lumia la interfaz solo habla con su propio origen por rutas relativas (`/api`, `/images/`), así que no hay valores de entorno que inyectar. No hay entrypoint ni plantilla de configuración. La imagen del frontend sirve estáticos y nada más. Si un change futuro necesita un valor de entorno en la interfaz, ese change agrega el mecanismo.

### D10 - Versiones exactas y paquete `src`

Toda imagen de terceros (`python`, `node`, `nginx`, `imgproxy`, `dbmate`, más la imagen de `uv` copiada en el Dockerfile) se fija con la versión estable vigente al implementar. El paquete del backend sigue llamándose `src`, como en el scaffold, y no `lumia`, para no chocar con el paquete homónimo de PyPI.

### D11 - Pruebas del backend con pytest desde este change

Se agrega `pytest` como dependencia de desarrollo, con pruebas que corren contra un `DATA_DIR` temporal: migrar desde una base inexistente, rechazo de clave foránea, modo WAL activo y healthcheck 200 y 503. Como en aniseek, el esquema de pruebas se construye corriendo la misma imagen de dbmate sobre `dbmate/migrations/` (con `docker run`, montando el directorio temporal), no con otro mecanismo. Por eso las pruebas del backend requieren Docker. La versión de dbmate aparece en `dbmate/Dockerfile`, en las pruebas y en el `README.md`, y subirla implica tocar las tres (`grep -rn "amacneil/dbmate"`). Las reglas de negocio de los changes siguientes se prueban sobre esta misma base de pruebas.

## Risks / Trade-offs

**Una variante firmada sigue accesible mientras alguien tenga su URL** → El diseño de 0.1.0 ya lo acepta: las URLs no expiran para que la caché funcione. Este change no lo empeora, porque solo deja la ruta lista.

**SQLite con un único escritor** → Con `busy_timeout` y WAL, las escrituras concurrentes esperan en vez de fallar, que alcanza para el volumen esperado de un dueño y sus invitados. Si deja de alcanzar, la capa de acceso está aislada en un solo módulo.

**En modo nativo es fácil olvidar migrar antes de arrancar el backend** → El backend arranca igual y falla recién al consultar una tabla que no existe. Se mitiga documentando el comando en el `README.md` junto al de arranque. No se agrega una comprobación de versión en el backend porque en este change no hay tablas que puedan faltar.

**dbmate escribe en una base montada desde Windows en modo nativo** → El `docker run` del modo nativo abre `lumia.db` a través del montaje de Docker Desktop. Como WAL lo activa el backend y no la migración, dbmate usa el journal por defecto, que no depende de memoria compartida entre host y contenedor. Se verifica en el recorrido del modo nativo.

**Las pruebas del backend requieren Docker** → Mismo costo que aniseek, aceptado para que el esquema de pruebas salga del mismo artefacto que el de producción.

**Errores CRLF dentro de imágenes construidas desde Windows** → No hay scripts de shell en este change, porque el frontend no tiene entrypoint (D9). Los archivos de configuración de nginx toleran CRLF. Igual se verifica construir desde el clon de Windows.

**La caché de nginx crece sin control** → `proxy_cache_path` lleva `max_size` e `inactive`. Los valores exactos se fijan al implementar.

**Fijar versiones retrasa los parches de seguridad** → Se acepta: el bump queda en el diff y es deliberado.

## Migration Plan

No hay datos ni despliegue previos. El cambio es aditivo, salvo que el backend pasa de no tener base a requerir `DATA_DIR`. El rollback es revertir el commit y borrar el volumen `lumia-data` con `docker compose down -v`.

## Open Questions

Ninguna. Las decisiones de este change son de infraestructura, y las que dependían del usuario ya están en el diseño de 0.1.0. La única pendiente del usuario, la revocación del enlace para participantes existentes, no toca nada de lo que este change construye.

### Resueltas durante la redacción

- **Si `transformer` entra ya o espera al change de subida.** La cerró la decisión del usuario de fijar los cuatro servicios para 0.1.0, más el pedido de que el primer change los levante. Al verificarlo con una URL firmada a mano, el servicio tiene consumidor desde el primer día (D3).
- **Si nginx debe reescribir `/images`.** La cerró la documentación de imgproxy: `IMGPROXY_PATH_PREFIX` hace que imgproxy acepte el prefijo, y la firma se calcula sin él. Así `/images` sigue la misma regla de no reescritura que `/api` (D2, D3).
- **Uno o dos archivos de compose.** La cerró el alcance de 0.1.0: no hay despliegue ni release, que eran la razón del archivo base de Pixpick (D4).
- **Si el frontend necesita configuración en runtime.** La cerró la topología: un solo origen y rutas relativas, sin valores de entorno en la interfaz (D9).
- **Qué hacer con `psycopg` del template.** La cerró la decisión del usuario de usar SQLite: se quita para no dejar una dependencia sin uso (proposal).
- **Migrar desde el backend o desde un servicio aparte.** La cerró una respuesta del usuario al revisar el change: servicio aparte, para que pasar a Postgres más adelante no obligue a reorganizar las migraciones. Reemplaza la decisión del diseño de 0.1.0 de migrar al arrancar el backend (D6).
- **Alembic o dbmate.** La cerró una respuesta del usuario: `migrate` debe ser una imagen ligera con las migraciones adentro, como la de aniseek. Eso es dbmate con SQL plano; con Alembic la imagen necesitaría Python y SQLAlchemy (D6).
- **Dónde se activa WAL.** La cerró una restricción de SQLite: `journal_mode=WAL` no se puede cambiar dentro de una transacción, y dbmate envuelve cada migración en una. Lo activa el backend al conectar (D5).
- **Si la migración inicial crea tablas.** La cerró el reparto de changes: las tablas de dominio pertenecen al change que las usa, y una migración vacía basta para verificar el mecanismo (D6).
- **Cómo se llama el paquete del backend.** La cerró la restricción del diseño de 0.1.0 de no llamarlo `lumia`. El scaffold ya lo llama `src` (D10).
