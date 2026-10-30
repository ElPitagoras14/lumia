## Why

El invitado ya entra a un álbum compartido con su nombre, pero después solo ve una pantalla provisional que dice que calificar "todavía no está disponible". La tabla `ratings` existe desde la migración `0002` sin API ni pantallas. Votar es el núcleo de Lumia, y sin votos tampoco se puede construir la vista de resultados del dueño.

## What Changes

- El invitado identificado consulta las fotos del álbum compartido en orden de subida. Cada foto trae sus variantes firmadas y el voto actual del invitado: a favor, en contra o pendiente.
- El invitado vota una foto a favor o en contra. Si ya la había votado, el voto nuevo reemplaza al anterior. No hay forma de volver a "pendiente".
- Las rutas de fotos y votos exigen una cookie de participante válida para el álbum del token. Sin ella responden 401. Un token desconocido o revocado responde 404, como hoy.
- Frontend del invitado, según `local/lumia-mobile.html`:
  - **Mazo de swipe:**
    - Cartas con la variante `deck`.
    - Deslizar a la derecha es "me gusta" y a la izquierda "no me gusta". También hay botones y atajos de teclado.
    - Muestra el progreso "N de M" y precarga las siguientes cartas.
    - Retoma desde la primera foto sin calificar.
  - **Visor:** foto ampliada con la variante `viewer`, con anterior, siguiente y cambio de voto.
  - **"Mis votos":** cuadrícula de miniaturas con filtros Todas, Me gusta, No me gusta y Pendientes. Tocar una foto abre el visor, y un botón lleva de vuelta al mazo.
  - **Pantalla final "¡Listo, <nombre>!":** totales a favor y en contra, y acceso a "Mis votos".
  - Un álbum sin fotos muestra un aviso en lugar del mazo.
- La pantalla de nombre adopta los textos de la maqueta: "Te invitaron a votar", "¿Cómo te llamas?", "Empezar a votar" y "Tu avance se guarda". La pantalla provisional de bienvenida desaparece.
- Sin cambios de esquema ni dependencias nuevas.

## Capabilities

### New Capabilities

- `guest-voting`: el invitado consulta las fotos de un álbum compartido con su voto, vota y cambia votos. La interfaz incluye el mazo, el visor, "Mis votos" y la pantalla final.

### Modified Capabilities

- `guest-access`: la interfaz del invitado ya no termina en una pantalla de bienvenida. Tras entrar, o al volver identificado, lleva a la votación, y la pantalla de nombre explica que se va a votar.

## Impact

- **Backend:**
  - `packages/sharing` suma rutas bajo `/api/share/{token}`: `GET /photos` y `PUT /photos/{photo_id}/rating`.
  - Hay consultas nuevas de fotos con el voto del participante, y un upsert de votos.
  - Se reutiliza `images.variant_url`.
- **Frontend:**
  - `routes/a/$token.tsx` reemplaza la pantalla provisional y pasa a albergar las vistas del invitado.
  - Se agregan los componentes del mazo, el visor y la galería, junto con llamadas nuevas en `lib/api.ts`.
- **`README.md`:** describir el flujo de votación del invitado.
- **Fuera de este cambio:** la vista de resultados del dueño, borrar participantes, deshacer un voto para volver a "pendiente", el modo oscuro y la pantalla de enlace inválido con el texto nuevo de la maqueta.
