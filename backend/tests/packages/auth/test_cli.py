from contextlib import contextmanager

import pytest

from src import cli
from src.exceptions import DatabaseUnavailableError
from src.packages.auth import service
from src.packages.auth.exceptions import InvalidCredentialsError
from tests.packages.auth.conftest import PASSWORD


@pytest.fixture
def run(conn, monkeypatch):
    """Runs the command on the test's own connection, typing the given
    answers at the two password prompts."""

    @contextmanager
    def on_the_test_connection():
        yield conn

    monkeypatch.setattr(cli, "transaction", on_the_test_connection)

    def run(email: str, *answers: str) -> int:
        typed = iter(answers)
        monkeypatch.setattr(cli.getpass, "getpass", lambda prompt: next(typed))
        return cli.main(["reset-password", email])

    return run


def test_reset_password_sets_the_new_one_and_closes_the_sessions(
    run, conn, make_user, capsys
):
    make_user()
    _, secret = service.login(conn, "ana@example.com", PASSWORD)

    status = run("ana@example.com", "a-new-password", "a-new-password")

    assert status == 0
    assert service.resolve_session(conn, secret) is None
    service.login(conn, "ana@example.com", "a-new-password")
    with pytest.raises(InvalidCredentialsError):
        service.login(conn, "ana@example.com", PASSWORD)


def test_an_unknown_email_fails_and_changes_nothing(run, conn, make_user, capsys):
    make_user()

    status = run("nobody@example.com", "a-new-password", "a-new-password")

    assert status == 1
    assert "nobody@example.com" in capsys.readouterr().err
    service.login(conn, "ana@example.com", PASSWORD)


def test_two_different_entries_fail_and_keep_the_old_password(
    run, conn, make_user, capsys
):
    make_user()

    status = run("ana@example.com", "a-new-password", "another-password")

    assert status == 1
    assert "do not match" in capsys.readouterr().err
    service.login(conn, "ana@example.com", PASSWORD)


def test_a_password_of_7_characters_fails_and_keeps_the_old_password(
    run, conn, make_user, capsys
):
    make_user()

    status = run("ana@example.com", "1234567", "1234567")

    assert status == 1
    assert "at least 8 characters" in capsys.readouterr().err
    service.login(conn, "ana@example.com", PASSWORD)


def test_an_unreachable_database_fails_with_a_message(run, monkeypatch, capsys):
    @contextmanager
    def unreachable():
        raise DatabaseUnavailableError("could not reach the database")
        yield

    monkeypatch.setattr(cli, "transaction", unreachable)

    status = run("ana@example.com", "a-new-password", "a-new-password")

    assert status == 1
    assert "database" in capsys.readouterr().err
