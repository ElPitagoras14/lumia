## Context

La motivación está en `proposal.md`, y los requisitos en `specs/guest-voting/spec.md` y `specs/guest-access/spec.md`. Lo que ya existe y condiciona el enfoque:

- **Base de datos.** La migración `0002` ya define `ratings`:
  - Clave primaria `(photo_id, participant_id)`.
  - Columna `album_id` con claves foráneas compuestas hacia `photos (id, album_id)` y `participants (id, album_id)`, ambas `ON DELETE CASCADE`.
  - `approved` restringida a 0 o 1, más `created_at` y `updated_at`.
  - Las fotos se ordenan por `id`.
  - No hace falta migración.
- **Backend.** `packages/sharing` ya tiene un `guest_router` bajo `/api/share/{token}`:
  - `service.resolve_link` da 404 con un token desconocido o revocado.
  - `service.identify_participant` lee la cookie `lumia_guest_<album_id>` y busca al participante por `(album_id, token_hash)`.
  - `images.variant_url(storage_key, variant)` firma las tres variantes (`thumb`, `deck`, `viewer`).
- **Errores.** `UnauthenticatedError` se traduce en 401, `NotFoundError` en 404 y los errores de validación del cuerpo en 422 con el campo.
- **Frontend.**
  - `routes/a/$token.tsx` resuelve el enlace con la query `["shared", token]`, pide el nombre y hoy termina en una pantalla provisional.
  - `lib/api.ts` ya desenvuelve el envelope y lanza `ApiError` con un `code` estable.
  - Ya están instalados `progress`, `drawer`, `dialog`, `badge`, `skeleton` y `zod`. `login.tsx` ya usa `validateSearch` con zod.
- **Maqueta.** `local/lumia-mobile.html`, sección "Invitado", dibuja la pantalla de nombre, el mazo, "Mis votos", el visor y la pantalla final.

## Goals / Non-Goals

**Goals:**
- Que el servidor sea la única fuente del avance. El frontend lo deriva de la lista de fotos con su voto y no guarda nada en `localStorage`.
- Que un voto quede guardado o falle con un aviso, sin estados intermedios silenciosos.
- Que el mazo se sienta inmediato en un teléfono: swipe fluido, siguiente carta ya cargada y voto optimista.

**Non-Goals:**
- **Deshacer un voto para volver a pendiente.** `data-model` lo permitiría borrando la fila, pero el diseño de 0.1.0 solo habla de cambiar votos.
- **Resultados del dueño y borrado de participantes.** Van en `add-owner-results`.
- **Modo oscuro y nuevo texto del enlace inválido.** Son cambios puramente visuales, independientes de votar.
- **Pruebas automatizadas.** Por decisión del proyecto no se agregan. Se verifica con `curl`, el navegador, `uv run ruff check`, `uv run ruff format --check` y `pnpm check`.

## Decisions

### D1 - Las rutas del invitado cuelgan del token y se identifican con una dependencia

Se agregan dos rutas al `guest_router`:

- `GET /api/share/{token}/photos`
- `PUT /api/share/{token}/photos/{photo_id}/rating`

Ambas dependen de una nueva dependencia `current_participant(token, request, connection)`, que trabaja en este orden:

1. Resuelve el token con `resolve_link`. Si no es vigente, da 404.
2. Lee la cookie del álbum resultante con `identify_participant`. Si no hay participante, lanza `UnauthenticatedError` (401).
3. Devuelve el álbum y el participante.

El orden importa. Con un token desconocido o revocado la respuesta es 404, haya o no cookie, igual que `GET /share/{token}`. Así un token revocado no se distingue de uno inexistente.

La dependencia es el equivalente de `current_user` para el invitado. Las rutas nunca leen la cookie por su cuenta.

Alternativas descartadas:
- **Rutas por identificador de álbum** (`/api/albums/{id}/ratings`). Exponen el identificador interno del álbum, que `guest-access` prohíbe revelar.
- **Responder 403 sin cookie.** `api-conventions` reserva el 403 para quien tiene identidad válida pero no permiso. Un invitado sin cookie no tiene identidad.

### D2 - Una sola lista de fotos con el voto propio, sin paginación

`GET /photos` hace una única consulta:

```sql
SELECT p.id, p.storage_key, r.approved
FROM photos p
LEFT JOIN ratings r
  ON r.photo_id = p.id AND r.participant_id = :participant_id
WHERE p.album_id = :album_id
ORDER BY p.id
```

Cada elemento de la respuesta tiene esta forma:

```json
{ "id": 1, "urls": { "thumb": "...", "deck": "...", "viewer": "..." }, "approved": true }
```

`approved` es `true`, `false` o `null` (pendiente). El `LEFT JOIN` filtra por el participante, así que los votos de otros participantes nunca salen de la base.

