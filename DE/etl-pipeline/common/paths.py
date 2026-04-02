from __future__ import annotations

from pathlib import Path

from common.cli import validate_date
from config.settings import RuntimeConfig


def resolve_input_path(
    runtime_config: RuntimeConfig,
    source: str,
    runner: str,
    date_value: str,
) -> Path:
    if source not in runtime_config.sources:
        raise ValueError(f"Unsupported source '{source}'.")

    source_mapping = runtime_config.sources[source]
    template = getattr(source_mapping, runner, None)
    if template is None:
        raise ValueError(f"Unsupported runner '{runner}' for source '{source}'.")

    date_iso, date_compact = validate_date(date_value)
    bronze_root = runtime_config.paths.bronze_root
    relative_path = template.format(
        bronze_root=bronze_root,
        date=date_iso,
        date_compact=date_compact,
    )

    project_root = Path(__file__).resolve().parents[1]
    path = project_root / relative_path
    if not path.exists():
        raise FileNotFoundError(f"Input file not found: {path}")
    return path
