from src.models import ApiModel
from src.packages.auth.schemas import UserRecord


class CurrentUserResponse(ApiModel):
    """What `/auth/me` and the login describe: the person's own descriptive
    data, and deliberately nothing about the session that authenticated the
    request -- no secret, no hash.
    """

    id: int
    email: str

    @classmethod
    def from_record(cls, user: UserRecord) -> "CurrentUserResponse":
        return cls(id=user.id, email=user.email)
