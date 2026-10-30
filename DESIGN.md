---
name: Lumia
description: Share a photo album by link and let anyone vote on each photo with a swipe.
colors:
  primary: "oklch(0.56 0.09 58)"
  primary-foreground: "oklch(1 0 0)"
  secondary: "oklch(0.93 0.035 70)"
  secondary-foreground: "oklch(0.38 0.06 50)"
  background: "oklch(0.9821 0 0)"
  foreground: "oklch(0.2435 0 0)"
  card: "oklch(0.9911 0 0)"
  muted: "oklch(0.9521 0 0)"
  muted-foreground: "oklch(0.5032 0 0)"
  border: "oklch(0.8822 0 0)"
  destructive: "oklch(0.55 0.19 33)"
  primary-dark: "oklch(0.76 0.1 65)"
  primary-foreground-dark: "oklch(0.2 0.02 55)"
  secondary-dark: "oklch(0.27 0.012 60)"
  background-dark: "oklch(0.17 0 0)"
  foreground-dark: "oklch(0.95 0 0)"
  card-dark: "oklch(0.215 0 0)"
  muted-dark: "oklch(0.26 0 0)"
  muted-foreground-dark: "oklch(0.72 0 0)"
  border-dark: "oklch(0.3 0 0)"
  destructive-dark: "oklch(0.7 0.17 35)"
typography:
  display:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  title:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4.8px"
  md: "6.4px"
  lg: "8px"
  xl: "11.2px"
  2xl: "14.4px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  column: "448px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 16px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 16px"
  button-ghost:
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    size: "44px"
  button-fab:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.2xl}"
    height: "56px"
    padding: "0 20px"
  vote-button:
    rounded: "{rounded.full}"
    size: "56px"
  input:
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "4px 12px"
  badge-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
    height: "20px"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
    padding: "16px"
  deck-card:
    backgroundColor: "{colors.muted}"
    rounded: "{rounded.2xl}"
---

# Design System: Lumia

## Overview

**Creative North Star: "The Light Table"**

Lumia is a photographer's light table. The surface is even, neutral and quiet, and the only things that glow on it are the photos and the one action that matters on each screen. The interface steps back: no tinted backgrounds, no decorative color, no ornament that competes with a picture. Warmth lives in a single place, the toasted-honey accent, and it is spent sparingly.

Every surface is a task surface (Operate mode). The owner manages albums and reads results; the guest swipes through a deck. Both happen on a phone first, inside a single centered column, so density stays moderate and touch targets stay generous. The components are tactile and friendly: soft corners, a physical response to touch (the deck card follows the finger and tilts, buttons dip a pixel on press), and large round voting buttons a thumb can find without looking.

Light and dark are equal citizens. The app follows the system preference, with no theme switch, and every token has a pair. In dark mode the table becomes a graphite viewer and the honey lightens so it still reads as the one source of light.

**Key Characteristics:**
- Neutral graphite surfaces with zero chroma; the honey accent is the only hue in the chrome.
- Photos carry the color and get the space.
- One centered column (448px max) on every screen, phone-first.
- Flat at rest; shadows only on things you can pick up (deck cards, the floating upload button).
- Tactile, soft-cornered controls with physical feedback.

## Colors

A neutral graphite scale with a single toasted-honey accent, defined in OKLCH as a light/dark pair for each role.

### Primary
- **Toasted Honey** (`primary`, light / `primary-dark`, dark): the one voice. Primary buttons, the floating "Subir fotos" button, the "me gusta" button, tag and counts, the small dot of an active share link, and the focus ring. Brand marks, active tabs, selected options and progress fills are neutral, not honey. In light it is the lightest honey that still passes contrast with white text; in dark it brightens and takes dark text.

### Secondary
- **Pale Honey Wash** (`secondary` / `secondary-dark`): secondary buttons and soft emphasis. In light it is a faint honey cream with deep-honey text; in dark it is graphite with only a trace of warmth.

### Neutral
- **Light Table White** (`background` / `background-dark`): the page. Pure neutral, never tinted.
- **Sheet** (`card` / `card-dark`): cards, dialogs and popovers sit one half-step above the page.
- **Graphite Ink** (`foreground` / `foreground-dark`): body text and icons.
- **Pencil** (`muted-foreground` / `muted-foreground-dark`): secondary text, captions, counters, hints.
- **Tray** (`muted` / `muted-dark`): skeletons, image placeholders, the empty track behind progress bars.
- **Hairline** (`border` / `border-dark`): borders, input strokes and dividers.

### Signal
- **Ember** (`destructive` / `destructive-dark`): deleting things, error messages and the "no me gusta" vote. Used as a tint (10–20% background) with full-strength text, never as a solid fill. The light value is dark enough to read as 14px text (5.05:1 on the page, 4.63:1 on the tray).

### Named Rules
**The One Light Rule.** Honey is the only hue in the interface. If a screen has two honey elements competing, one of them is wrong. Photos are the only other color allowed.

