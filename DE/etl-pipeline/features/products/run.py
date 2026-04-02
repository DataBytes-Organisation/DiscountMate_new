from __future__ import annotations

from pathlib import Path

import duckdb

from common.db import load_demo_slice
from common.duckdb_utils import load_sql
from common.paths import resolve_input_path
from config.settings import AppSettings, RuntimeConfig
from features.products.normalization import normalize_sql


FEATURE_ROOT = Path(__file__).resolve().parent
SQL_ROOT = FEATURE_ROOT / "sql"


def _fetch_scalar(conn: duckdb.DuckDBPyConnection, query: str) -> int:
    return int(conn.execute(query).fetchone()[0])


def _run_quality_checks(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute(load_sql(SQL_ROOT / "qa_check.sql"))
    qa_results = conn.execute(
        "SELECT check_name, passed, details FROM qa_results ORDER BY passed ASC, check_name ASC"
    ).fetchall()
    failed_checks = [row for row in qa_results if not row[1]]
    if failed_checks:
        formatted = "; ".join(f"{name}={details}" for name, _, details in failed_checks)
        raise RuntimeError(f"QA checks failed: {formatted}")


def run(
    source: str,
    runner: str,
    run_date: str,
    runtime_config: RuntimeConfig,
    settings: AppSettings,
) -> dict[str, object]:
    source_file = resolve_input_path(runtime_config, source, runner, run_date)

    conn = duckdb.connect()
    conn.execute(
        "CREATE OR REPLACE TABLE raw_input AS SELECT * FROM read_csv_auto(?, header=true, all_varchar=true)",
        [str(source_file)],
    )
    conn.execute(normalize_sql(source, source_file, run_date))
    conn.execute(load_sql(SQL_ROOT / "demo_transform.sql"))
    _run_quality_checks(conn)

    counts = {
        "raw_input": _fetch_scalar(conn, "SELECT count(*) FROM raw_input"),
        "raw_input_normalized": _fetch_scalar(
            conn, "SELECT count(*) FROM raw_input_normalized"
        ),
    }
    counts["demo_product_pricing_summary"] = load_demo_slice(
        conn=conn,
        settings=settings,
        duck_table="demo_product_pricing_summary",
        postgres_table="demo_product_pricing_summary",
        retailer=source.lower(),
        run_date=run_date,
    )

    return {
        "input_file": source_file,
        "counts": counts,
    }
