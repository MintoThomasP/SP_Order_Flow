"""
Symmetric Authenticated Encryption Helper (Encrypt-then-MAC using stdlib SHA-256 + HMAC-SHA256).
Used to store per-channel Test and Production API keys encrypted at rest so authorized admins
can optionally embed them in partner API integration PDFs without adding external dependencies.
"""
import base64
import hashlib
import hmac
import secrets
from django.conf import settings


def _derive_keys(salt: bytes) -> tuple[bytes, bytes]:
    secret = (getattr(settings, "SECRET_KEY", "") or "silverpoint-fallback-key").encode("utf-8")
    enc_key = hashlib.sha256(b"sp-enc-v1:" + secret + b":" + salt).digest()
    mac_key = hashlib.sha256(b"sp-mac-v1:" + secret + b":" + salt).digest()
    return enc_key, mac_key


def _keystream(enc_key: bytes, nonce: bytes, length: int) -> bytes:
    blocks = []
    counter = 0
    total = 0
    while total < length:
        block = hashlib.sha256(enc_key + nonce + counter.to_bytes(4, "big")).digest()
        blocks.append(block)
        total += len(block)
        counter += 1
    return b"".join(blocks)[:length]


def encrypt_provider_key(plaintext: str) -> str:
    if not plaintext:
        return ""
    nonce = secrets.token_bytes(16)
    enc_key, mac_key = _derive_keys(nonce)
    raw = plaintext.encode("utf-8")
    stream = _keystream(enc_key, nonce, len(raw))
    cipher = bytes(a ^ b for a, b in zip(raw, stream))
    tag = hmac.new(mac_key, nonce + cipher, hashlib.sha256).digest()
    token = base64.urlsafe_b64encode(nonce + cipher + tag).decode("ascii")
    return f"enc_v1:{token}"


def decrypt_provider_key(stored_value: str) -> str:
    if not stored_value or not stored_value.startswith("enc_v1:"):
        return ""
    try:
        blob = base64.urlsafe_b64decode(stored_value[7:].encode("ascii"))
        if len(blob) < 48:
            return ""
        nonce = blob[:16]
        tag = blob[-32:]
        cipher = blob[16:-32]
        enc_key, mac_key = _derive_keys(nonce)
        expected_tag = hmac.new(mac_key, nonce + cipher, hashlib.sha256).digest()
        if not hmac.compare_digest(tag, expected_tag):
            return ""
        stream = _keystream(enc_key, nonce, len(cipher))
        raw = bytes(a ^ b for a, b in zip(cipher, stream))
        return raw.decode("utf-8")
    except Exception:
        return ""

