"""Administration commands, run with `python -m src.cli <command>`."""

import argparse
import getpass
import sys

from src.database.utils import transaction
from src.exceptions import DatabaseError, NotFoundError, ValidationFailedError
from src.packages.auth import service


def _reset_password(email: str) -> int:
    password = getpass.getpass("New password: ")
    if password != getpass.getpass("Repeat the new password: "):
        print("error: the two passwords do not match", file=sys.stderr)
        return 1

    try:
        with transaction() as connection:
            service.reset_password(connection, email, password)
    except ValidationFailedError as exc:
        print(f"error: the password {exc.message}", file=sys.stderr)
        return 1
    except NotFoundError:
        print(f"error: no user has the email {email}", file=sys.stderr)
        return 1
    except DatabaseError:
        print("error: the database could not be reached", file=sys.stderr)
        return 1

    print("Password changed. Every open session of that user was closed.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m src.cli")
    commands = parser.add_subparsers(dest="command", required=True)

    reset = commands.add_parser(
        "reset-password", help="set a new password for an existing user"
    )
    reset.add_argument("email", help="the email of the user")

    args = parser.parse_args(argv)
    return _reset_password(args.email)


if __name__ == "__main__":
    sys.exit(main())
