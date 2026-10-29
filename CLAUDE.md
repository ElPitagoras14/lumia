# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

## Idioma

- Responder siempre en español en el chat, sin importar el idioma de la consulta.
- El código, comentarios en código, commits y nombres de ramas se mantienen en inglés (convención estándar del repo).

## Control de versiones

- No hacer `git commit` (ni `git push`) a menos que el usuario lo pida explícitamente en el mensaje actual. Preparar los cambios y describir qué se haría, pero esperar confirmación antes de commitear.
- Si el usuario ya está en `main`, sugerir crear una rama antes de commitear, pero no crearla por defecto: esperar confirmación explícita antes de hacerlo.
- Usar nombres de rama canónicos con el formato `<tipo>/<descripcion-corta-en-kebab-case>`, por ejemplo:
  - `feature/nombre-de-la-funcionalidad`
  - `fix/nombre-del-bug`
  - `chore/tarea-de-mantenimiento`
  - `docs/actualizacion-de-documentacion`
  - `refactor/nombre-del-refactor`

### Mensajes de commit

- Redactar el mensaje de commit en inglés.
- Seguir la regla 50/72: título (primera línea) de máximo 50 caracteres, línea en blanco, y cuerpo con líneas envueltas a máximo 72 caracteres.
- En el cuerpo, no dejar línea en blanco entre oraciones: el cuerpo va como uno o varios párrafos de prosa continua (sin una oración por línea separada por saltos).
- Nunca incluirse a sí mismo (Claude) como coautor: no agregar líneas `Co-Authored-By` que referencien a Claude o Anthropic.

### Hook de commit

- El repo incluye `.githooks/commit-msg`, que elimina los trailers `Co-Authored-By` que mencionan a Claude o Anthropic (los coautores humanos se conservan). Se activa una vez por clon con `git config core.hooksPath .githooks`.

## Pull requests

- Redactar título y descripción del PR en inglés.
- Título: mismo estilo que el título de commit (imperativo, máximo ~50-70 caracteres, sin punto final), por ejemplo `Add user authentication endpoints`.
- La rama de origen sigue la convención `<tipo>/<descripcion-corta-en-kebab-case>`.
- Un PR por cambio lógico; si mezcla temas no relacionados, proponer dividirlo.
- Descripción con esta estructura:

  ```markdown
  ## Summary
  What changes and why, in 1-3 sentences of prose.

  ## Changes
  - Bullet list of the relevant changes, grouped by area (backend / frontend / tooling).

  ## How to test
  1. Concrete steps or commands to verify the change.

  ## Notes
  Breaking changes, migrations, follow-ups or screenshots (omit if empty).
  ```

- Antes de abrir el PR, confirmar que pasan `uv run ruff check` y `uv run ruff format --check` (backend) y `pnpm check` (frontend); mencionarlo en "How to test" si aplica.
- Nunca incluir a Claude como autor ni agregar líneas "Generated with Claude Code" o similares en la descripción.
- No crear ni actualizar PRs sin que el usuario lo pida explícitamente.

## Estilo de documentación

- La documentación del repo (README, docs, docstrings, comentarios) se escribe en inglés, igual que el código.
- Markdown:
  - Un único `#` por archivo (título); secciones con `##` y `###`, sin saltar niveles.
  - Bloques de código siempre con lenguaje (` ```bash `, ` ```python `, ` ```tsx `).
  - Comandos listos para copiar y pegar, indicando el directorio (`cd backend`) cuando importe.
  - Tablas para listados de tecnologías, scripts o variables de entorno; listas para pasos y enumeraciones.
  - Enlazar a la documentación oficial al mencionar una herramienta por primera vez.
  - Prosa concisa: explicar el porqué, no repetir lo que el código ya dice.
- Al agregar o cambiar dependencias, scripts o variables de entorno, actualizar el `README.md` (y `.env.example` si aplica) en el mismo cambio.
- Comentarios en código: solo cuando aportan contexto que no se deduce del código (decisiones, workarounds, enlaces a issues).

## Herramientas

- Backend: lint y formato con [Ruff](https://docs.astral.sh/ruff/) (config en `backend/pyproject.toml`): `uv run ruff check --fix` y `uv run ruff format`.
- Frontend: lint y formato con Biome (`pnpm check`).
- Componentes de UI: usar el MCP de shadcn (configurado en `.mcp.json`) para buscar y agregar componentes en lugar de escribirlos a mano; se instalan en `frontend/src/components/ui`.
