from __future__ import annotations

from collections.abc import Callable

from common.cli import parse_args
from common.job_models import JobSummary
from config import load_runtime_config, load_settings
from features.feature_examples.job import run as run_example
from features.products.aldi.job import run as run_aldi
from features.products.coles.job import run as run_coles
from features.products.iga.job import run as run_iga
from features.products.woolworths.job import run as run_woolworths

JobRunner = Callable[..., JobSummary]


def resolve_job(model: str, runner: str) -> JobRunner:
    if runner != "products":
        raise ValueError("Phase 1 supports only runner='products'.")

    if model == "example":
        return run_example
    if model == "coles":
        return run_coles
    if model == "aldi":
        return run_aldi
    if model == "iga":
        return run_iga
    if model == "woolworths":
        return run_woolworths
    raise ValueError(f"Unsupported model '{model}'.")


def main() -> int:
    args = parse_args()
    settings = load_settings()
    runtime_config = load_runtime_config()
    run_job = resolve_job(args.model, args.runner)
    summary = run_job(
        model=args.model,
        runner=args.runner,
        start_date=args.start_date,
        runtime_config=runtime_config,
        settings=settings,
    )

    print("Pipeline completed successfully")
    print(f"model={args.model}")
    print(f"runner={args.runner}")
    print(f"start_date={args.start_date}")
    print(f"processed_dates={summary['processed_dates']}")
    print(f"skipped_dates={summary['skipped_dates']}")
    for key, value in summary["counts"].items():
        print(f"{key}_rows={value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
