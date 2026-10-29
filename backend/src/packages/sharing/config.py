from datetime import timedelta

# Per album, so one browser can be a participant of several albums and
# revoking a link never changes which cookie identifies someone.
PARTICIPANT_COOKIE_PREFIX = "lumia_guest_"

# The longest a browser keeps a cookie today.
PARTICIPANT_COOKIE_LIFETIME = timedelta(days=400)

# Same path as the owner's session cookie: only the API reads it.
PARTICIPANT_COOKIE_PATH = "/api"

# 128 bits, 22 URL-safe characters.
SHARE_TOKEN_BYTES = 16


def participant_cookie_name(album_id: int) -> str:
    return f"{PARTICIPANT_COOKIE_PREFIX}{album_id}"
