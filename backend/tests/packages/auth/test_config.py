import pytest
from pydantic import ValidationError

from src.packages.auth.config import AuthSettings


def _settings(**overrides) -> AuthSettings:
    values = {"admin_email": "owner@example.com", "admin_password": "long-enough"}
    return AuthSettings(**{**values, **overrides})


def test_valid_settings_are_accepted():
    settings = _settings()

    assert settings.admin_email == "owner@example.com"
    assert settings.admin_password == "long-enough"


@pytest.mark.parametrize("variable", ["ADMIN_EMAIL", "ADMIN_PASSWORD"])
def test_a_missing_variable_fails_and_names_it(monkeypatch, variable):
    monkeypatch.setenv("ADMIN_EMAIL", "owner@example.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "long-enough")
    monkeypatch.delenv(variable)

    with pytest.raises(ValidationError) as error:
        AuthSettings()

    assert variable.lower() in str(error.value)


def test_variables_are_read_from_the_environment(monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "ana@example.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "from-the-env")

    settings = AuthSettings()

    assert settings.admin_email == "ana@example.com"
    assert settings.admin_password == "from-the-env"


def test_a_malformed_email_fails_and_names_the_variable():
    with pytest.raises(ValidationError) as error:
        _settings(admin_email="not-an-email")

    assert "admin_email" in str(error.value)


def test_a_password_of_8_characters_is_accepted():
    assert _settings(admin_password="12345678").admin_password == "12345678"


def test_a_password_of_7_characters_fails_and_names_the_variable():
    with pytest.raises(ValidationError) as error:
        _settings(admin_password="1234567")

    assert "admin_password" in str(error.value)


def test_a_password_of_72_bytes_is_accepted():
    assert len(_settings(admin_password="a" * 72).admin_password) == 72


def test_a_password_of_73_bytes_fails_and_names_the_variable():
    with pytest.raises(ValidationError) as error:
        _settings(admin_password="a" * 73)

    assert "admin_password" in str(error.value)


def test_the_limit_counts_bytes_not_characters():
    # 40 two-byte characters are 80 bytes: few characters, too many bytes.
    with pytest.raises(ValidationError):
        _settings(admin_password="é" * 40)
