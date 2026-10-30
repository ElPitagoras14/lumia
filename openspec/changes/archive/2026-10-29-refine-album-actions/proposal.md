## Why

La pantalla de un álbum del dueño muestra cuatro botones con el mismo peso visual ("Subir fotos", "Compartir", "Fotos" y "Resultados"), así que no se distingue cuál es la acción principal ni cuáles son solo navegación. Las guías de Material piden una sola acción destacada por pantalla (el FAB), y los selectores tipo pestaña o segmentado son para navegar entre vistas, no para ejecutar acciones. El mockup `local/lumia-album-acciones.html` (opción B, la recomendada) resuelve esa jerarquía.

## What Changes

- "Fotos" y "Resultados" pasan a ser pestañas subrayadas (navegación), en lugar de botones. Se conservan los parámetros de la URL (`view`, `by`, `sort`, `participant`), así que recargar y "atrás" siguen funcionando igual.
- "Compartir" pasa a ser un botón de icono en la barra superior, junto a "Mis álbumes", con nombre accesible y tooltip. Abre el mismo diálogo de compartir de hoy y está disponible en ambas pestañas.
- "Subir fotos" pasa a ser un botón flotante extendido ("+ Subir fotos") abajo a la derecha:
  - Solo aparece en la pestaña "Fotos"; en "Resultados" no hay botón flotante.
  - No se muestra cuando el álbum está lleno (50 fotos); el aviso "El álbum está lleno." se mantiene.
  - La grilla de fotos reserva espacio abajo para que el botón nunca tape las últimas fotos.
  - Colapsarlo a "+" al hacer scroll queda fuera de este cambio.
- El botón "Compartir" del aviso de "Resultados" sin participantes se mantiene.
- Sin cambios de backend, de API ni de esquema. Se agrega el componente Tooltip de shadcn (usa `radix-ui`, que ya es dependencia).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `album-sharing`: el requisito "La interfaz del dueño permite compartir, copiar y revocar" precisa que "Compartir" es un botón de icono en la barra superior, con nombre accesible y tooltip, disponible en ambas vistas.
- `owner-results`: el requisito "La interfaz del dueño muestra los resultados del álbum" cambia el selector "Fotos" / "Resultados" a pestañas de navegación y define el botón flotante "Subir fotos", solo en "Fotos" y oculto con el álbum lleno.

## Impact

- Frontend: `frontend/src/routes/_owner/albums/$albumId.tsx` (barra superior, pestañas, botón flotante), `frontend/src/components/album-photos.tsx` (espacio inferior de la grilla) y un nuevo `frontend/src/components/ui/tooltip.tsx` agregado con el MCP de shadcn.
- Backend: sin cambios.
- Documentación: sin cambios en el README (no hay dependencias, scripts ni variables nuevas).
