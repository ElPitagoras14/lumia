FROM python:3.13.15-slim

COPY --from=ghcr.io/astral-sh/uv:0.10.9 /uv /uvx /bin/

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

# Dependencies first, so this layer only rebuilds when pyproject.toml or
# uv.lock change, not on every code edit.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY src ./src
RUN uv sync --locked --no-dev

EXPOSE 8000

# A single worker on purpose: SQLite has one writer, and more processes would
# only contend for it.
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
