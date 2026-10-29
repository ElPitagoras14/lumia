import hashlib
import secrets

import bcrypt

from src.packages.auth.config import PASSWORD_MAX_BYTES


def hash_password(password: str) -> str:
    """Only for a password that already passed `check_password_limits`:
    bcrypt raises on more than 72 bytes instead of truncating."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    encoded = password.encode()
    # Too long to have ever been stored, so it cannot match; bcrypt would
    # raise rather than answer.
    if len(encoded) > PASSWORD_MAX_BYTES:
        return False
    return bcrypt.checkpw(encoded, password_hash.encode())


# Checked against when the email is unknown, so an unknown email costs as
# much time as a wrong password and the response time does not tell the two
# apart. Computed once, at import.
_UNKNOWN_EMAIL_HASH = hash_password("unknown-email")


def spend_password_check_time(password: str) -> None:
    verify_password(password, _UNKNOWN_EMAIL_HASH)


def generate_session_secret() -> str:
    return secrets.token_urlsafe(32)


def hash_session_secret(secret: str) -> str:
    """What the database stores instead of the cookie's value. A fast, unsalted
    hash is enough: the secret has 256 bits of entropy, so it cannot be
    guessed from its hash, unlike a password."""
    return hashlib.sha256(secret.encode()).hexdigest()
