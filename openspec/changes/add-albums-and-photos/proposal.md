## Why

El dueño ya puede iniciar sesión, pero al entrar no hay nada que hacer: la pantalla de inicio es un esqueleto y las tablas `albums` y `photos` del esquema no tienen API. Todo lo demás de 0.1.0 (compartir, votar, resultados) cuelga de tener álbumes con fotos, así que este es el primer cambio que entrega comportamiento de producto.

## What Changes

- Endpoints del dueño para crear, listar y borrar álbumes, siempre filtrados por el dueño con sesión. Un álbum de otro dueño se responde exactamente igual que uno inexistente.
- Endpoints del dueño para subir fotos a un álbum (multipart, directo al backend), listarlas en orden de subida y borrarlas. Borrar una foto o un álbum también elimina los archivos originales del disco.
- Validación de la subida: JPEG, PNG o WebP según el contenido (no según el tipo declarado), máximo 20 MiB por foto y 50 fotos por álbum.
- Cada foto de una respuesta lleva URLs firmadas de variantes (miniatura, mazo, visor) que construye el backend para imgproxy; el backend nunca procesa imágenes.
- El backend recibe la clave y la sal de firma de imágenes (`IMAGE_SIGNING_KEY`, `IMAGE_SIGNING_SALT`) y `compose.yaml` se las pasa.
- Frontend: la pantalla de inicio del dueño lista, crea y borra álbumes; la pantalla de un álbum muestra sus fotos como miniaturas, sube varios archivos a la vez y borra fotos.
- Sin cambios de esquema: `albums` y `photos` ya existen en la migración `0002`.

## Capabilities

### New Capabilities

- `album-management`: crear, listar y borrar álbumes del dueño, acotado por dueño.
- `photo-management`: subida de fotos con sus límites y validación, listado en orden de subida, borrado y limpieza de los archivos del disco.

### Modified Capabilities

- `image-delivery`: añade quién genera las URLs firmadas y qué variantes existen, algo que su Purpose dejó explícitamente para el cambio de subida de fotos.

## Impact

- Backend: nuevos `packages/albums` y `packages/photos` (router, service, repository, schemas), un módulo `images` con `variant_url`, ajustes nuevos para la clave y la sal de firma, y los límites de tamaño y cantidad de la subida.
- `compose.yaml`, `.env.example` y `README.md`: las dos variables de firma ahora llegan al backend.
- Frontend: lista de álbumes, detalle del álbum con subida, componentes shadcn nuevos según haga falta, llamadas nuevas en `lib/api.ts`.
- Dependencias: un parser multipart para FastAPI (`python-multipart`). El tipo real de la imagen se detecta con una comprobación manual de firmas, sin librería nueva (ver el diseño).
- Fuera de este cambio: el enlace de compartir, el flujo del invitado, la votación y los resultados.
