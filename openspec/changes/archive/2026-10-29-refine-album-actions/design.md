## Context

`frontend/src/routes/_owner/albums/$albumId.tsx` arma hoy la pantalla con un header (enlace "Mis álbumes", título y "N de 50 fotos"), una fila con "Subir fotos" y "Compartir", y un `<nav aria-label="Vista del álbum">` con dos `Button` ("Fotos" / "Resultados") que cambian `view` en la URL mediante `go()`. Todo vive en una columna `max-w-md` centrada. La vista activa ya marca `aria-current="page"`. `AlbumPhotos` dibuja una grilla de 3 columnas con un botón de borrar en la esquina de cada foto. `AlbumResults` recibe `onShare` para el aviso de álbum sin participantes. En `frontend/src/components/ui` no hay Tooltip ni Tabs. Ver proposal.md para la motivación y los specs para el comportamiento.

## Goals / Non-Goals

**Goals:**

- Jerarquía de la opción B del mockup: una sola acción destacada (el botón flotante), navegación por pestañas y "Compartir" como acción secundaria arriba.
- Mantener intacto el contrato de la URL (`view`, `by`, `sort`, `participant`) y el historial actual.

**Non-Goals:**

- Colapsar el botón flotante a "+" al hacer scroll.
- Cambiar los datos del header (el mockup muestra participantes y votos; se queda "N de 50 fotos").
- Cambiar `ShareAlbumDialog`, `UploadPhotosDialog` o el contenido de "Resultados".

## Decisions

### Pestañas como enlaces dentro de un `<nav>`, no como `Tabs` de Radix

Las pestañas son `Link` de TanStack Router con `search` (o se mantiene `go()` con un elemento clicable), dentro del `<nav aria-label="Vista del álbum">` existente, con `aria-current="page"` en la activa y un subrayado de 3px en color `primary` (borde inferior del contenedor de 1px, como en el mockup). Alternativa descartada: el componente `Tabs` de shadcn/Radix, que implementa el patrón ARIA `tablist` con paneles y flechas del teclado. Ese patrón es para paneles dentro de la misma página; aquí cada pestaña es un estado de la URL con su propia entrada de historial, así que la semántica correcta es navegación. Usar `Link` además da "abrir en pestaña nueva" y hace que el foco y el `Enter` funcionen sin código extra. Al ir a "Fotos" se limpian `by`, `sort` y `participant`, igual que hoy.

### Barra superior con "Mis álbumes" a la izquierda y "Compartir" a la derecha

El enlace "Mis álbumes" y un `Button` `variant="ghost"` `size="icon"` con `Share2` quedan en una misma fila (`justify-between`). El botón lleva `aria-label="Compartir"` y se envuelve en el `Tooltip` de shadcn, que se agrega con el MCP de shadcn (`frontend/src/components/ui/tooltip.tsx`; usa `radix-ui`, que ya está instalado). Se deshabilita mientras `album.isPending`, como hoy. El icono es `Share2` para no cambiar el lenguaje visual existente (el mockup usa un eslabón; es un detalle cosmético). Alternativa descartada: dejar el texto "Compartir" visible; vuelve a competir con el botón flotante.

### Botón flotante "Subir fotos" fijo y alineado a la columna

Un `Button` de alto 56px, radio grande, sombra e icono `Plus`, que abre `UploadPhotosDialog`. Para que en escritorio no quede pegado al borde de la ventana sino al de la columna `max-w-md`, va dentro de un contenedor `fixed inset-x-0 bottom-0` con `mx-auto max-w-md`, padding inferior `calc(1.5rem + env(safe-area-inset-bottom))` y el botón alineado a la derecha (`pointer-events-none` en el contenedor y `pointer-events-auto` en el botón, para no bloquear toques en la grilla). Se renderiza solo si `view === "photos"`, `photos.isSuccess` y `remainingSlots > 0`.

Decisión: con el álbum lleno el botón se **oculta**, no se deshabilita. Un FAB deshabilitado ocupa espacio y parece roto; Material recomienda no mostrar un FAB cuya acción no está disponible. El aviso "El álbum está lleno." se muestra bajo "N de 50 fotos" en el header. Mientras cargan las fotos tampoco se muestra, para no hacerlo aparecer y desaparecer.

### Espacio inferior en la grilla

`AlbumPhotos` agrega un `padding-bottom` de alrededor de 6rem (56px del botón + 24px de margen + aire) a la sección de la grilla. Se aplica siempre en la vista "Fotos", aunque el álbum esté lleno, para no cambiar el layout al llegar a 50. Alternativa descartada: medir el botón con JS; el alto es fijo y conocido.

## Risks / Trade-offs

- [Un icono sin texto es menos descubrible] → `aria-label` y tooltip; el icono de compartir es convencional. El aviso de "Resultados" sin participantes conserva su botón "Compartir" con texto.
- [El tooltip no aparece en táctil] → En teléfono el nombre accesible sigue presente; el tooltip es un complemento para puntero y teclado.
- [El botón flotante puede tapar el contenido o el teclado virtual] → Espacio inferior en la grilla; el botón no convive con campos de texto en esta vista.
- [Diálogos abiertos sobre un elemento `fixed`] → Los diálogos de Radix se renderizan en un portal con overlay por encima; se verifica a mano que el botón quede detrás.

## Migration Plan

Cambio solo de frontend, sin datos ni API. Se despliega con el resto del frontend; revertir el commit restaura la pantalla anterior.

## Open Questions

Ninguna.
