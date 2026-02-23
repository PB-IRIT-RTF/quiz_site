from __future__ import annotations

from urllib.parse import urlparse

from app.core.config import settings
from app.models.enums import MediaKind


_BLOCKED_EMBED_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
}


def _embed_allowlist() -> set[str]:
    return {h.strip().lower() for h in (settings.embed_allowed_hosts or "").split(",") if h.strip()}


def validate_media_url(kind: MediaKind, raw_url: str) -> str:
    url = (raw_url or "").strip()
    if not url:
        raise ValueError("media_url_required")

    try:
        parsed = urlparse(url)
    except Exception:
        raise ValueError("media_url_invalid")

    scheme = (parsed.scheme or "").lower()
    host = (parsed.hostname or "").lower()

    if scheme not in {"http", "https"}:
        raise ValueError("media_url_scheme_not_allowed")
    if not host:
        raise ValueError("media_url_host_required")
    if parsed.username or parsed.password:
        raise ValueError("media_url_credentials_not_allowed")

    if kind == MediaKind.embed:
        if scheme != "https":
            raise ValueError("embed_requires_https")
        if host in _BLOCKED_EMBED_HOSTS:
            raise ValueError("embed_host_blocked")

        allowlist = _embed_allowlist()
        if allowlist and host not in allowlist:
            raise ValueError("embed_host_not_allowed")

    return url
