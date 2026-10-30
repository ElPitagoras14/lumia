## 1. Backend

- [x] 1.1 Crear `backend/src/packages/results/` con `schemas.py`, `repository.py`, `service.py`, `responses.py` y `router.py`, siguiendo la forma de los demás paquetes:
  - **`schemas.py`:** `PhotoTallyRecord`, `ParticipantTallyRecord` y `ParticipantVoteRecord`.
  - **`repository.py`:** las consultas por foto, por persona y de detalle (D2), más `delete_participant` con `DELETE ... WHERE id AND album_id RETURNING id` (D3). Todas reciben `album_id`.

  Verificar en una consola de Python contra una base con votos que los agregados coinciden con un recuento a mano.
- [x] 1.2 Implementar en `service.py`:
  - `get_results(connection, owner_id, album_id)`: llama a `albums_service.get_album`, combina las dos listas y deriva pendientes, calificadas, votos emitidos y posibles (D2).
  - `list_participant_votes`: lanza `NotFoundError` si el participante no está en el álbum.
  - `delete_participant`: lanza `NotFoundError` cuando no se borra ninguna fila.

  Verificar en consola que, en cada foto, a favor + en contra + pendientes = participantes.
- [x] 1.3 Declarar en `responses.py` `AlbumResultsResponse` (`summary`, `photos`, `participants`) y `ParticipantVoteResponse`, firmando solo `thumb` con `variant_url`. Montar `router` en `src/routes.py` con las tres rutas de D1, dependientes de `current_user`. Verificar con `curl` y cookie de sesión:
  - `GET /api/albums/{id}/results` devuelve el resumen y las listas en camelCase, sin `storageKey` ni `tokenHash`.
  - Sin sesión da 401.
  - Un álbum inexistente da 404.
  - El detalle de un participante lista todas las fotos con `approved` `true`, `false` o `null`.
  - El detalle con un participante de otro álbum da 404.
  - `DELETE` de un participante da 200, borra sus filas de `ratings` y conserva las de los demás, y repetirlo da 404.
  - El `DELETE` con un participante de otro álbum da 404 y no borra nada.
- [x] 1.4 Verificar el efecto en el invitado: tras borrar a un participante, `GET /api/share/{token}` con su cookie devuelve `participant: null`, y `GET /api/share/{token}/photos` da 401.
- [x] 1.5 Ejecutar `uv run ruff check --fix` y `uv run ruff format` en `backend/`. Verificar que ambos terminan sin observaciones.

## 2. Frontend: datos y navegación

- [x] 2.1 Añadir a `frontend/src/lib/api.ts`:
  - los tipos `AlbumResults`, `PhotoTally`, `ParticipantTally` y `ParticipantVote`;
  - las funciones `getAlbumResults(albumId)`, `getParticipantVotes(albumId, participantId)` y `deleteParticipant(albumId, participantId)`.

  Verificar que `pnpm check` pasa.
- [x] 2.2 Declarar `validateSearch` con zod en `routes/_owner/albums/$albumId.tsx` (`view`, `by`, `sort`, `participant`), con los valores por defecto fuera de la URL (D4). Mover la cuadrícula de fotos actual a `components/album-photos.tsx` sin cambiar su comportamiento. Agregar el selector "Fotos" / "Resultados" con `aria-current`. Verificar en el navegador:
  - Subir y borrar fotos sigue funcionando.
  - Recargar en "Resultados" conserva la vista.
  - El botón "atrás" vuelve a "Fotos".

## 3. Frontend: pantallas de resultados

- [x] 3.1 Crear `components/results/album-results.tsx` con la query `["albums", albumId, "results"]`, el resumen (personas, "N de M votos" y porcentaje completado, que es 0 sin votos posibles), el selector "Por foto" / "Por persona", el esqueleto de carga, el mensaje de error y el aviso de álbum sin participantes con acceso a "Compartir". Verificar en un álbum sin participantes que aparece el aviso, y en uno con votos que el resumen coincide con la API.
- [x] 3.2 Crear `components/results/results-by-photo.tsx`:
  - Miniatura y "Foto N" según el orden de subida, aunque se reordene.
  - Votos a favor y en contra.
  - Barra apilada con `role="img"` y `aria-label`.
  - "Todos votaron" o "N pendientes".
  - Botón "Más gustadas" que alterna `sort` (D5).

  Verificar:
  - El orden por defecto es el de subida.
  - "Más gustadas" pone primero la foto con más votos a favor, y ante un empate respeta el orden de subida.
- [x] 3.3 Crear `components/results/results-by-person.tsx`:
  - Inicial, nombre, "N de M", `Progress` con nombre accesible, votos a favor y en contra, y "Terminó" o "N pendientes".
  - Fila tocable que abre el detalle (`participant` en la búsqueda).
  - Botón "Eliminar a <nombre> y sus votos" con `AlertDialog`, error en español y la invalidación de `["albums"]` de D5.

  Verificar:
  - Cancelar deja a la persona intacta.
  - Confirmar la quita y recalcula el resumen y los totales por foto sin recargar.
  - La lista de álbumes muestra un participante menos.
- [x] 3.4 Crear `components/results/participant-votes.tsx`: un `Drawer` con el nombre, "N de M", y una cuadrícula de miniaturas con indicador "me gusta", "no me gusta" o "pendiente" y `aria-label` del tipo "Foto 3: no me gusta". Se cierra quitando `participant` de la búsqueda. Verificar:
  - El detalle coincide con lo que la persona votó en su "Mis votos".
  - El botón "atrás" cierra el detalle.
- [x] 3.5 Ejecutar `pnpm check` en `frontend/`. Verificar que termina sin observaciones.

## 4. Documentación y verificación integral

- [x] 4.1 Añadir en `README.md` la vista de resultados del dueño: qué muestra, que lo no votado cuenta como pendiente y que eliminar un participante borra sus votos y obliga a esa persona a entrar de nuevo. Documentar las rutas nuevas con el mismo formato que la sección de la API del invitado:
  - `GET /api/albums/{album_id}/results`
  - `GET /api/albums/{album_id}/participants/{participant_id}/ratings`
  - `DELETE /api/albums/{album_id}/participants/{participant_id}`

  No hay variables de entorno nuevas. Verificar que la sección sigue el estilo de documentación del repo.
- [ ] 4.2 Verificar el flujo completo con `docker compose up --build`:
  1. El dueño sube 4 fotos y comparte el álbum.
  2. María vota las 4 y Luis vota 1, cada uno en una ventana privada distinta.
  3. El dueño ve en "Resultados" 2 personas, "5 de 8 votos" y 63 %, y en "Por persona" a Luis con "1 de 4" y "3 pendientes".
  4. El dueño abre el detalle de María y ve sus 4 votos.
  5. El dueño revoca el enlace: los totales no cambian.
  6. El dueño elimina a Luis: el resumen pasa a 1 persona y "4 de 4 votos".
  7. Luis abre el enlace nuevo con su cookie, ve la pantalla de nombre, entra y encuentra las 4 fotos pendientes.
  8. El dueño borra una foto: los totales por foto y el resumen se recalculan.