**The Honey Means Yes Rule.** A positive vote is honey, a negative vote is ember, everywhere: in the deck, the viewer's selected state and the small vote marks on thumbnails. Never green.

**The Neutral Selection Rule.** The selected option of a selector (filters, groupings, sort, tabs) is graphite: the button `selected` variant, or a foreground underline for tabs. Selection is state, not an action, so it never takes honey.

**The Paired Token Rule.** Never write a raw color in a component. Every color is a token with a light and a dark value, so dark mode cannot drift.

**The Readable Signal Rule.** Any token used as text (foreground, pencil, honey, ember) must reach 4.5:1 on both the page and the tray, in light and in dark. Check a new value before shipping it.

## Typography

**Display Font:** Inter Variable (with sans-serif)
**Body Font:** Inter Variable (with sans-serif)

**Character:** One family, neutral and highly legible, so the type never competes with the photos. Hierarchy comes from weight and size, not from a second face.

### Hierarchy
- **Display** (700, 1.5rem, 1.25, tight tracking): the single heading on standalone screens such as login and the guest's done screen.
- **Headline** (600, 1.125–1.5rem): the page heading inside the app ("Tus álbumes" at 1.5rem, with a muted summary line under it) and section headings. The page heading is always larger than the brand name in the header.
- **Title** (600, 1rem): the app name, album titles, list item names.
- **Body** (400, 0.875rem): the default text size of the interface, including buttons, errors and descriptions.
- **Label** (400, 0.8125rem, muted): captions, counters, hints and helper text under controls.

### Named Rules
**The Weight Not Face Rule.** Emphasis is a heavier weight of Inter, never a new font, italic or color.

## Layout

Every screen is a single centered column, `max-width: 448px`, with 16px side padding (24px on standalone screens like login and the done screen). Sections stack with 24px gaps; items inside a section use 12px; a label and its control use 8px. Screens that need the full height (the deck) use `100svh` and let the photo take all remaining space between the header and the voting buttons.

Grids appear only for photos: a 3-column square grid with 8px gaps for the owner's album. The floating "Subir fotos" button is pinned to the bottom of the column and respects the safe-area inset.

There are no breakpoints beyond the column: on a desktop the app is the same phone-width column centered on the page.

## Elevation & Depth

