from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import duckdb

from common.cli import iter_dates
from common.db import load_demo_slice
from common.duckdb_utils import load_sql
from common.paths import resolve_input_path

if TYPE_CHECKING:
    from common.job_models import JobSummary
    from config.settings import AppSettings, RuntimeConfig


SQL_ROOT = Path(__file__).resolve().parent
WORKFLOW_SQL_DIR = SQL_ROOT / "workflow_sql"
RUNNER = "products"
TRANSFORM_SQL = load_sql(WORKFLOW_SQL_DIR / "transform.sql")
QA_CHECK_SQL = load_sql(WORKFLOW_SQL_DIR / "qa_check.sql")

def _fetch_scalar(conn: duckdb.DuckDBPyConnection, query: str) -> int:
    row = conn.execute(query).fetchone()
    if row is None:
        raise RuntimeError(f"Expected a scalar result for query: {query}")
    return int(row[0])


def _load_input_file(conn: duckdb.DuckDBPyConnection, input_path: Path) -> int:
    conn.execute(
        """
        CREATE OR REPLACE TABLE raw_data AS 
        SELECT * FROM read_csv_auto(?, header=true, all_varchar=true)
        """,
        [str(input_path)],
    )
    return _fetch_scalar(conn, "SELECT count(*) FROM raw_data")


def _transform_woolworths(conn: duckdb.DuckDBPyConnection) -> int:
    conn.execute(TRANSFORM_SQL)
    return _fetch_scalar(conn, "SELECT count(*) FROM processed_data")

def _run_quality_checks(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute(QA_CHECK_SQL)
    qa_results = conn.execute(
        "SELECT check_name, passed, details FROM qa_results ORDER BY passed ASC, check_name ASC"
    ).fetchall()
    failed = [row for row in qa_results if not row[1]]
    if failed:
        formatted = "; ".join(f"{name}={details}" for name, _, details in failed)
        raise RuntimeError(f"QA checks failed: {formatted}")
    
def _save_data(
    conn: duckdb.DuckDBPyConnection,
    settings: AppSettings,
    run_date: str,
) -> int:
    return load_demo_slice(
        conn=conn,
        settings=settings,
        duck_table="processed_data",
        postgres_table="fct_product_prices",
        retailer="Woolworths",
        run_date=run_date,
    )


def run(
    model: str,
    start_date: str,
    end_date: str | None,
    runtime_config: RuntimeConfig,
    settings: AppSettings,
) -> JobSummary:

    if model != "woolworths":
        raise ValueError("This workflow supports only model='woolworths'.")

    counts = {
        "raw_data": 0,
        "processed_data": 0,
        "fct_product_prices": 0,
    }

    processed_dates: list[str] = []
    skipped_dates: list[str] = []

    conn = duckdb.connect()
    try:
        for run_date in iter_dates(start_date, end_date):
            run_date_value = run_date.isoformat()
            input_path = resolve_input_path(
                runtime_config, model, RUNNER, run_date
            )

            if not input_path.exists():
                skipped_dates.append(run_date_value)
                continue

            counts["raw_data"] += _load_input_file(conn, input_path)
            counts["processed_data"] += _transform_woolworths(conn)
            _run_quality_checks(conn)
            counts["fct_product_prices"] += _save_data(
                conn, settings, run_date_value
            )

            processed_dates.append(run_date_value)

    finally:
        conn.close()

    return {
        "processed_dates": ",".join(processed_dates) if processed_dates else "none",
        "skipped_dates": ",".join(skipped_dates) if skipped_dates else "none",
        "counts": counts,
    }
