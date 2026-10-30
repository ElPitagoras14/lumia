## 1. Backend

- [x] 1.1 Añadir en `packages/sharing` la dependencia `current_participant`, que resuelve el token (404 si no es vigente) y después la cookie del álbum (`UnauthenticatedError` si no identifica a nadie), y devuelve el álbum y el participante (D1). Verificar con `curl` que un token inventado da 404 con y sin cookie, y que un token vigente sin cookie da 401, una vez montadas las rutas de 1.3.
- [x] 1.2 Añadir al repositorio la consulta de fotos con el voto del participante (`LEFT JOIN` filtrado por participante, `ORDER BY p.id`) y el upsert de votos con `INSERT ... SELECT ... WHERE p.album_id = :album_id ON CONFLICT ... DO UPDATE` (D2, D3), más sus registros en `schemas.py`. En `service.py`, `rate_photo` lanza `NotFoundError` cuando el upsert no devuelve fila. Verificar en una consola de Python contra la base:
  - Votar dos veces la misma foto deja una sola fila con el último valor.
  - Votar una foto de otro álbum no escribe nada.
- [x] 1.3 Añadir al `guest_router` las rutas `GET /api/share/{token}/photos` y `PUT /api/share/{token}/photos/{photo_id}/rating`, con el cuerpo `RateRequest { approved: StrictBool }` y la respuesta `GuestPhotoResponse { id, urls, approved }`, reusando `PhotoUrls` y `variant_url` (D2, D3). Verificar con `curl -b` sobre un álbum con fotos:
  - La lista sale en orden de subida, con `approved: null` y sin `storageKey`, `sizeBytes` ni `albumId`.
  - Votar `true` y luego `false` deja `false`.
  - `"true"`, `1` y un cuerpo vacío dan 422 con `field: "approved"`.
  - Una foto de otro álbum y una foto borrada dan 404.
  - Un cuerpo de formulario se rechaza.
  - Un token revocado da el mismo 404 que uno inventado, aunque traiga la cookie.
  - Otro participante ve la foto como pendiente.
- [x] 1.4 Ejecutar `uv run ruff check --fix` y `uv run ruff format` en `backend/`. Verificar que ambos terminan sin observaciones.

## 2. Frontend: datos y estructura

- [x] 2.1 Añadir a `frontend/src/lib/api.ts` el tipo `GuestPhoto` y las funciones `getGuestPhotos(token)` y `ratePhoto(token, photoId, approved)`. Verificar que `pnpm check` pasa.
- [x] 2.2 Crear `components/guest/use-guest-photos.ts` con la query `["shared", token, "photos"]`, los datos derivados (primera pendiente, contadores por estado, avance) y la mutación de voto optimista con reversión, aviso y nueva consulta tras un 404 (D4, D8). Verificar con las herramientas de desarrollo:
  - Con la red bloqueada, un voto se revierte y muestra el aviso.
  - Con red, el voto persiste al recargar.
- [x] 2.3 Declarar `validateSearch` con zod en `routes/a/$token.tsx` (`view`, `filter`, `photo`), quitar la pantalla provisional y elegir la vista según D7. Verificar en el navegador que el botón "atrás" vuelve del visor y de "Mis votos" al mazo, y que recargar conserva la vista.

## 3. Frontend: pantallas del invitado

- [x] 3.1 Actualizar la pantalla de nombre a los textos de la maqueta: "Te invitaron a votar", la cantidad de fotos, "¿Cómo te llamas?", "Empezar a votar" y "No necesitas crear una cuenta. Tu avance se guarda.". Verificar en una ventana privada que, al entrar, aparece el mazo en la primera foto.
- [x] 3.2 Crear `components/guest/vote-deck.tsx` según D5 y D6:
  - Cabecera con título, "Hola, <nombre>" y "Mis votos".
  - Avance "N de M" con `Progress`.
  - Carta con la variante `deck`, arrastre con Pointer Events, umbral del 30 % o gesto rápido y etiqueta de voto durante el arrastre.
  - Toque para abrir el visor.
  - Botones "No me gusta" y "Me gusta" con nombre accesible, y flechas del teclado.
  - Respeto de `prefers-reduced-motion`.
  - Precarga de las dos siguientes pendientes.
  - Aviso de álbum vacío.

  Verificar en ancho de teléfono con emulación táctil:
  - Deslizar a la derecha y a la izquierda vota y avanza.
  - Un arrastre corto devuelve la carta.
  - El desplazamiento vertical no vota.
  - Las flechas votan.
  - La pestaña de red muestra la siguiente imagen pedida antes de que aparezca.
- [x] 3.3 Crear `components/guest/photo-viewer.tsx`: superposición con la variante `viewer`, posición "N / M", anterior y siguiente dentro de la lista de origen, texto del voto actual, botones "No me gusta" y "Me gusta" con `aria-pressed`, cierre y precarga de las fotos vecinas. Verificar:
  - Cambiar un voto desde el visor actualiza el botón marcado.
  - Votar una pendiente la saca del mazo.
- [x] 3.4 Crear `components/guest/my-votes.tsx`:
  - Volver al mazo.
  - Filtros Todas, Me gusta, No me gusta y Pendientes, con su cantidad.
  - Cuadrícula de miniaturas `thumb` con un indicador de estado y `aria-label` del tipo "Foto 3: no me gusta".
  - Botón "Seguir votando · quedan N" solo si hay pendientes.

  Verificar:
  - Los filtros muestran las cantidades correctas.
  - Al cambiar un voto en el visor, los contadores se actualizan sin recargar.
- [x] 3.5 Crear `components/guest/done-screen.tsx`: "¡Listo, <nombre>!", "Calificaste las N fotos de <álbum>", totales de "me gustan" y "no me gustan", "Revisar mis votos" y el aviso de que puede volver con el mismo enlace. Verificar:
  - Al votar la última pendiente aparece esta pantalla.
  - Al recargar se mantiene.
  - Si el dueño sube una foto nueva, al volver a enfocar la pestaña reaparece el mazo con esa foto.
- [x] 3.6 Ejecutar `pnpm check` en `frontend/`. Verificar que termina sin observaciones.

## 4. Documentación y verificación integral

- [x] 4.1 Ampliar en `README.md` la sección del invitado. Debe explicar:
  - Cómo vota: swipe, botones y teclado.
  - Que el avance vive en el servidor y se retoma.
  - Que puede cambiar votos desde "Mis votos".
  - Las rutas `GET /api/share/{token}/photos` y `PUT /api/share/{token}/photos/{photo_id}/rating`.

  No hay variables de entorno nuevas. Verificar que la sección sigue el estilo de documentación del repo.
- [x] 4.2 Con `docker compose up --build`:
  1. El dueño sube 5 fotos y comparte el álbum.
  2. En una ventana privada, una invitada entra como "María", vota 2 fotos deslizando, cierra la ventana y vuelve: el mazo retoma en la foto 3 con "2 de 5".
  3. Termina el mazo y ve "¡Listo, María!".
  4. Cambia un voto desde "Mis votos".
  5. El dueño revoca el enlace: el viejo muestra el enlace no válido y el nuevo la lleva a la pantalla final con sus votos intactos.
  6. El dueño borra una foto votada y la fila de `ratings` correspondiente desaparece.
