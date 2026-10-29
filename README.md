# Lumia

Lumia lets an owner upload photos to an album, share it through a link, and see which photos the people who open that link like. Guests vote by swiping, without creating an account. Everything runs locally with Docker Compose, without third-party accounts or keys.

> License: [MIT](./LICENSE).

## Structure

```
lumia/
├── backend/     # FastAPI API on SQLite, managed with uv
├── dbmate/      # SQL migrations and the image that applies them
├── frontend/    # React SPA with TanStack Router/Query and Vite
├── nginx/       # Entry point: routes /api, /images and the SPA
├── compose.yaml
└── VERSION      # Project version
```

## Run with Docker Compose

```bash
cp .env.example .env
# fill IMAGE_SIGNING_KEY and IMAGE_SIGNING_SALT, e.g.:
python -c "import secrets; print(secrets.token_hex(32))"
# and ADMIN_EMAIL and ADMIN_PASSWORD: the owner account (see "Owner account")
docker compose up --build
```

The app is served at `http://localhost:8080` (or the `HTTP_PORT` you set).

| Service       | Role                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- |
| `nginx`       | The only service with a host port. Routes `/api` to the backend, `/images/` to imgproxy (cached) and the rest to the frontend |
| `frontend`    | Serves the built SPA with its own nginx                                                      |
| `migrate`     | Applies pending [dbmate](https://github.com/amacneil/dbmate) migrations and exits; the backend starts only after it succeeds |
| `backend`     | FastAPI API on SQLite (`/data/lumia.db`)                                                      |
| `transformer` | [imgproxy](https://imgproxy.net/): serves signed image variants from `/data`, read-only      |

Data (`lumia.db` and the photo originals) lives in the `lumia-data` volume. `docker compose down -v` deletes it.

### Environment variables

| Variable             | Used by                 | Description                                                    |
| -------------------- | ----------------------- | -------------------------------------------------------------- |
| `HTTP_PORT`          | `nginx`                 | Host port where the app is served                              |
| `DATA_DIR`           | `backend`               | Directory with `lumia.db` and the originals (`/data` in containers, `./data` natively) |
| `IMAGE_SIGNING_KEY`  | `transformer`           | Hex key for imgproxy URL signatures                            |
| `IMAGE_SIGNING_SALT` | `transformer`           | Hex salt for imgproxy URL signatures                           |
| `ADMIN_EMAIL`        | `backend`               | Email of the owner account, created on the first start         |
| `ADMIN_PASSWORD`     | `backend`               | Password of the owner account, 8 characters to 72 bytes        |

## Migrations

Migrations are plain SQL files in `dbmate/migrations/`, named `NNNN_description.sql` with a four-digit sequential number, each with a `-- migrate:up` and a `-- migrate:down` section. They are baked into the `migrate` image, so after adding one rebuild it:

```bash
docker compose up --build migrate      # or the whole stack
docker compose run --rm migrate        # migrate without starting the API
```

dbmate is pinned to `ghcr.io/amacneil/dbmate:2.35.1` in `dbmate/Dockerfile`, `backend/tests/migrate.py` and this README; change all three together (`grep -rn "amacneil/dbmate"`).

## Data model

The schema lives in `dbmate/migrations/0002_data_model.sql`.

| Table          | Purpose                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| `users`        | Album owners (a single seeded account in 0.1.0, multi-user ready)       |
| `sessions`     | Owner login sessions, with expiry                                       |
| `albums`       | Albums, each owned by one user                                          |
| `photos`       | Uploaded photos; `storage_key` names the original in `/data/photos/`    |
| `share_tokens` | The album's share link, at most one per album                           |
| `participants` | Guests who opened the link and entered a name; they belong to the album |
| `ratings`      | One vote per photo and participant; a missing row means pending         |

The database enforces these rules itself, so they hold even if an endpoint is wrong:

- A vote's photo and participant always belong to the same album, and a pair has at most one vote.
- Deleting an album removes its photos, link, participants and votes; deleting a photo or a participant removes their votes. A user with albums cannot be deleted, because rows would go while their files stay on disk.
- Revoking the share link does not touch participants or their votes.
- Cookie secrets are stored only as SHA-256 hashes (`token_hash`), never in clear.

## Owner account

The backend creates the owner from `ADMIN_EMAIL` and `ADMIN_PASSWORD` on its first start, and only while there are no users. After that it never touches the account: changing `ADMIN_PASSWORD` in `.env` does not change the password, but the variable must stay set or the backend will not start. Once you have signed in, you can replace the real password in `.env` with any placeholder that meets the length limits.

The email has to be valid for the [email-validator](https://pypi.org/project/email-validator/) library, which rejects reserved domains such as `.local`, `.test` and `localhost`. Use something like `owner@example.com`.

To set a new password (for instance, if you forgot it), run the command below. It asks for the password twice without showing it, and signs the owner out everywhere:

```bash
docker compose exec backend python -m src.cli reset-password owner@example.com
# native mode, from backend/ (with DATA_DIR and the ADMIN_* variables set)
uv run python -m src.cli reset-password owner@example.com
```

A session lasts 30 days from signing in and is not renewed by use. The session cookie is `HttpOnly` and `SameSite=Lax`, and it has no `Secure` flag because 0.1.0 is served over plain HTTP; that flag will be needed if you put it behind HTTPS.

## Native mode

Run the backend and the frontend on the host, with the same variable names as in containers. Only `DATA_DIR` changes. Images are not served in this mode, because imgproxy runs only in Docker.

1. Apply the migrations from the repository root. Docker is needed for this step only.

   ```powershell
   # PowerShell
   docker run --rm -v "${PWD}/dbmate:/db:ro" -v "${PWD}/backend/data:/data" -e DATABASE_URL=sqlite:/data/lumia.db ghcr.io/amacneil/dbmate:2.35.1 --no-dump-schema up
   ```

   ```bash
   # bash (Linux/macOS). In Git Bash, prefix MSYS_NO_PATHCONV=1 and use $(pwd -W)
   docker run --rm -v "$(pwd)/dbmate:/db:ro" -v "$(pwd)/backend/data:/data" \
     -e DATABASE_URL=sqlite:/data/lumia.db \
     ghcr.io/amacneil/dbmate:2.35.1 --no-dump-schema up
   ```

2. Start the backend on `http://localhost:8000`:

   ```powershell
   cd backend
   $env:DATA_DIR = "./data"   # bash: export DATA_DIR=./data
   $env:ADMIN_EMAIL = "owner@example.com"      # bash: export ADMIN_EMAIL=...
   $env:ADMIN_PASSWORD = "choose-a-password"   # bash: export ADMIN_PASSWORD=...
   uv run fastapi dev src/main.py
   ```

3. Start the frontend on `http://localhost:3000`. It forwards `/api` to the backend:

   ```bash
   cd frontend
   pnpm dev
   ```

## Backend (`backend/`)

| Category           | Technology                                     |
| ------------------- | ----------------------------------------------- |
| Language / runtime   | Python >= 3.13                                 |
| Package manager      | [uv](https://docs.astral.sh/uv/)               |
| Web framework        | [FastAPI](https://fastapi.tiangolo.com/) (`standard` extra, includes Uvicorn) |
| Database access      | [SQLAlchemy](https://www.sqlalchemy.org/) Core (plain SQL, no ORM) on SQLite (WAL mode, foreign keys on) |
| Validation / config  | [Pydantic](https://docs.pydantic.dev/) + [pydantic-settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) |
| Logging              | [loguru](https://github.com/Delgan/loguru)     |
| Security             | [bcrypt](https://pypi.org/project/bcrypt/) (password hashing) |
| Environment config   | [python-dotenv](https://pypi.org/project/python-dotenv/) |
| Lint / format        | [Ruff](https://docs.astral.sh/ruff/) (dev dependency, configured in `pyproject.toml`) |

### Layout

Shared infrastructure sits in `backend/src/`, and each domain is a package under `backend/src/packages/<domain>/` with its own `router`, `service` (the rules), `repository` (the only place with SQL), `schemas`, `responses` and `dependencies`. `src/routes.py` mounts every package router under `/api`.

| Module                  | Role                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `src/database/`         | Engine, query helpers (`fetch_one`, `fetch_all`, `write`, ...) and the per-request transaction |
| `src/responses.py`      | `Envelope`: every body is `{"data": ..., "error": null}` or `{"data": null, "error": {...}}` |
| `src/handlers.py`       | Maps each exception to a status and a stable error `code`; unforeseen failures return a `requestId` that is also in the log |
| `src/packages/auth/`    | Owner sign-in, sessions and the `current_user` dependency every owner route uses   |

Fields are `snake_case` in Python and `camelCase` in JSON. Services raise the exceptions in `src/exceptions.py`, never `HTTPException`. Each request runs in one transaction that commits before the response is sent, so a service never calls `commit()`.

### Setup

```bash
cd backend
uv sync              # creates the venv and installs dependencies from uv.lock
DATA_DIR=./data uv run fastapi dev src/main.py   # development server (see Native mode)
```

### Tests

```bash
cd backend
uv run pytest       # needs Docker: the test schema is built by the dbmate image
```

### Lint and format

```bash
cd backend
uv run ruff check          # lint
uv run ruff check --fix    # lint and apply safe fixes
uv run ruff format         # format
```

### Upgrade dependencies to the latest version

```bash
cd backend
uv lock --upgrade    # recomputes uv.lock with the latest allowed versions
uv sync              # installs whatever ended up in the updated lockfile

# upgrade uv itself
uv self update
```

## Frontend (`frontend/`)

| Category            | Technology                                                       |
| -------------------- | ------------------------------------------------------------------ |
| Language / runtime    | TypeScript, Node.js                                              |
| Package manager       | [pnpm](https://pnpm.io/)                                         |
| Build tool            | [Vite](https://vite.dev/)                                        |
| UI library            | [React 19](https://react.dev/)                                   |
| Routing               | [TanStack Router](https://tanstack.com/router) (+ devtools, route generation via `tsr`) |
| Data fetching / cache | [TanStack Query](https://tanstack.com/query) (+ devtools)        |
| Styling               | [Tailwind CSS v4](https://tailwindcss.com/) + [tw-animate-css](https://www.npmjs.com/package/tw-animate-css) |
| UI components         | [shadcn](https://ui.shadcn.com/) on top of [Radix UI](https://www.radix-ui.com/) |
| Icons                 | [lucide-react](https://lucide.dev/)                               |
| UI utilities          | class-variance-authority, clsx, tailwind-merge                   |
| Data validation       | [Zod](https://zod.dev/)                                           |
| HTTP client           | [axios](https://axios-http.com/)                                  |
| Typography            | [@fontsource-variable/inter](https://fontsource.org/fonts/inter)  |
| Lint / format         | [Biome](https://biomejs.dev/)                                     |

### Setup

```bash
cd frontend
pnpm install
pnpm dev              # http://localhost:3000
```

### Available scripts

| Script                | Description                              |
| ---------------------- | ------------------------------------------ |
| `pnpm dev`              | starts the development server (Vite)      |
| `pnpm build`            | production build                          |
| `pnpm preview`          | serves the production build locally       |
| `pnpm generate-routes`  | regenerates TanStack Router routes (`tsr generate`) |
| `pnpm format`           | formats the code with Biome               |
| `pnpm lint`             | runs the linter (Biome)                   |
| `pnpm check`            | lint + format check with Biome            |

### Upgrade dependencies to the latest version

```bash
cd frontend
pnpm update --latest   # updates package.json and pnpm-lock.yaml to the latest versions
pnpm install            # makes sure node_modules stays in sync

# upgrade pnpm itself
corepack use pnpm@latest
# or, if you don't use corepack:
npm install -g pnpm@latest
```

> Note: `latest` in `@tanstack/react-devtools`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/devtools-vite`, and `@tanstack/router-plugin` always resolves to the most recently published version; `pnpm update --latest` still revalidates them along with everything else.

## Git hooks

The repo ships a `commit-msg` hook in `.githooks/` that strips `Co-Authored-By` trailers referencing Claude or Anthropic (human co-authors are kept). Enable it once per clone:

```bash
git config core.hooksPath .githooks
```

## Claude Code

| File                    | Purpose                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `CLAUDE.md`             | Project instructions: language, git, PR and documentation conventions   |
| `.mcp.json`             | MCP servers shared with the team ([shadcn MCP](https://ui.shadcn.com/docs/mcp)) |
| `.claude/settings.json` | Shared settings: enabled MCP servers, permission allowlist, no AI attribution in commits/PRs |

Personal overrides go in `.claude/settings.local.json` (git-ignored).