La respuesta reusa `PhotoUrls` de `packages/photos`, pero no reusa `PhotoResponse`. Ese modelo incluye `size_bytes` y `created_at`, que el invitado no necesita.

El identificador de la foto sí se expone, porque hace falta para votar. Revela el orden global de subida entre álbumes, pero no da acceso a nada: cualquier voto se filtra por el álbum del token.

Con el tope de 50 fotos por álbum, la respuesta completa pesa pocos kilobytes, así que no hay paginación. Avance, mazo, filtros y pantalla final se derivan de esta misma lista.

Alternativas descartadas:
- **Un endpoint de "siguiente foto pendiente".** Duplica la lógica y obliga a una petición por carta.
- **Calcular el avance en el servidor.** Es redundante con la lista.

### D3 - Votar es un único upsert que también comprueba el álbum

```sql
INSERT INTO ratings (photo_id, participant_id, album_id, approved)
SELECT p.id, :participant_id, p.album_id, :approved
FROM photos p
WHERE p.id = :photo_id AND p.album_id = :album_id
ON CONFLICT (photo_id, participant_id)
DO UPDATE SET approved = excluded.approved, updated_at = CURRENT_TIMESTAMP
RETURNING approved
```

- Si la foto no existe o es de otro álbum, el `SELECT` no produce filas, no se escribe nada y `RETURNING` viene vacío. Eso se traduce en `NotFoundError` (404).
- Es una sola sentencia, así que no hay una carrera entre comprobar y escribir.
- Dos votos simultáneos del mismo participante dejan una sola fila con el último valor.
- La cláusula `WHERE` del `SELECT` también resuelve la ambigüedad de sintaxis que SQLite documenta para `INSERT ... SELECT ... ON CONFLICT`.

Después del upsert, la respuesta devuelve la foto con su voto, con la misma forma que un elemento de D2. Para eso hace falta su `storage_key`: se agrega a `RETURNING` mediante un `SELECT` posterior por `id`, o se lee en la misma transacción.

`PUT` es el método correcto porque el resultado no depende de cuántas veces se repita. El cuerpo es un `ApiModel` con `approved: StrictBool`. Sin `Strict`, Pydantic acepta `"true"`, `1` o `"yes"`, y el spec exige 422 para cualquier valor que no sea booleano. Un cuerpo de formulario no valida contra el modelo JSON, igual que al entrar con un nombre, y eso cubre CSRF en este alcance.

Alternativas descartadas:
- **Comprobar la foto con un `SELECT` aparte y después insertar.** Son dos sentencias y abren una ventana de carrera.
- **Dejar que la clave foránea compuesta rechace la foto ajena.** Produce un `QueryExecutionError` (500) en lugar de 404.

### D4 - Voto optimista en el frontend, con reversión y aviso

Todas las vistas leen la misma query `["shared", token, "photos"]`. Al votar, el flujo es:

- **`onMutate`**:
  1. Cancela las consultas en curso de esa query.
  2. Guarda la lista anterior.
  3. Escribe el voto nuevo en la caché. El mazo avanza en el acto.
- **`onError`**:
  1. Devuelve solo esa foto a su voto previo, o a pendiente. No restaura la lista entera, porque eso también desharía votos de otras fotos que siguen en vuelo.
  2. Muestra un aviso en español en una región `role="alert"`.
  3. Si el error es 404 (la foto se borró), vuelve a pedir la lista.
- **`onSettled`**: no vuelve a pedir la lista. La respuesta del `PUT` ya trae la foto, que reemplaza a la de la caché.

Así se cumple que un voto fallido no se da por guardado, sin hacer esperar al invitado en cada carta.

Alternativa descartada: esperar la respuesta antes de avanzar. Es más simple, pero en una red móvil se siente lento justo en la interacción central.

### D5 - Swipe con Pointer Events y transformaciones CSS, sin dependencias nuevas

La carta escucha `pointerdown`, `pointermove`, `pointerup` y `pointercancel`, y usa `setPointerCapture`. Mientras se arrastra, aplica `transform: translateX(dx) rotate(dx * k)`. Se suelta según estos criterios:

| Condición al soltar | Resultado |
| --- | --- |
| `\|dx\|` supera el 30 % del ancho de la carta | Vota |
| La velocidad horizontal supera un umbral (gesto rápido) | Vota |
| Ninguna de las dos | La carta vuelve con una transición |

Al votar, la carta sale de pantalla con una transición y en el mismo momento se dispara la mutación.

