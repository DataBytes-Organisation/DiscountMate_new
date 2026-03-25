from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class RunResult:
    records: list[dict[str, Any]]
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class RunContext:
    source: str
    runner: str
    run_id: str
    repo_root: Path
    settings: Any
    logger: Any
    tracer: Any
