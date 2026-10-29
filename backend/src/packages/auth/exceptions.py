class InvalidCredentialsError(Exception):
    """The email is unknown or the password does not match; the two are
    indistinguishable on purpose."""