- La carta usa `touch-action: pan-y`, para que un desplazamiento vertical siga moviendo la página.
- Un `pointerup` sin movimiento apreciable cuenta como toque y abre el visor.
- Durante el arrastre, la etiqueta "ME GUSTA" o "NO ME GUSTA" aparece con una opacidad proporcional a `dx`.
- Con el mazo visible, las flechas izquierda y derecha se escuchan en `window` y llaman a la misma función que los botones. Se ignoran cuando el foco está en un campo.
- Con `prefers-reduced-motion` se omiten las transiciones de salida y de rotación.

Alternativas descartadas:
- **Una librería de gestos o animación** (`motion`, `@use-gesture/react`). Agrega dependencias para un solo gesto.
- **Eventos `touch*`.** No cubren el mouse ni el lápiz.

### D6 - Precarga de las siguientes cartas

Cada vez que cambia la carta actual, se crea un `new Image()` con la variante `deck` de las dos siguientes fotos pendientes. En el visor se precarga la variante `viewer` de la foto anterior y de la siguiente.

Las URLs son estables y nginx las cachea, así que la precarga calienta tanto la caché del navegador como la de nginx. No hace falta ninguna coordinación con el servidor.

### D7 - Las vistas del invitado se eligen con parámetros de búsqueda

`/a/$token` declara `validateSearch` con zod:

| Parámetro | Valores |
| --- | --- |
| `view` | `"deck"` (por defecto) o `"votes"` |
| `filter` | `all`, `liked`, `disliked` o `pending` (solo en `"votes"`) |
| `photo` | Identificador de la foto abierta en el visor (opcional) |

Así funcionan el botón "atrás" del teléfono (cierra el visor o vuelve al mazo), la recarga de la página y el enlace a una vista concreta. Todo sigue siendo una sola ruta pública fuera de `_owner`.

Qué se muestra en cada caso:

- **`view="deck"`**:
  - Sin fotos pendientes en un álbum con fotos: la pantalla final.
  - Álbum sin fotos: el aviso de álbum vacío.
  - En otro caso: el mazo, cuya carta actual es la primera pendiente en orden de subida.
- **`photo` definido**: el visor, como superposición. Recorre la lista filtrada de la vista desde la que se abrió. Desde el mazo, esa lista son todas las fotos.

Alternativas descartadas:
- **Rutas hijas** (`/a/$token/votos`). Agregan archivos de ruta para lo que son estados de una misma pantalla.
- **Estado local de React.** Rompe el botón "atrás" y la recarga.

### D8 - Componentes del invitado en una carpeta propia

Se crean en `frontend/src/components/guest/`:

- `vote-deck.tsx`
- `photo-viewer.tsx`
- `my-votes.tsx`
- `done-screen.tsx`

La ruta `$token.tsx` queda a cargo de resolver el enlace, pedir el nombre y elegir la vista.

La lógica derivada (primera pendiente, contadores, avance) vive en un hook `useGuestPhotos(token)` en el mismo directorio, para que el mazo, la galería y la pantalla final no repitan los cálculos.

Los botones de voto usan `Button` de shadcn y la barra de avance usa `Progress`. No se agregan componentes de shadcn nuevos.

## Risks / Trade-offs

- **[El dueño borra una foto mientras el invitado la tiene en pantalla]** → El `PUT` responde 404. El frontend revierte, avisa y vuelve a pedir la lista, así que la carta desaparece. El avance se recalcula sin esa foto.
- **[El dueño sube fotos mientras el invitado vota]** → No hay tiempo real. Las fotos nuevas aparecen al volver a pedir la lista: al recargar, al volver a enfocar la pestaña (comportamiento por defecto de TanStack Query) o tras un 404.
- **[Dos pestañas del mismo invitado votan la misma foto]** → Gana el último voto (D3). Las cachés de las pestañas pueden diferir hasta que se vuelve a pedir la lista. Es aceptable: no hay historial y el resultado final es coherente.
- **[Las URLs de variantes no expiran]** → Quien ya recibió la lista puede seguir viendo las fotos aunque el enlace se revoque. El diseño de 0.1.0 lo acepta explícitamente para que funcione la caché de nginx.
- **[Swipe accidental al intentar desplazar la página]** → `touch-action: pan-y` y el umbral del 30 % del ancho evitan votos por un roce. Además, el voto siempre se puede cambiar desde el visor.
- **[Votos optimistas fuera de orden ante una red lenta]** → Cada `PUT` es independiente y por foto, así que el orden de llegada no mezcla fotos. Si fallan varios seguidos, cada uno se revierte por separado.

## Migration Plan

No hay migración de datos ni de esquema. El despliegue es reconstruir las imágenes de `backend` y `frontend`. Para volver atrás basta desplegar la versión anterior: las filas de `ratings` creadas quedan en la base, la versión anterior las ignora y la siguiente las retoma.

## Open Questions

Ninguna.
