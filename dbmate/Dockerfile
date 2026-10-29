# Bakes the migrations into the dbmate image, so whatever applies them (the
# `migrate` service, or a deployment with prebuilt images) does not need the
# repository on the machine that runs it. /db is dbmate's default directory,
# so DBMATE_MIGRATIONS_DIR does not need to be set.
#
# The version is pinned and must stay identical everywhere it appears
# (`grep -rn "amacneil/dbmate"`): here, backend/tests/conftest.py and
# README.md.
FROM ghcr.io/amacneil/dbmate:2.35.1

COPY migrations /db/migrations

# No ENTRYPOINT or CMD: the base image's are inherited, so the compose
# `command` passes dbmate's arguments directly.
