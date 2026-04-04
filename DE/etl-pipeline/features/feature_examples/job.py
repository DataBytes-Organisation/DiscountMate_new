from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import duckdb

from common.cli import iter_dates_to_today
from common.db import load_demo_slice
from common.duckdb_utils import load_sql
from common.normalization import build_example_normalization_sql
from common.paths import resolve_input_path

if TYPE_CHECKING:
    from common.job_models import JobSummary
    from config.settings import AppSettings, RuntimeConfig


FEATURE_ROOT = Path(__file__).resolve().parent
SQL_ROOT = FEATURE_ROOT


def _fetch_scalar(conn: duckdb.DuckDBPyConnection, query: str) -> int:
    row = conn.execute(query).fetchone()
    if row is None:
        raise RuntimeError(f"Expected a scalar result for query: {query}")
    return int(row[0])


def _run_quality_checks(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute(load_sql(SQL_ROOT / "demo_transform.sql"))
    conn.execute(load_sql(SQL_ROOT / "qa_check.sql"))
    qa_results = conn.execute(
        "SELECT check_name, passed, details FROM qa_results ORDER BY passed ASC, check_name ASC"
    ).fetchall()
    failed_checks = [row for row in qa_results if not row[1]]
    if failed_checks:
        formatted = "; ".join(f"{name}={details}" for name, _, details in failed_checks)
        raise RuntimeError(f"QA checks failed: {formatted}")


def run(
    model: str,
    runner: str,
    start_date: str,
    runtime_config: RuntimeConfig,
    settings: AppSettings,
) -> JobSummary:
    if runner != "products":
        raise ValueError("The example workflow supports only runner='products'.")

    if model != "example":
        raise ValueError("The example workflow supports only model='example'.")

    counts = {
        "raw_input": 0,
        "raw_input_normalized": 0,
        "demo_product_pricing_summary": 0,
    }
    processed_dates: list[str] = []
    skipped_dates: list[str] = []

    for run_date in iter_dates_to_today(start_date):
        input_path = resolve_input_path(runtime_config, model, runner, run_date)
        if not input_path.exists():
            skipped_dates.append(run_date.isoformat())
            continue

        processed_dates.append(run_date.isoformat())
        conn = duckdb.connect()
        conn.execute(
            "CREATE OR REPLACE TABLE raw_input AS SELECT * FROM read_csv_auto(?, header=true, all_varchar=true)",
            [str(input_path)],
        )
        # The generic example uses a Coles-shaped sample file, but keeps the
        # output labeled as "example" so teammates can reuse the starter flow.
        conn.execute(build_example_normalization_sql(input_path, run_date.isoformat()))
        _run_quality_checks(conn)

        counts["raw_input"] += _fetch_scalar(conn, "SELECT count(*) FROM raw_input")
        counts["raw_input_normalized"] += _fetch_scalar(
            conn, "SELECT count(*) FROM raw_input_normalized"
        )
        counts["demo_product_pricing_summary"] += load_demo_slice(
            conn=conn,
            settings=settings,
            duck_table="demo_product_pricing_summary",
            postgres_table="demo_product_pricing_summary",
            retailer="example",
            run_date=run_date.isoformat(),
        )
        conn.close()

    return {
        "processed_dates": ",".join(processed_dates) if processed_dates else "none",
        "skipped_dates": ",".join(skipped_dates) if skipped_dates else "none",
        "counts": counts,
    }
