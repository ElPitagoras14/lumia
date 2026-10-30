## Context

La motivación está en `proposal.md` y los requisitos en `specs/owner-results/spec.md`. Lo que ya existe y condiciona el enfoque:

- **Base de datos.** No hace falta migración:
  - `participants` cuelga del álbum, con `ON DELETE CASCADE`, y su `id` refleja el orden de entrada.
  - `ratings` tiene clave primaria `(photo_id, participant_id)`, columna `album_id`, y claves foráneas compuestas con cascada hacia `photos` y `participants`. Borrar un participante ya borra sus votos en la base.
  - Existe un índice `ratings_participant_id`.
- **Backend.**
  - `albums_service.get_album(connection, owner_id, album_id)` ya da 404 tanto para un álbum de otro dueño como para uno inexistente.
  - `current_user` da 401 sin sesión.
  - `images.variant_url(storage_key, "thumb")` firma las miniaturas.
  - `src.database.client` ofrece `fetch_all`, `fetch_one` y `fetch_val_or_none`.
  - Cada paquete sigue la forma `router`, `service`, `repository`, `schemas` y `responses`.
- **Invitado.** `sharing.service.identify_participant` busca al participante por `(album_id, token_hash)`. Si la fila ya no existe, devuelve `None`, y `$token.tsx` muestra la pantalla de nombre. El efecto pedido en el invitado tras un borrado ocurre sin tocar `sharing`.
- **Frontend.**
  - `routes/_owner/albums/$albumId.tsx` muestra cabecera, acciones y la cuadrícula de fotos, y aún no declara `validateSearch`.
  - Ya están instalados `alert-dialog`, `drawer`, `progress`, `skeleton`, `badge` y `zod`.
  - Las queries del dueño cuelgan de `["albums", albumId, ...]`, y borrar una foto invalida `["albums"]`.
- **Maqueta.** `local/lumia-mobile.html`, tableros "Resultados · por foto" y "Resultados · por persona".

## Goals / Non-Goals

**Goals:**
- Que todos los totales salgan de la base con agregados en SQL, de modo que la API y la interfaz no puedan discrepar sobre qué es "pendiente".
- Que cada consulta del paquete nuevo reciba el dueño y filtre por él, igual que `albums.repository`.
- Que una sola petición alcance para pintar "Resultados" completo (resumen, por foto y por persona). El detalle de una persona se pide solo al abrirlo.

**Non-Goals:**
- **Paginación.** Con un tope de 50 fotos y sin tope de participantes, los agregados son una fila por foto y una por participante. Para el uso previsto (decenas de personas) la respuesta pesa pocos kilobytes.
- **Matriz completa de votos en la respuesta de resultados.** Crecería con fotos × participantes. El detalle va por participante (D2).
- **Contadores de votos sobre las miniaturas de "Fotos".** Quedan fuera según `proposal.md`.
- **Pruebas automatizadas.** Por decisión del proyecto no se agregan. Se verifica con `curl`, el navegador, `uv run ruff check`, `uv run ruff format --check` y `pnpm check`.

## Decisions

### D1 - Un paquete `results` para el lado del dueño, con rutas bajo `/albums/{album_id}`

Se crea `backend/src/packages/results/`, con un único `router = APIRouter(prefix="/albums/{album_id}")` y tres rutas:

| Método y ruta | Respuesta |
| --- | --- |
| `GET /results` | `Envelope[AlbumResultsResponse]` |
| `GET /participants/{participant_id}/ratings` | `Envelope[list[ParticipantVoteResponse]]` |
| `DELETE /participants/{participant_id}` | `Envelope[None]` |

Cada ruta depende de `current_user`, y su servicio empieza con `albums_service.get_album(connection, owner.id, album_id)`. Así un álbum ajeno da el mismo 404 que uno inexistente, igual que hace `sharing.generate_share_link`.

Las consultas de participantes filtran además por `album_id`. Un participante de otro álbum no produce fila, y el servicio lanza `NotFoundError`.

Alternativas descartadas:
- **Meter las rutas en `sharing`.** Ese paquete es el del enlace y del invitado, y su `owner_router` cuelga de `/share`.
- **Meterlas en `albums`.** Mezcla el CRUD del álbum con lecturas sobre votos.

