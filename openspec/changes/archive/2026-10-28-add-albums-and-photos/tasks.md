## 1. Configuración y base

- [x] 1.1 Pasar `IMAGE_SIGNING_KEY` e `IMAGE_SIGNING_SALT` al servicio `backend` en `compose.yaml` y añadir `IMAGE_WARMUP_BASE_URL` (por defecto `http://nginx`). Verificar que `docker compose config` muestra las tres variables en `backend`.
- [x] 1.2 Añadir `client_max_body_size 21m` a `location /api/` en la configuración de nginx. Verificar con `docker compose up -d --build nginx` que un POST de 5 MiB a una ruta de `/api/` ya no recibe 413 de nginx.
- [x] 1.3 Añadir `python-multipart` a las dependencias del backend con `uv add python-multipart`. Verificar que `uv sync` termina bien y que `uv.lock` se actualizó.
- [x] 1.4 Crear `packages/photos/config.py` con `PhotoSettings` (clave, sal y URL base del calentamiento) y los límites (20 MiB, 50 fotos, tamaños de variante). Verificar que el backend se niega a arrancar sin `IMAGE_SIGNING_KEY` y arranca con ella definida.

## 2. Imágenes y almacenamiento

- [x] 2.1 Implementar `src/images.py` con `variant_url(storage_key, variant)`, que firma rutas de imgproxy (HMAC-SHA256, base64url, sin expiración). Verificar que la URL de un original subido devuelve una imagen a través de nginx (`curl -I` muestra `200` y `image/webp`) y que una firma alterada se rechaza.
- [x] 2.2 Implementar `packages/photos/storage.py`: detección de tipo por firma para JPEG, PNG y WebP, escritura por trozos a `<uuid>.part` con el tope de 20 MiB, renombrado a la clave final y borrado seguro de un original. Verificar en una consola de Python que se detecta cada firma, que un archivo de texto se rechaza, que un flujo de 20 MiB + 1 byte no deja archivo y que un nombre hostil del cliente nunca llega a la ruta.

## 3. Backend de álbumes

- [x] 3.1 Añadir el repositorio de `albums` (insertar, listar con cantidad de fotos y clave de la primera, obtener por `(id, owner_id)`, borrar devolviendo las claves de sus fotos), siempre filtrado por `owner_id`. Verificar con dos dueños que cada consulta devuelve solo las filas de su dueño.
- [x] 3.2 Añadir el servicio, los esquemas y las respuestas de álbumes (título recortado, de 1 a 100 caracteres) y el router con `POST/GET /api/albums` y `GET/DELETE /api/albums/{album_id}` detrás de `current_user`, borrando los originales con una tarea de fondo tras el commit. Verificar con `curl` y una cookie de sesión: crear, listar, obtener, borrar, 422 con un título inválido, 401 sin cookie y el mismo cuerpo 404 para un álbum inexistente y uno ajeno.
- [x] 3.3 Montar el router de álbumes en `routes.py`. Verificar que los endpoints aparecen en `/docs` bajo `/api`.

## 4. Backend de fotos

- [x] 4.1 Añadir el repositorio de `photos`: inserción atómica limitada a 50 por álbum, listado en orden de subida y borrado acotado por foto, álbum y dueño que devuelve la clave de almacenamiento. Verificar que dos inserciones simultáneas con 49 fotos dejan el álbum en exactamente 50.
- [x] 4.2 Añadir el servicio y los esquemas de fotos: errores de validación como 422 sobre `file`, `album_full` como 409 con `details.limit` y limpieza del original guardado si falla la inserción. Verificar que subir un PNG, un HEIC o un texto renombrado, un archivo demasiado grande y una foto 51 dan cada uno el estado esperado y dejan `/data/photos` coherente con la tabla.
- [x] 4.3 Añadir el router de fotos (`GET/POST /api/albums/{album_id}/photos`, `DELETE .../photos/{photo_id}`) con 201 al subir, calentamiento de miniatura en segundo plano que traga los fallos y borrado de archivos en segundo plano. Verificar que la respuesta nunca incluye `storageKey`, que trae las URLs `thumb`, `deck` y `viewer`, y que borrar una foto ajena o de otro álbum devuelve la respuesta de inexistente sin borrar nada.
- [x] 4.4 Ejecutar `uv run ruff check --fix` y `uv run ruff format` en `backend/`. Verificar que ambos terminan sin observaciones.

## 5. Frontend

- [x] 5.1 Añadir a `frontend/src/lib/api.ts` las llamadas y tipos de álbumes y fotos (listar, crear, borrar, obtener, listar fotos, subir con progreso, borrar foto). Verificar que `pnpm check` pasa y que la subida envía `multipart/form-data` con el campo `file`.
- [x] 5.2 Añadir con el MCP de shadcn los componentes necesarios (diálogo o diálogo de alerta, skeleton y otros). Verificar que quedan en `frontend/src/components/ui`.
- [x] 5.3 Reemplazar el esqueleto de inicio en `routes/_owner/index.tsx` por la lista de álbumes: miniatura de portada, cantidad de fotos, diálogo de creación, borrado con confirmación, estados de carga y de vacío, en español. Verificar en el navegador que un álbum creado aparece, uno borrado desaparece y que se ve bien en ancho de teléfono.
- [x] 5.4 Añadir `routes/_owner/albums/$albumId.tsx` con la cuadrícula de fotos, el borrado de fotos con confirmación, un enlace de regreso y un botón que abre el componente de subida: un `Dialog` con zona de arrastrar y soltar en escritorio y un `Drawer` inferior en móvil, con lista de miniaturas, progreso y estado por archivo, prefiltro de tipo, tamaño y capacidad restante, y un botón "Subir N fotos" (sin que la galería se mueva mientras se sube). Verificar en el navegador que arrastrar un archivo válido y un `.txt` muestra la miniatura y el rechazo, que la subida pasa por "Lista para subir", progreso, "Completada" y "Listo", que la galería y el contador reflejan la foto y que borrarla la quita y deja el disco coherente.
- [x] 5.5 Ejecutar `pnpm check` en `frontend/`. Verificar que termina sin observaciones y que `routeTree.gen.ts` incluye la ruta nueva.

## 6. Documentación y verificación integral

- [x] 6.1 Actualizar `README.md` y `.env.example`: el backend ahora necesita las variables de firma y `IMAGE_WARMUP_BASE_URL`, además de los límites de subida y los formatos admitidos. Verificar que la tabla de variables lista cada variable nueva una sola vez.
- [x] 6.2 Con `docker compose up --build` y un volumen limpio, iniciar sesión, crear un álbum, subir varias fotos, verlas como miniaturas servidas por imgproxy a través de nginx (la segunda carga muestra `X-Cache-Status: HIT`), borrar una foto y luego el álbum. Verificar que `/data/photos` queda vacío.
