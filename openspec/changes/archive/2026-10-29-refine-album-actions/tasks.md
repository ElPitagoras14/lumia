## 1. Componentes base

- [x] 1.1 Agregar el componente Tooltip con el MCP de shadcn en `frontend/src/components/ui/tooltip.tsx` y verificar que el archivo existe y que `pnpm check` pasa sin dependencias nuevas en `package.json`

## 2. Pantalla del álbum

- [x] 2.1 En `frontend/src/routes/_owner/albums/$albumId.tsx`, poner "Mis álbumes" y un botón de icono `Share2` (`aria-label="Compartir"`, tooltip "Compartir", deshabilitado mientras carga el álbum) en una misma barra superior que abre `ShareAlbumDialog`; quitar la fila de botones "Subir fotos" / "Compartir". Verificar que el icono abre el diálogo en "Fotos" y en "Resultados" y que el tooltip aparece con puntero y con foco de teclado
- [x] 2.2 Mover el aviso "El álbum está lleno." bajo "N de 50 fotos" en el header y verificar que aparece en un álbum con 50 fotos
- [x] 2.3 Reemplazar los botones "Fotos" / "Resultados" por pestañas subrayadas dentro del `<nav aria-label="Vista del álbum">`, con `aria-current="page"` en la activa y la misma lógica de búsqueda (ir a "Fotos" limpia `by`, `sort` y `participant`). Verificar que recargar en "Resultados" › "Por persona" se mantiene, que "atrás" vuelve de "Resultados" a "Fotos" y que el detalle de una persona sigue cerrándose con "atrás"
- [x] 2.4 Agregar el botón flotante extendido "+ Subir fotos" (icono `Plus`, alto 56px, abajo a la derecha alineado a la columna `max-w-md`, con margen de safe area) que abre `UploadPhotosDialog`, renderizado solo con `view === "photos"`, fotos cargadas y `remainingSlots > 0`. Verificar que no aparece en "Resultados", ni mientras cargan las fotos, ni con el álbum lleno

## 3. Grilla de fotos

- [x] 3.1 En `frontend/src/components/album-photos.tsx`, agregar espacio inferior (~6rem) a la sección para que el botón flotante no tape la última fila. Verificar en ancho de teléfono (390px) con un álbum de varias filas que, al bajar al final, la última fila y sus botones de borrar quedan visibles por encima del botón

## 4. Cierre

- [x] 4.1 Revisar a mano la pantalla en 390px y en escritorio contra la opción B de `local/lumia-album-acciones.html` (barra superior, pestañas, botón flotante y "Resultados" sin botón flotante), y confirmar que los diálogos de subir y compartir quedan por encima del botón flotante
- [x] 4.2 Ejecutar `pnpm check` en `frontend` y verificar que pasa sin errores
