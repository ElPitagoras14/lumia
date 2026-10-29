"""Internal data shapes and request bodies of the auth package. What crosses
the API boundary in a response is declared in responses.py instead.
"""

from pydantic import BaseModel

from src.models import ApiModel


class UserRecord(BaseModel):
    id: int
    email: str


class CredentialsRecord(UserRecord):
    """A user together with the hash the login compares against. Only the
    login path reads it, so `UserRecord`, which circulates everywhere else,
    never carries the hash."""

    password_hash: str


class LoginRequest(ApiModel):
    # Plain strings on purpose: a malformed email or a password of the wrong
    # length is not told apart from wrong credentials, so the response does
    # not reveal what the account policy is.
    email: str
    password: str
