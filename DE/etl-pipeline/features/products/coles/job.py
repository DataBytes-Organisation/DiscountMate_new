from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from common.job_models import JobSummary
    from config.settings import AppSettings, RuntimeConfig


def run(
    model: str,
    runner: str,
    start_date: str,
    runtime_config: RuntimeConfig,
    settings: AppSettings,
) -> JobSummary:
    del model, runner, start_date, runtime_config, settings
    raise NotImplementedError(
        "The Coles products job is scaffold-only for now. Use `--model example` to run the working demo workflow."
    )