### D2 - Agregados en SQL: resumen, por foto y por persona

Por foto, en orden de subida:

```sql
SELECT p.id, p.storage_key,
       COALESCE(SUM(r.approved = 1), 0) AS approved_count,
       COALESCE(SUM(r.approved = 0), 0) AS rejected_count
FROM photos p
LEFT JOIN ratings r ON r.photo_id = p.id
WHERE p.album_id = :album_id
GROUP BY p.id
ORDER BY p.id
```

Por persona, en orden de entrada:

```sql
SELECT pa.id, pa.name,
       COALESCE(SUM(r.approved = 1), 0) AS approved_count,
       COALESCE(SUM(r.approved = 0), 0) AS rejected_count
FROM participants pa
LEFT JOIN ratings r ON r.participant_id = pa.id
WHERE pa.album_id = :album_id
GROUP BY pa.id
ORDER BY pa.id
```

El servicio deriva los valores restantes en Python a partir de las dos listas, en la misma transacción:

- pendientes de una foto = participantes − a favor − en contra;
- calificadas de una persona = a favor + en contra;
- votos emitidos = la suma de calificadas;
- votos posibles = fotos × participantes.

Así las invariantes del spec (a favor + en contra + pendientes = participantes) se cumplen por construcción. El porcentaje completado lo calcula el frontend, y es 0 cuando no hay votos posibles.

Las claves foráneas compuestas garantizan que un voto siempre es del mismo álbum que su foto y su participante. Por eso no hace falta filtrar `ratings` por `album_id` en los `JOIN`.

Para el detalle de una persona, el servicio comprueba primero que el participante existe en el álbum (404 si no) y después ejecuta:

```sql
SELECT p.id, p.storage_key, r.approved
FROM photos p
LEFT JOIN ratings r
  ON r.photo_id = p.id AND r.participant_id = :participant_id
WHERE p.album_id = :album_id
ORDER BY p.id
```

Es la misma forma que `sharing.repository.list_guest_photos`. Las dos consultas viven en paquetes distintos a propósito: una se alcanza con la cookie del invitado y la otra con la sesión del dueño. Compartir la función acoplaría dos modelos de acceso.

Formas de respuesta, en camelCase vía `ApiModel`:

```json
{
  "summary": { "participantCount": 2, "voteCount": 4, "possibleVotes": 6 },
  "photos": [
    { "id": 1, "thumbUrl": "...", "approvedCount": 2, "rejectedCount": 0, "pendingCount": 0 }
  ],
  "participants": [
    { "id": 7, "name": "Luis", "ratedCount": 1, "approvedCount": 1, "rejectedCount": 0 }
  ]
}
```

En el detalle de una persona, cada elemento es `{ "id": 1, "thumbUrl": "...", "approved": true | false | null }`. Solo se firma la miniatura: la vista de resultados no amplía fotos.

Alternativas descartadas:
- **Calcular todo en el frontend a partir de la matriz de votos.** La respuesta crece con fotos × participantes y la regla de "pendiente" queda en el cliente.
- **Un `CROSS JOIN` de fotos × participantes para contar pendientes en SQL.** Es correcto, pero más caro y menos legible que restar.

### D3 - Borrar un participante es un único `DELETE ... RETURNING`

```sql
DELETE FROM participants
WHERE id = :participant_id AND album_id = :album_id
RETURNING id
```

- Si no se devuelve ninguna fila, el servicio lanza `NotFoundError` (404). Esto cubre el participante inexistente, el de otro álbum y el borrado repetido, sin una carrera entre comprobar y borrar.
- Los votos los borra la cascada de `ratings`, que se cumple porque cada conexión abre con `PRAGMA foreign_keys=ON`.
- No hay archivos en disco que limpiar, así que no hace falta una tarea en segundo plano.

`DELETE` sin cuerpo es seguro frente a CSRF en este alcance: un formulario HTML no puede emitirlo, y la cookie de sesión es `SameSite=Lax`.

### D4 - La vista del dueño se elige con parámetros de búsqueda

`/_owner/albums/$albumId` declara `validateSearch` con zod:

