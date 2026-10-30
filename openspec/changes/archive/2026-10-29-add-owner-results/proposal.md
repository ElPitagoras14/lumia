## Why

Los invitados ya votan, pero el dueño no puede ver qué gustó: solo sabe cuántas personas entraron. La vista de resultados está dentro del alcance de 0.1.0 (decisión 6 del diseño) y es lo que le da sentido a compartir el álbum. Además, el dueño no tiene forma de quitar a un participante, por ejemplo a uno de prueba o a uno que entró por error, aunque el diseño de 0.1.0 lo prevé.

## What Changes

- El dueño consulta los resultados de un álbum suyo:
  - **Resumen:** cuántos participantes hay, cuántos votos se emitieron de los posibles (fotos × participantes) y el porcentaje completado.
  - **Por foto:** en orden de subida, cuántos votos a favor y en contra tiene cada foto y cuántos participantes la tienen pendiente.
  - **Por persona:** en orden de entrada, el nombre de cada participante, cuántas fotos calificó del total, y sus votos a favor y en contra.
  - **Detalle de una persona:** qué votó en cada foto: a favor, en contra o pendiente.
- Un voto que no existe cuenta como pendiente. Nunca cuenta como a favor ni en contra.
- El dueño borra un participante de un álbum suyo, y con él sus votos. Si esa persona vuelve con su cookie, ya no se la reconoce y se le pide el nombre como a alguien nuevo.
- Todo se filtra por el dueño de la sesión. Un álbum de otro dueño, o un participante de otro álbum, responde 404, igual que uno inexistente.
- Frontend del dueño, según `local/lumia-mobile.html` ("Resultados · por foto" y "Resultados · por persona"):
  - La pantalla del álbum suma un selector "Fotos" / "Resultados".
  - "Resultados" muestra el resumen y alterna entre "Por foto" y "Por persona".
  - "Por foto" puede ordenarse por "Más gustadas".
  - En "Por persona", cada participante tiene su barra de avance y un botón para eliminarlo, que pide confirmación. Tocar a un participante abre el detalle de sus votos.
- Sin cambios de esquema ni dependencias nuevas.

## Capabilities

### New Capabilities

- `owner-results`: el dueño consulta los resultados de un álbum propio (resumen, por foto, por persona y detalle de cada persona) y borra participantes con sus votos, desde la API y desde la interfaz.

### Modified Capabilities

Ninguna. El borrado en cascada de votos ya está en `data-model`. El efecto en el invitado (su cookie deja de identificarlo) se desprende de `guest-access` sin cambiar sus requisitos, y se documenta como escenario en `owner-results`.

## Impact

- **Backend:** un paquete nuevo `packages/results`, montado en `routes.py`, con estas rutas del dueño:
  - `GET /api/albums/{album_id}/results`
  - `GET /api/albums/{album_id}/participants/{participant_id}/ratings`
  - `DELETE /api/albums/{album_id}/participants/{participant_id}`

  Reutiliza `current_user`, `albums_service.get_album` y `images.variant_url`.
- **Frontend:**
  - `routes/_owner/albums/$albumId.tsx` suma el selector de vista con parámetros de búsqueda.
  - Componentes nuevos en `components/results/`.
  - Llamadas nuevas en `lib/api.ts`.
- **`README.md`:** describir la vista de resultados y las rutas nuevas.
- **Fuera de este cambio:**
  - Contadores de votos sobre las miniaturas de la pestaña "Fotos" y "N votos" en la cabecera del álbum, aunque la maqueta los muestra.
  - Exportar resultados.
  - Actualización en tiempo real.
  - Pruebas automatizadas, por decisión del proyecto.
