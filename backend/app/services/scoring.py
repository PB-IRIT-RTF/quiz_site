from __future__ import annotations

import re
from typing import Any

from app.models.enums import QuestionType, TextMatchType
from app.models.models import Option, Question, TextAnswerRule


def normalize_text_answer(s: str) -> str:
    return (s or "").strip().lower()


def score_single(question: Question, chosen_option_ids: set[int]) -> tuple[bool, int]:
    correct = next((o.id for o in question.options if o.is_correct), None)
    is_correct = correct is not None and len(chosen_option_ids) == 1 and correct in chosen_option_ids
    return is_correct, question.points if is_correct else 0


def score_multi_all_or_nothing(question: Question, chosen_option_ids: set[int]) -> tuple[bool, int]:
    correct = {o.id for o in question.options if o.is_correct}
    is_correct = chosen_option_ids == correct
    return is_correct, question.points if is_correct else 0


def score_text(question: Question, text_rules: list[TextAnswerRule], text_value: str) -> tuple[bool, int]:
    text = normalize_text_answer(text_value)
    for r in sorted(text_rules, key=lambda x: x.sort_order):
        if r.match_type == TextMatchType.exact:
            if text == r.pattern:
                return True, question.points
        else:
            try:
                if re.search(r.pattern, text):
                    return True, question.points
            except re.error:
                continue
    return False, 0


def score_answer(
    question: Question,
    text_rules: list[TextAnswerRule],
    payload: dict[str, Any],
) -> tuple[bool, int]:
    if question.type == QuestionType.single:
        chosen = set(map(int, payload.get("option_ids") or []))
        return score_single(question, chosen)

    if question.type == QuestionType.multi:
        chosen = set(map(int, payload.get("option_ids") or []))
        return score_multi_all_or_nothing(question, chosen)

    # text
    return score_text(question, text_rules, str(payload.get("text") or ""))
