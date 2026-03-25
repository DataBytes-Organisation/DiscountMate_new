from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from config import (
    build_logger,
    configure_logging,
    configure_telemetry,
    get_log_file_path,
    load_settings,
)
from config.telemetry import get_tracer
from dotenv import load_dotenv
from scraper.aldi.aldi_product_scraper import run as run_aldi
from scraper.coles.coles_product_scraper import run as run_coles
from scraper.example.example_scraper import run as run_example
from scraper.iga.iga_product_scraper import run as run_iga
from scraper.woolworths.ww_product_scraper import run as run_ww
from storage import StorageManager
from util import RunContext, RunResult, utc_timestamp


Runner = Callable[[RunContext], RunResult]


def load_env(path: Path) -> None:
    if path.exists():
        load_dotenv(path, override=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a scraper source/runner pair.")
    parser.add_argument(
        "--source", required=True, help="Scraper source: aldi, coles, iga, ww, example"
    )
    parser.add_argument(
        "--runner",
        required=True,
        help="Runner name inside the source, currently: products",
    )
    return parser.parse_args()


def resolve_runner(source: str, runner: str) -> tuple[str, Runner]:
    match (source, runner):
        case ("aldi", "products"):
            return "aldi", run_aldi
        case ("coles", "products"):
            return "coles", run_coles
        case ("iga", "products"):
            return "iga", run_iga
        case ("ww", "products"):
            return "ww", run_ww
        case ("example", "products"):
            return "example", run_example
    raise ValueError(
        f"Unsupported source/runner combination: source={source}, runner={runner}"
    )


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parent
    load_env(repo_root / ".env")

    settings = load_settings(repo_root)
    source, runner_fn = resolve_runner(args.source, args.runner)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    log_file_path = get_log_file_path(
        settings.app.output_dir, source, args.runner, run_id
    )

    configure_logging(settings.app.log_level, log_file_path=log_file_path)
    root_logger = build_logger("discount_mate.main", source, args.runner, run_id)
    configure_telemetry(settings.telemetry, root_logger)
    logger = build_logger(
        f"discount_mate.{source}.{args.runner}", source, args.runner, run_id
    )

    context = RunContext(
        source=source,
        runner=args.runner,
        run_id=run_id,
        repo_root=repo_root,
        settings=settings,
        logger=logger,
        tracer=get_tracer(f"discount_mate.{source}.{args.runner}"),
    )

    logger.info("Starting scraper run")
    result = runner_fn(context)

    storage = StorageManager(settings)
    artifacts = storage.persist(
        source=source,
        runner=args.runner,
        run_id=run_id,
        records=result.records,
        metadata={
            "created_at": utc_timestamp(),
            "destinations": list(settings.app.destinations),
            "log_file": str(log_file_path.relative_to(settings.app.output_dir)),
            **result.metadata,
        },
    )

    logger.info("Run complete with %s records", len(result.records))
    logger.info("Artifacts saved in %s", artifacts.run_dir.relative_to(repo_root))
    if artifacts.uploaded_uris:
        logger.info("Uploaded artifacts: %s", ", ".join(artifacts.uploaded_uris))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
