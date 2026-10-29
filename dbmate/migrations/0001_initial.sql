-- migrate:up
-- Starting point of the schema. Creates nothing on purpose: each domain table
-- arrives with the change that first uses it, in its own numbered migration.

-- migrate:down
-- Intentionally empty: rolling back the starting point has nothing to undo.
