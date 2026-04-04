from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from datetime import date

    from config.settings import RuntimeConfig


def resolve_input_path(
    runtime_config: RuntimeConfig,
    model: str,
    runner: str,
    run_date: date,
) -> Path:
    if model not in runtime_config.models:
        raise ValueError(f"Unsupported model '{model}'.")

    model_mapping = runtime_config.models[model]
    template = getattr(model_mapping, runner, None)
    if template is None:
        raise ValueError(f"Unsupported runner '{runner}' for model '{model}'.")

    bronze_root = runtime_config.paths.bronze_root
    relative_path = template.format(
        bronze_root=bronze_root,
        date=run_date.isoformat(),
        date_compact=run_date.strftime("%Y%m%d"),
    )

    project_root = Path(__file__).resolve().parents[1]
    return project_root / relative_path