Flat by default. Surfaces separate through tonal steps (page, sheet, tray) and a 1px ring at 10% foreground on cards. Shadows exist only on objects the user can physically move or reach for: the deck card being swiped and the floating action buttons (both use a large soft shadow, Tailwind's `shadow-lg`).

### Named Rules
**The Pick-Up Rule.** If you can't drag it or it doesn't float over content, it doesn't get a shadow.

## Shapes

Gently curved corners derived from one base radius (8px). Controls and thumbnails use the base; cards use 1.4× (about 11px); the deck card and the floating button use 1.8× (about 14px) so the objects you handle feel softer. Badges and voting buttons are fully round. Photos are always clipped to the radius of their container and use `object-cover`; they are never letterboxed in a grid.

## Components

### Buttons
Tactile and friendly: they respond to touch with a 1px press.
- **Shape:** base radius (8px); voting buttons are circles; the floating button uses the larger radius (14px).
- **Primary:** honey fill with white text in light, dark text in dark. 44px tall by default; `lg` is 48px.
- **Outline:** page background with a hairline border; used for secondary actions in headers ("Cerrar sesión", "Mis votos") and for the unselected options of a selector.
- **Selected:** graphite fill with page-colored text; the chosen option of a filter, grouping or sort selector (paired with `aria-pressed`).
- **Ghost:** no fill until hover (tray); used for icon actions such as delete on a card.
- **Destructive:** ember tint background with ember text; never a solid red fill.
- **Hover / Focus:** hover lowers the fill to 80%; focus shows a 3px honey ring at 50%. Active presses down 1px.
- **Floating "Subir fotos":** 56px tall, bold, honey, with the pick-up shadow.

### Badges
- **Style:** pill-shaped, 20px tall, 12px medium text.
- **State:** both are outline badges. "Enlace activo" carries a small honey dot, like a lit indicator; "Sin enlace" uses muted text and no dot.

### Vote Marks
- **Style:** a 24px circle on the corner of a thumbnail, page color at 90% opacity, with a honey heart or an ember cross. Never a solid colored fill over a photo.

### Brand Mark
- **Style:** a plain "Lumia" wordmark in semibold, with no icon tile, in a 44px header row. In the owner's header it sits opposite a quiet ghost "Cerrar sesión"; the guest's entry, loading and error screens carry it too, so a dead link still says where you are. Login uses "Lumia" as its heading instead.

### Album Cover Mosaic (signature component)
The owner's album list is the light table itself: each album is a 160px-tall mosaic of its first three photos at full column width (the first photo large on the left, two thin ones stacked on the right, 2px gutters, the larger card radius). One photo fills the frame alone; an empty album shows a tray-colored frame with "Sin fotos todavía". The title and "N fotos · ● Enlace activo" sit below the mosaic, with a 44px ghost delete button on that row. No card container, no border: the photos are the card.

### Results Reveal (signature component)
What the owner comes to see leads the screen. Once there are votes, results default to "most liked": the leader leaves the list and is shown large (4:3, full column width) with "La más gustada", its number and "♥ N de M personas" in honey. A tie for first never crowns one photo: the leaders (up to six) are shown together in a 3-column square grid under "N fotos empatadas en primer lugar". Below three voters nothing is crowned: a muted note says there are still few votes and the ranking shows as a plain list. In the rows, the approve bar is solid honey and the reject bar is an ember tint, so a "no" is never the loudest mark on the screen. The context is one muted line of numbers ("3 personas · 14 de 30 votos · 47 % completado"), never stat tiles. Every photo, the leader and each row, opens a dialog with the photo large and its tally.

### Owner Photo Grid
A 3-column square grid of the album's photos with nothing laid over them. Tapping a photo opens it large in a dialog with its number and a ghost-ember "Borrar" action; deleting never sits on the thumbnails, where a scroll could brush it. Under the album title, one muted status line reads "N de 50 fotos · ● Enlace activo · N personas".

### Vote Change Bar
After each deck vote, the hint line under the vote buttons becomes "Me gusta en la foto 3 · Cambiar" for five seconds, at the same 44px height so the deck does not jump. "Cambiar" flips the vote; there is no way back to pending by design.

### Guest Ending
"¡Listo, nombre!" in Display, a line saying the votes reached the album's owner, a "Te gustaron" grid of up to six liked photos, the counts as one line ("♥ 8 me gustan · ✕ 3 no me gustan") and "Revisar mis votos" at the bottom. No stat tiles.

### Floating Primary Action
Each owner screen keeps its one honey action in a 56px floating button at the bottom right of the column ("Nuevo álbum" on the list, "Subir fotos" inside an album), in the thumb's reach. When the next step changes, the honey moves with it: an album with photos and no link makes its labelled "Compartir" button honey and the floating upload button steps down to outline. Screens with a floating action reserve bottom padding so the last item is never covered.

### Cards / Containers
- **Corner Style:** about 11px.
- **Background:** sheet (`card`).
- **Shadow Strategy:** none; a 1px ring at 10% foreground (see Elevation & Depth).
- **Internal Padding:** 16px (12px for compact list cards).

### Inputs / Fields
- **Style:** hairline stroke, transparent background (a faint input wash in dark), base radius, 44px tall; text is 16px on phones to avoid iOS zoom and 14px from `md` up.
- **Focus:** the stroke turns honey with a 3px honey ring at 50%.
- **Error / Disabled:** errors turn the stroke ember with an ember ring; the message sits below in ember with `role="alert"`. Disabled fields drop to 50% opacity.

### Swipe Deck (signature component)
The heart of the guest experience: a full-bleed photo card that follows the finger, tilts with the drag (0.05° per pixel), and shows a stamped "ME GUSTA" (honey) or "NO ME GUSTA" (ember) tag whose opacity grows with the drag. Past 30% of its width, or on a quick flick, it flies off while the next card is already waiting underneath at 95% scale. Below it sit two 56px round buttons, outline "no" and honey "sí", with the same effect, and the arrow keys do the same. Above it, one compact line carries the album title and "Hola, nombre" next to a ghost "Mis votos" button, and below that a thin graphite progress bar runs beside a tabular "N de M" counter. Motion is skipped entirely when the user prefers reduced motion. Each vote is announced to screen readers through a polite live region ("Me gusta en la foto 3. Quedan 9 fotos."), and the vote buttons declare their arrow-key shortcuts.

## Do's and Don'ts

### Do:
- **Do** let photos take the space: full-bleed in the deck, square `object-cover` tiles in grids.
- **Do** use honey for exactly one primary action per screen, plus positive-vote signals and the active-link dot.
- **Do** define every new color as a light/dark token pair in `styles.css`.
- **Do** keep everything inside the 448px column with 16px side padding.
- **Do** keep every touch target at 44px or more: the default button, icon button and input are 44px. The `sm` (36px) and `icon-sm` sizes are only for secondary controls laid over photos, such as the delete button on an owner's thumbnail.
- **Do** respect `prefers-reduced-motion` for any movement beyond a color change.

### Don't:
- **Don't** tint backgrounds or cards; the table is neutral.
- **Don't** use green for "me gusta", or honey for a selected option, a tab or a brand mark.
- **Don't** stack an icon tile above a heading.
- **Don't** add shadows to cards, lists or dialogs at rest (The Pick-Up Rule).
- **Don't** add a second typeface or use color for emphasis in text.
- **Don't** use solid red fills; destructive actions are an ember tint.
- **Don't** add a theme switch; the app follows the system preference.
