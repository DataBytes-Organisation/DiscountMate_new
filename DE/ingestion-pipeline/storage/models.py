from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class MaterializedArtifacts:
    run_dir: Path
    jsonl_path: Path
    csv_path: Path
    manifest_path: Path
    manifest: dict[str, object]
    uploaded_uris: list[str] = field(default_factory=list)
