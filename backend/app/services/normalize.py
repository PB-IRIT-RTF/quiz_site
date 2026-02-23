from __future__ import annotations

import re


_FIO_WORD_RE = re.compile(r"^[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*$")


def normalize_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def title_case_ru(s: str) -> str:
    s = normalize_spaces(s)
    out_words: list[str] = []
    for w in s.split(" "):
        parts = w.split("-")
        parts2 = []
        for p in parts:
            if not p:
                parts2.append("")
            else:
                lower = p.lower()
                parts2.append(lower[0].upper() + lower[1:])
        out_words.append("-".join(parts2))
    return " ".join(out_words)


def normalize_fio_raw_to_norm(fio_raw: str) -> str:
    fio = normalize_spaces(fio_raw)
    # 2-4 words
    parts = fio.split(" ") if fio else []
    if len(parts) < 2 or len(parts) > 4:
        raise ValueError("fio must be 2-4 words")
    for p in parts:
        if not _FIO_WORD_RE.match(p):
            raise ValueError("fio contains invalid word")
    return title_case_ru(fio)


def normalize_nickname(nickname_raw: str) -> str:
    nickname = normalize_spaces(nickname_raw)
    if not nickname:
        raise ValueError("nickname required")
    if len(nickname) > 64:
        raise ValueError("nickname too long")
    return nickname


def normalize_group(group_raw: str) -> str:
    g = normalize_spaces(group_raw).upper()
    if not re.match(r"^[А-ЯЁA-Z]{2}-\d{6}$", g):
        raise ValueError("invalid group")
    return g


def normalize_vk_url(vk_raw: str) -> str:
    raw = normalize_spaces(vk_raw)
    if not raw:
        raise ValueError("vk_url required")

    if not raw.startswith("http://") and not raw.startswith("https://"):
        raw = "https://" + raw

    from urllib.parse import urlparse

    u = urlparse(raw)
    if u.netloc != "vk.com":
        raise ValueError("vk domain must be vk.com")

    path = (u.path or "").lstrip("/")
    if not path:
        raise ValueError("vk path required")

    return f"https://vk.com/{path}"


def fio_to_display(fio_norm: str) -> str:
    return normalize_spaces(fio_norm)
