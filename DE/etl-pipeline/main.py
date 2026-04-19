from __future__ import annotations

from collections.abc import Callable

from common.cli import parse_args
from common.job_models import JobSummary
from config import load_runtime_config, load_settings
from features.example.job import run as run_example
from features.products.aldi.job import run as run_aldi
from features.products.coles.job import run as run_coles
from features.products.iga.job import run as run_iga
from features.products.woolworths.job import run as run_woolworths

JobRunner = Callable[..., JobSummary]


def resolve_job(model: str) -> JobRunner:
    match model:
        case "example":
            return run_example
        case "products_aldi":
            return run_aldi
        case "products_coles":
            return run_coles
        case "products_iga":
            return run_iga
        case "products_woolworths":
            return run_woolworths
        case _:
            raise ValueError(f"Unsupported model: '{model}'")


def main() -> int:
    args = parse_args()
    settings = load_settings()
    runtime_config = load_runtime_config()
    run_job = resolve_job(args.model)
    summary = run_job(
        model=args.model,
        start_date=args.start_date,
        end_date=args.end_date,
        runtime_config=runtime_config,
        settings=settings,
    )

    print("Pipeline completed successfully")
    print(f"model={args.model}")
    print(f"start_date={args.start_date}")
    print(f"end_date={args.end_date or 'today'}")
    print(f"processed_dates={summary['processed_dates']}")
    print(f"skipped_dates={summary['skipped_dates']}")
    for key, value in summary["counts"].items():
        print(f"{key}_rows={value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
