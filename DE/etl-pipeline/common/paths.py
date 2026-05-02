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


def _format_runtime_path(
    runtime_config: RuntimeConfig,
    template: str,
    run_date: date,
) -> Path:
    bronze_root = runtime_config.paths.bronze_root
    relative_path = template.format(
        bronze_root=bronze_root,
        date=run_date.isoformat(),
        date_compact=run_date.strftime("%Y%m%d"),
    )

    project_root = Path(__file__).resolve().parents[1]
    candidate = Path(relative_path)
    return candidate if candidate.is_absolute() else project_root / candidate


def resolve_model_path(
    runtime_config: RuntimeConfig,
    model: str,
    key: str,
    run_date: date,
) -> Path:
    if model not in runtime_config.models:
        raise ValueError(f"Unsupported model '{model}'.")

    model_mapping = runtime_config.models[model]
    template = getattr(model_mapping, key, None)
    if template is None:
        raise ValueError(f"Missing runtime path '{key}' for model '{model}'.")

    return _format_runtime_path(runtime_config, template, run_date)


def resolve_input_path_with_glob(
    runtime_config: RuntimeConfig,
    model: str,
    runner: str,
    glob_key: str,
    run_date: date,
) -> Path:
    exact_path = resolve_model_path(runtime_config, model, runner, run_date)
    if exact_path.exists():
        return exact_path

    model_mapping = runtime_config.models[model]
    glob_template = getattr(model_mapping, glob_key, None)
    if glob_template is None:
        return exact_path

    glob_path = _format_runtime_path(runtime_config, glob_template, run_date)
    matches = sorted(glob_path.parent.glob(glob_path.name))
    if matches:
        return max(matches, key=lambda path: path.name)

    return exact_path
