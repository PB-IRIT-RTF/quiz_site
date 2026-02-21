from __future__ import annotations

import base64
import hashlib
import hmac
import os

# Важно для Windows/Python 3.13:
# passlib+bcrypt часто ломается из-за несовместимостей wheels/версий.
# Чтобы backend стартовал стабильно без нативных зависимостей — используем PBKDF2-SHA256
# из стандартной библиотеки Python.

_PBKDF2_ALG = "pbkdf2_sha256"
_PBKDF2_ITERATIONS = 260_000
_SALT_BYTES = 16
_DK_LEN = 32


def _b64e(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode("ascii").rstrip("=")


def _b64d(s: str) -> bytes:
    pad = "=" * ((4 - (len(s) % 4)) % 4)
    return base64.urlsafe_b64decode((s + pad).encode("ascii"))


def hash_password(password: str) -> str:
    if password is None:
        raise ValueError("password is required")

    salt = os.urandom(_SALT_BYTES)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        _PBKDF2_ITERATIONS,
        dklen=_DK_LEN,
    )
    # format: pbkdf2_sha256$<iterations>$<salt_b64>$<hash_b64>
    return f"{_PBKDF2_ALG}${_PBKDF2_ITERATIONS}${_b64e(salt)}${_b64e(dk)}"


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        alg, iters_s, salt_b64, hash_b64 = password_hash.split("$", 3)
        if alg != _PBKDF2_ALG:
            return False
        iters = int(iters_s)
        salt = _b64d(salt_b64)
        expected = _b64d(hash_b64)
    except Exception:
        return False

    dk = hashlib.pbkdf2_hmac(
        "sha256",
        (plain_password or "").encode("utf-8"),
        salt,
        iters,
        dklen=len(expected),
    )
    return hmac.compare_digest(dk, expected)
