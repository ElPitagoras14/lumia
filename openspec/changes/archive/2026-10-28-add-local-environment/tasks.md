## 1. Configuración del repositorio

- [x] 1.1 Crear `VERSION` en la raíz con `0.1.0`; verificar que el archivo contiene una sola línea con la versión.
- [x] 1.2 Escribir `.env.example` con únicamente `HTTP_PORT`, `DATA_DIR`, `IMAGE_SIGNING_KEY` e `IMAGE_SIGNING_SALT`. Documentar los dos perfiles (contenedores con `DATA_DIR=/data` y nativo con `DATA_DIR=./data`) y cómo generar las claves en hexadecimal. Verificar que cada variable tiene un consumidor en el compose o en el código y que ambos perfiles declaran los mismos nombres.
- [x] 1.3 Agregar `backend/data/` (o el directorio que use el perfil nativo) a `.gitignore`; verificar con `git check-ignore` que la base local queda ignorada.

## 2. Backend: configuración y base

- [x] 2.1 Ajustar dependencias con `uv`: agregar `pytest` al grupo dev y quitar `psycopg`; verificar que `uv sync` termina y que `uv.lock` ya no contiene `psycopg`.
- [x] 2.2 Crear `backend/src/config.py` con Pydantic Settings y `DATA_DIR` obligatoria (D5); verificar que arrancar sin `DATA_DIR` falla con un error que la nombra.
- [x] 2.3 Crear `backend/src/database.py` con el `Engine` síncrono sobre `<DATA_DIR>/lumia.db`, el listener que aplica `foreign_keys=ON` y `busy_timeout` por conexión, y la dependencia de sesión (D5); verificar con la prueba de 4.2.
- [x] 2.4 Hacer que el listener de conexión de 2.3 active también `journal_mode=WAL` (D5); verificar con la prueba de 4.2.
- [x] 2.5 Verificar que `backend/src/` no ejecuta migraciones ni crea tablas al arrancar (D6): arrancar el backend contra una base vacía y confirmar que no aparece `schema_migrations`.

## 2b. Migraciones (dbmate)

- [x] 2b.1 Crear `dbmate/migrations/0001_initial.sql` con las secciones `-- migrate:up` y `-- migrate:down` vacías y un comentario que explique que fija el punto de partida (D6); verificar que el archivo tiene ambas marcas.
- [x] 2b.2 Escribir `dbmate/Dockerfile` sobre `ghcr.io/amacneil/dbmate` en versión exacta, copiando `migrations/` a `/db/migrations` sin `ENTRYPOINT` ni `CMD` propios (D6). Verificar que la imagen construye y que `docker run --rm -v <tmp>:/data -e DATABASE_URL=sqlite:/data/lumia.db <imagen> --no-dump-schema up` crea la base con `0001` registrada en `schema_migrations`, sin montar el repositorio.
- [x] 2b.3 Verificar que una segunda ejecución sobre la misma base no aplica nada y termina con código 0.
- [x] 2.6 Montar el router bajo `/api` sin reescritura y crear `backend/src/health.py` con `GET /api/health`: 200 si `SELECT 1` funciona y 503 si no (D2, D7); verificar que `/openapi.json` lista `/api/health` con el prefijo incluido.
- [x] 2.7 Verificar que `uv run ruff check` y `uv run ruff format --check` pasan.

## 3. Backend: imagen

- [x] 3.1 Escribir `backend/Dockerfile` con `python` y `uv` en versión exacta, capa de dependencias separada del código, copia de `src`, y uvicorn con un único proceso (D5, D10); verificar que la imagen construye.
- [x] 3.2 Escribir `backend/.dockerignore` excluyendo `.venv`, cachés, `data/` y `tests/`; verificar que el contexto de build no incluye la base local.

## 4. Backend: pruebas

- [x] 4.1 Configurar pytest para que apunte `DATA_DIR` a un directorio temporal, construya el esquema corriendo la imagen pública de dbmate con `docker run` sobre `dbmate/migrations/` (montado en `/db` en solo lectura) y ese directorio, y falle mostrando los logs de dbmate si la migración falla. Después levanta la app (D6, D11). Verificar que `uv run pytest` descubre y ejecuta las pruebas.
- [x] 4.2 Escribir pruebas para: migrar desde una base inexistente hasta `head`, que un segundo arranque no aplica migraciones, rechazo de una clave foránea violada (sobre una tabla creada solo en la prueba), `journal_mode` igual a `wal`, y healthcheck 200 con base disponible y 503 con base inaccesible. Verificar que `uv run pytest` pasa.

## 5. Frontend

