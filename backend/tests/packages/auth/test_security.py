import hashlib

from src.packages.auth.security import (
    generate_session_secret,
    hash_password,
    hash_session_secret,
    spend_password_check_time,
    verify_password,
)


def test_a_hash_verifies_its_password_and_rejects_another():
    password_hash = hash_password("correct horse")

    assert verify_password("correct horse", password_hash)
    assert not verify_password("wrong horse", password_hash)


def test_the_hash_does_not_contain_the_password():
    assert "correct horse" not in hash_password("correct horse")


def test_the_same_password_hashes_differently_each_time():
    assert hash_password("correct horse") != hash_password("correct horse")


def test_a_password_over_72_bytes_is_rejected_instead_of_raising():
    password_hash = hash_password("a" * 72)

    assert not verify_password("a" * 73, password_hash)


def test_spending_the_check_time_for_an_unknown_email_returns_nothing():
    assert spend_password_check_time("anything") is None


def test_two_session_secrets_differ():
    assert generate_session_secret() != generate_session_secret()


def test_a_session_secret_has_256_bits_of_entropy():
    # token_urlsafe(32) encodes 32 random bytes in 43 characters.
    assert len(generate_session_secret()) == 43


def test_the_stored_hash_of_a_secret_is_its_sha256_and_not_the_secret():
    secret = generate_session_secret()

    stored = hash_session_secret(secret)

    assert stored == hashlib.sha256(secret.encode()).hexdigest()
    assert len(stored) == 64
    assert stored != secret
