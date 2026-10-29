from datetime import timedelta

from pydantic import EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Fixed, not configurable, and not renewed on use.
SESSION_LIFETIME = timedelta(days=30)
SESSION_COOKIE_NAME = "lumia_session"

# Only the API reads the cookie, so it does not travel with /images/ or the
# static files.
SESSION_COOKIE_PATH = "/api"

PASSWORD_MIN_LENGTH = 8
# bcrypt refuses anything longer instead of truncating it.
PASSWORD_MAX_BYTES = 72


def check_password_limits(password: str) -> str:
    """Shared by every place that accepts a new password: the seed, the CLI."""
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"must be at least {PASSWORD_MIN_LENGTH} characters long")
    if len(password.encode()) > PASSWORD_MAX_BYTES:
        raise ValueError(f"must be at most {PASSWORD_MAX_BYTES} bytes long")
    return password


class AuthSettings(BaseSettings):
    # A rejected password must not be echoed back into the startup log.
    model_config = SettingsConfigDict(hide_input_in_errors=True)

    # Required on purpose, though only the first start uses them: a missing
    # value must stop startup and name the variable, and both profiles then
    # declare the same names.
    admin_email: EmailStr
    admin_password: str

    _check_admin_password = field_validator("admin_password")(check_password_limits)


auth_settings = AuthSettings()
