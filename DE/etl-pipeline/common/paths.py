from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from datetime import date

    import duckdb

    from config.settings import RuntimeConfig


def resolve_input_path(
    runtime_config: RuntimeConfig,
    model: str,
    runner: str,
    run_date: date,
) -> str:
    if model not in runtime_config.models:
        raise ValueError(f"Unsupported model '{model}'.")

    model_mapping = runtime_config.models[model]
    template = getattr(model_mapping, runner, None)
    if template is None:
        raise ValueError(f"Unsupported runner '{runner}' for model '{model}'.")

    bronze_root = runtime_config.paths.bronze_root
    resolved_input = template.format(
        bronze_root=bronze_root,
        date=run_date.isoformat(),
        date_compact=run_date.strftime("%Y%m%d"),
    )

    if resolved_input.startswith(("gs://", "gcs://")):
        return resolved_input

    project_root = Path(__file__).resolve().parents[1]
    return str(project_root / resolved_input)


def resolve_input_paths(
    conn: duckdb.DuckDBPyConnection,
    runtime_config: RuntimeConfig,
    model: str,
    runner: str,
    run_date: date,
) -> list[str]:
    resolved_path = resolve_input_path(runtime_config, model, runner, run_date)
    path_pattern = str(resolved_path)

    if path_pattern.startswith(("gs://", "gcs://")):
        rows = conn.execute(
            "SELECT file FROM glob(?) ORDER BY file",
            [path_pattern],
        ).fetchall()
        return [str(row[0]) for row in rows]

    resolved_local_path = Path(path_pattern)
    if any(token in path_pattern for token in ("*", "?", "[")):
        return sorted(str(path) for path in resolved_local_path.parent.glob(resolved_local_path.name))
    if resolved_local_path.exists():
        return [str(resolved_local_path)]
    return []
