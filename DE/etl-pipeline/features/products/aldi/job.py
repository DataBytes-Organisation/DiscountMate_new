from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import duckdb

from common.cli import iter_dates
from common.db import (
    connect_postgres,
    load_duckdb_table_to_temp_table,
    load_pg_sql,
)
from common.duckdb_utils import load_sql
from common.paths import resolve_input_path_with_glob, resolve_model_path

if TYPE_CHECKING:
    from common.job_models import JobSummary
    from config.settings import AppSettings, RuntimeConfig

SQL_ROOT = Path(__file__).resolve().parent
WORKFLOW_SQL_DIR = SQL_ROOT / "workflow_sql"
ALDI_RUNNER = "products"
ALDI_GLOB_KEY = "products_glob"
COLES_MASTER_KEY = "coles_master"
NORMALIZE_SQL = load_sql(WORKFLOW_SQL_DIR / "normalize_aldi.sql")
QA_CHECK_SQL = load_sql(WORKFLOW_SQL_DIR / "qa_check.sql")
UPSERT_SQL = load_pg_sql(WORKFLOW_SQL_DIR / "upsert_silver.sql")

ALDI_STAGE_COLUMN_TYPES = {
    "source_product_id": "text",
    "product_name": "text",
    "brand_name": "text",
    "gtin": "varchar(14)",
    "standard_category_name": "text",
    "pack_quantity": "numeric(10, 3)",
    "pack_uom": "text",
    "price": "numeric(10, 2)",
    "unit_price": "numeric(12, 4)",
    "image_link_side": "text",
    "image_link_back": "text",
    "recorded_at": "timestamptz",
    "item_name": "text",
    "special_text": "text",
    "product_url": "text",
    "is_on_special": "boolean",
}


def _fetch_scalar(conn: duckdb.DuckDBPyConnection, query: str) -> int:
    row = conn.execute(query).fetchone()
    if row is None:
        raise RuntimeError(f"Expected a scalar result for query: {query}")
    return int(row[0])


def _load_csv(
    conn: duckdb.DuckDBPyConnection,
    table_name: str,
    input_path: Path,
) -> int:
    conn.execute(
        f"""
        CREATE OR REPLACE TABLE {table_name} AS
        SELECT * FROM read_csv_auto(?, header=true, all_varchar=true)
        """,
        [str(input_path)],
    )
    return _fetch_scalar(conn, f"SELECT count(*) FROM {table_name}")


def _transform_data(conn: duckdb.DuckDBPyConnection, run_date: str) -> int:
    conn.execute(NORMALIZE_SQL.replace("__RUN_DATE__", run_date))
    return _fetch_scalar(conn, "SELECT count(*) FROM aldi_silver_stage")


def _run_quality_checks(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute(QA_CHECK_SQL)
    qa_results = conn.execute(
        "SELECT check_name, passed, details FROM qa_results ORDER BY passed ASC, check_name ASC"
    ).fetchall()
    failed_checks = [row for row in qa_results if not row[1]]
    if failed_checks:
        formatted = "; ".join(f"{name}={details}" for name, _, details in failed_checks)
        raise RuntimeError(f"QA checks failed: {formatted}")


def _save_data(
    conn: duckdb.DuckDBPyConnection,
    settings: AppSettings,
) -> dict[str, int]:
    with connect_postgres(settings) as pg_conn, pg_conn.cursor() as cursor:
        stage_rows = load_duckdb_table_to_temp_table(
            cursor=cursor,
            conn=conn,
            duck_table="aldi_silver_stage",
            temp_table="stg_aldi_products",
            column_types=ALDI_STAGE_COLUMN_TYPES,
        )
        cursor.execute(UPSERT_SQL)
        cursor.execute("SELECT count(*) FROM stg_aldi_matched")
        matched_rows = int(cursor.fetchone()[0])
        cursor.execute(
            """
            SELECT count(*)
            FROM silver.fct_product_prices f
            JOIN silver.dim_retailers r ON r.id = f.retailer_id
            WHERE r.retailer_name = 'Aldi'
            """
        )
        aldi_fact_rows = int(cursor.fetchone()[0])

    return {
        "stg_aldi_products": stage_rows,
        "stg_aldi_matched": matched_rows,
        "fct_product_prices_aldi_total": aldi_fact_rows,
    }


def run(
    model: str,
    start_date: str,
    end_date: str | None,
    runtime_config: RuntimeConfig,
    settings: AppSettings,
) -> JobSummary:
    if model != "products_aldi":
        raise ValueError("The Aldi workflow supports only model='products_aldi'.")

    counts = {
        "raw_aldi_input": 0,
        "raw_coles_master": 0,
        "aldi_silver_stage": 0,
        "stg_aldi_products": 0,
        "stg_aldi_matched": 0,
        "fct_product_prices_aldi_total": 0,
    }
    processed_dates: list[str] = []
    skipped_dates: list[str] = []

    conn = duckdb.connect()
    try:
        for run_date in iter_dates(start_date, end_date):
            run_date_value = run_date.isoformat()
            aldi_input_path = resolve_input_path_with_glob(
                runtime_config,
                model,
                ALDI_RUNNER,
                ALDI_GLOB_KEY,
                run_date,
            )
            coles_master_path = resolve_model_path(
                runtime_config,
                model,
                COLES_MASTER_KEY,
                run_date,
            )
            if not aldi_input_path.exists():
                skipped_dates.append(run_date_value)
                continue
            if not coles_master_path.exists():
                raise FileNotFoundError(
                    f"Coles master data not found: {coles_master_path}"
                )

            counts["raw_aldi_input"] += _load_csv(
                conn,
                "raw_aldi_input",
                aldi_input_path,
            )
            counts["raw_coles_master"] += _load_csv(
                conn,
                "raw_coles_master",
                coles_master_path,
            )
            counts["aldi_silver_stage"] += _transform_data(conn, run_date_value)
            _run_quality_checks(conn)
            save_counts = _save_data(conn, settings)
            for key, value in save_counts.items():
                if key == "fct_product_prices_aldi_total":
                    counts[key] = value
                else:
                    counts[key] += value
            processed_dates.append(run_date_value)
    finally:
        conn.close()

    return {
        "processed_dates": ",".join(processed_dates) if processed_dates else "none",
        "skipped_dates": ",".join(skipped_dates) if skipped_dates else "none",
        "counts": counts,
    }
