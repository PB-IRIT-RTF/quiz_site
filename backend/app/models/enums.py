from __future__ import annotations

import enum


class AttemptStatus(str, enum.Enum):
    registered = "registered"
    in_progress = "in_progress"
    finished = "finished"
    forced_finished = "forced_finished"


class QuestionType(str, enum.Enum):
    single = "single"
    multi = "multi"
    text = "text"


class TextMatchType(str, enum.Enum):
    exact = "exact"
    regex = "regex"


class MediaKind(str, enum.Enum):
    image = "image"
    audio = "audio"
    video = "video"
    embed = "embed"


class MediaSourceType(str, enum.Enum):
    upload = "upload"
    url = "url"