- [x] 5.1 Reemplazar `frontend/src/routes/index.tsx` por una pantalla mínima de Lumia en español y declarar `lang="es"` y el título `Lumia` en `frontend/index.html`; verificar en un viewport de 360 px que no hay desplazamiento horizontal.
- [x] 5.2 Configurar en `frontend/vite.config.ts` el proxy de `/api` a `http://localhost:8000` para el servidor de desarrollo (D8); verificar que con el backend nativo `/api/health` responde a través de `pnpm dev`.
- [x] 5.3 Escribir `frontend/nginx.conf`: estáticos con `try_files` hacia `index.html`, caché larga e inmutable para `/assets/` y revalidación para `index.html` (D1); verificar que una ruta profunda devuelve el documento con 200 y que las cabeceras de caché difieren entre ambos tipos de recurso.
- [x] 5.4 Escribir `frontend/Dockerfile` multi-etapa (`node` con pnpm para construir y `nginx` para servir, ambas en versión exacta) y `frontend/.dockerignore` sin `node_modules` ni `dist`; verificar que la imagen construye.
- [x] 5.5 Verificar que `pnpm check` y `pnpm build` pasan.

## 6. Puerta de entrada (nginx)

- [x] 6.1 Escribir `nginx/nginx.conf` con el resolver de Docker y los upstreams por variable, `/api/` hacia `backend:8000` sin reescritura ni fallback, y `/` hacia `frontend` (D2); verificar en el log del backend que la ruta llega con `/api` incluido.
- [x] 6.2 Agregar la location `/images/` hacia `transformer:8080` sin reescritura, con `proxy_cache_path` (`max_size`, `inactive`) y `proxy_cache_valid` solo para 200 (D3). Agregar una cabecera de diagnóstico con `$upstream_cache_status`. Verificar con la prueba integral 8.4.
- [x] 6.3 Escribir `nginx/Dockerfile` que hornea la configuración sobre `nginx` en versión exacta; verificar que la imagen construye y que `nginx -t` pasa dentro del contenedor.

## 7. Orquestación

- [x] 7.1 Escribir `compose.yaml` con `nginx`, `frontend`, `backend` y `transformer` sobre una red compartida y el volumen `lumia-data`, montado en `/data` como lectura y escritura en `backend` y `:ro` en `transformer` (D4). Publicar solo `${HTTP_PORT}:80` en `nginx`. Verificar con `docker compose config` que no hay otra sección `ports`.
- [x] 7.2 Configurar `transformer` con la imagen de imgproxy en versión exacta, `IMGPROXY_KEY` e `IMGPROXY_SALT` desde `IMAGE_SIGNING_KEY` e `IMAGE_SIGNING_SALT`, `IMGPROXY_LOCAL_FILESYSTEM_ROOT=/data` e `IMGPROXY_PATH_PREFIX=/images` (D3). Verificar que el contenedor arranca y responde a su healthcheck interno.
- [x] 7.3 Agregar el servicio `migrate` con `build: ./dbmate`, `command: ["--no-dump-schema", "up"]`, `DATABASE_URL=sqlite:/data/lumia.db`, el volumen con lectura y escritura, nada montado sobre `/db` y `restart: "no"`. Hacer que `backend` dependa de él con `condition: service_completed_successfully` (D6). Verificar que `docker compose up` muestra a `migrate` terminando con código 0 antes de que arranque `backend`, y que `docker compose run --rm migrate` migra sin levantar la API.
- [x] 7.4 Verificar que con una migración rota a propósito `migrate` termina con error y `backend` no arranca; después descartar la migración rota.
- [x] 7.5 Agregar el `healthcheck` de `backend` contra `/api/health`; verificar que `docker compose ps` lo muestra `healthy` tras el arranque.

## 8. Verificación integral

- [x] 8.1 Desde un clon limpio en Windows, copiar `.env.example` a `.env`, completar las claves y ejecutar `docker compose up --build`. Verificar que la aplicación carga en `http://localhost:${HTTP_PORT}` sin pasos adicionales.
- [x] 8.2 Verificar que backend, frontend y transformer no responden desde el host por puertos propios, que detener `backend` hace que `/api/health` responda 502 y no HTML, y que cambiar `HTTP_PORT` mueve la aplicación al puerto nuevo.
- [x] 8.3 Verificar la persistencia: crear un archivo en el volumen desde `backend`, ejecutar `docker compose down` y `up`, y confirmar que sigue ahí junto con `lumia.db`. Verificar también que escribir en `/data` desde `transformer` falla.
- [x] 8.4 Copiar una imagen de prueba a `/data/photos/<uuid>` dentro del contenedor del backend y firmar a mano una URL de variante con un script de un solo uso. Verificar que la URL firmada devuelve la imagen y que la segunda petición sale de la caché (`HIT`). Verificar también que una URL sin firma o alterada se rechaza, que una fuente fuera de `/data` se rechaza y que un original inexistente devuelve error sin quedar cacheado. Después borrar la imagen de prueba.
- [x] 8.5 Recorrer el modo nativo: migrar con el `docker run` de dbmate documentado en el `README.md`, backend con `uv run` y `DATA_DIR=./data`, interfaz con `pnpm dev`. Verificar que la interfaz carga, que el healthcheck responde por el proxy de Vite y que el código no tiene condiciones que distingan el modo.

## 9. Documentación

- [x] 9.1 Actualizar `README.md`: qué es Lumia, los cuatro servicios y `migrate`, el arranque con compose, cómo crear una migración nueva, las variables de `.env.example` y el modo nativo (con el paso de migración antes de arrancar el backend). Verificar siguiendo las instrucciones tal como están escritas desde un clon limpio.