| Parámetro | Valores |
| --- | --- |
| `view` | `"photos"` (por defecto) o `"results"` |
| `by` | `"photo"` (por defecto) o `"person"`, solo en resultados |
| `sort` | `"upload"` (por defecto) o `"liked"`, solo en "Por foto" |
| `participant` | Identificador del participante cuyo detalle está abierto (opcional) |

Así funcionan la recarga, el botón "atrás" (cierra el detalle y vuelve de "Resultados" a "Fotos") y los enlaces a una vista concreta. Es el mismo patrón que `/a/$token` en `add-guest-voting`.

- Los parámetros por defecto se omiten de la URL con `search` de TanStack Router, para que `/albums/3` siga siendo la vista de fotos.
- La cabecera y las acciones "Subir fotos" y "Compartir" se mantienen en las dos vistas. La cuadrícula actual pasa a un componente `album-photos.tsx` sin cambiar su comportamiento.

Alternativas descartadas:
- **Una ruta hija `/albums/$albumId/results`.** Duplica la cabecera o exige un layout nuevo para lo que son dos pestañas de una pantalla.
- **Estado local.** Rompe la recarga y el botón "atrás".

### D5 - Componentes en `components/results/` y queries bajo la clave del álbum

| Componente | Contenido |
| --- | --- |
| `album-results.tsx` | Resumen, selector "Por foto" / "Por persona" y aviso de álbum sin participantes |
| `results-by-photo.tsx` | Lista de fotos con barra apilada; el orden "Más gustadas" se aplica en el cliente sobre una copia de la lista |
| `results-by-person.tsx` | Lista de participantes con `Progress`, botón de eliminar y `AlertDialog` de confirmación |
| `participant-votes.tsx` | `Drawer` con la cuadrícula de miniaturas y el estado de cada una |

Queries y mutación:

- **Resultados:** `["albums", albumId, "results"]`.
- **Detalle de una persona:** `["albums", albumId, "participants", participantId, "ratings"]`, habilitada solo con el detalle abierto.
- **Eliminar:** tras el éxito, invalida `["albums"]`. Esto recalcula los resultados y el `participantCount` del álbum y de la lista, cierra el diálogo y, si el detalle abierto era de esa persona, quita `participant` de la búsqueda. No es optimista: borrar es destructivo y poco frecuente, así que se espera la respuesta.

Hoy, borrar una foto ya invalida `["albums"]`, así que los resultados también se recalculan al borrar una foto.

La barra apilada de "Por foto" es un `div` con `role="img"` y un `aria-label` del tipo "5 me gusta, 1 no me gusta, 0 pendientes", como en la maqueta. Se dibuja con dos segmentos de ancho porcentual. No se agrega ningún componente de shadcn: los existentes alcanzan.

## Risks / Trade-offs

- **[Los invitados votan mientras el dueño mira]** → No hay tiempo real. Los resultados se actualizan al volver a enfocar la pestaña (comportamiento por defecto de TanStack Query) o tras una acción del dueño. Es suficiente para 0.1.0.
- **[El dueño borra a un participante que está votando en ese momento]** → Su siguiente voto recibe 401 porque la cookie ya no identifica a nadie. El frontend del invitado revierte el voto y avisa. Al recargar, ve la pantalla de nombre. Es el comportamiento pedido y no deja votos huérfanos.
- **[Muchos participantes]** → No hay tope. La respuesta crece linealmente, una fila por persona. Si algún día importa, se puede paginar "Por persona" sin cambiar los agregados.
- **[Un borrado accidental]** → Es irreversible y no hay historial. Lo mitiga la confirmación, que nombra a la persona y avisa que se borran sus votos.
- **[El detalle de una persona usa un identificador interno]** → Solo se expone al dueño autenticado, y siempre se filtra por su álbum. El invitado nunca recibe identificadores de participante.

## Migration Plan

No hay migración de datos ni de esquema. El despliegue es reconstruir las imágenes de `backend` y `frontend`. Para volver atrás basta desplegar la versión anterior. Los participantes ya borrados no se recuperan, pero eso es el comportamiento esperado de la acción.

## Open Questions

Ninguna.
