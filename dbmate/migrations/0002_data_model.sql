-- migrate:up
-- The whole 0.1.0 data model (openspec change add-data-schema). The database
-- itself enforces ownership, vote uniqueness and cascades, so a buggy endpoint
-- cannot leave duplicated, cross-album or orphaned rows. Cascades rely on the
-- backend opening every connection with PRAGMA foreign_keys=ON.

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

-- token_hash is the SHA-256 of the cookie secret; the secret is never stored.
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL
) STRICT;

CREATE INDEX sessions_user_id ON sessions (user_id);

-- RESTRICT, not CASCADE: deleting photo rows does not delete their files, so
-- albums must be removed through the service before their owner can go.
CREATE TABLE albums (
    id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 100),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE INDEX albums_owner_id ON albums (owner_id);

-- The deck order is the upload order, i.e. ordering by id. storage_key names
-- the original at /data/photos/<storage_key>. UNIQUE (id, album_id) is the
-- target of the composite foreign key in ratings.
CREATE TABLE photos (
    id INTEGER PRIMARY KEY,
    album_id INTEGER NOT NULL REFERENCES albums (id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL
        CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id, album_id)
) STRICT;

CREATE INDEX photos_album_id ON photos (album_id);

-- At most one link per album; revoking replaces or deletes the row. The token
-- is kept in clear because the owner needs to see it again to copy the link.
CREATE TABLE share_tokens (
    id INTEGER PRIMARY KEY,
    album_id INTEGER NOT NULL UNIQUE REFERENCES albums (id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

-- Participants hang from the album, not from the link, so revoking the link
-- keeps them and their votes. They never reference users.
CREATE TABLE participants (
    id INTEGER PRIMARY KEY,
    album_id INTEGER NOT NULL REFERENCES albums (id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 50),
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id, album_id)
) STRICT;

CREATE INDEX participants_album_id ON participants (album_id);

-- A missing row means the photo is pending for that participant. The
-- composite foreign keys keep the photo and the participant in the same album.
CREATE TABLE ratings (
    photo_id INTEGER NOT NULL,
    participant_id INTEGER NOT NULL,
    album_id INTEGER NOT NULL,
    approved INTEGER NOT NULL CHECK (approved IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (photo_id, participant_id),
    FOREIGN KEY (photo_id, album_id)
        REFERENCES photos (id, album_id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id, album_id)
        REFERENCES participants (id, album_id) ON DELETE CASCADE
) STRICT;

CREATE INDEX ratings_participant_id ON ratings (participant_id);

-- migrate:down
DROP TABLE ratings;
DROP TABLE participants;
DROP TABLE share_tokens;
DROP TABLE photos;
DROP TABLE albums;
DROP TABLE sessions;
DROP TABLE users;
