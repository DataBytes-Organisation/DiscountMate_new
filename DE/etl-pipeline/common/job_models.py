from __future__ import annotations

from typing import TypedDict


class JobSummary(TypedDict):
    processed_dates: str
    skipped_dates: str
    counts: dict[str, int]
