from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import duckdb

from common.cli import iter_dates
from common.db import (
    configure_bronze_storage,
    ensure_postgres_attached,
    open_etl_connection,
    postgres_table,
)
from common.duckdb_utils import fetch_scalar, render_sql_template
from common.paths import resolve_input_paths

if TYPE_CHECKING:
    from common.job_models import JobSummary
    from config.settings import AppSettings, RuntimeConfig

SQL_ROOT = Path(__file__).resolve().parent
WORKFLOW_SQL_DIR = SQL_ROOT / "workflow_sql"
IGA_RUNNER = "products"
IGA_MODEL = "products_iga"
IGA_TIMEZONE = "Australia/Melbourne"


def _workflow_sql_context() -> dict[str, str]:
    return {
        "dim_categories_table": postgres_table("dim_categories"),
        "dim_retailers_table": postgres_table("dim_retailers"),
        "dim_products_table": postgres_table("dim_products"),
        "fct_product_prices_table": postgres_table("fct_product_prices"),
        "dim_product_canonical_key_expr": """
            trim(regexp_replace(lower(coalesce(products.brand_name, '')), '[^a-z0-9]+', ' ', 'g'))
            || '|'
            || CASE
                WHEN trim(regexp_replace(lower(coalesce(products.brand_name, '')), '[^a-z0-9]+', ' ', 'g')) <> ''
                    AND trim(regexp_replace(lower(coalesce(products.product_name, '')), '[^a-z0-9]+', ' ', 'g'))
                        LIKE trim(regexp_replace(lower(coalesce(products.brand_name, '')), '[^a-z0-9]+', ' ', 'g')) || ' %'
                    THEN substr(
                        trim(regexp_replace(lower(coalesce(products.product_name, '')), '[^a-z0-9]+', ' ', 'g')),
                        length(trim(regexp_replace(lower(coalesce(products.brand_name, '')), '[^a-z0-9]+', ' ', 'g'))) + 2
                    )
                ELSE trim(regexp_replace(lower(coalesce(products.product_name, '')), '[^a-z0-9]+', ' ', 'g'))
            END
            || '|'
            || CASE
                WHEN products.pack_quantity IS NULL THEN ''
                ELSE rtrim(
                    regexp_replace(printf('%.3f', products.pack_quantity), '0+$', ''),
                    '.'
                )
            END
            || '|'
            || coalesce(lower(products.pack_uom), '')
        """.strip(),
    }


def _load_input_files(
    conn: duckdb.DuckDBPyConnection,
    input_paths: list[str],
) -> int:
    if not input_paths:
        return 0

    conn.execute(
        """
        CREATE OR REPLACE TABLE raw_input AS
        SELECT * EXCLUDE (filename), filename AS source_file
        FROM read_csv_auto(
            ?,
            header=true,
            all_varchar=true,
            union_by_name=true,
            filename=true
        )
        """,
        [input_paths],
    )

    return fetch_scalar(conn, "SELECT count(*) FROM raw_input")


def run(
    model: str,
    start_date: str,
    end_date: str | None,
    runtime_config: RuntimeConfig,
    settings: AppSettings,
) -> JobSummary:
    if model != IGA_MODEL:
        raise ValueError(f"The IGA workflow supports only model='{IGA_MODEL}'.")

    counts = {
        "raw_input": 0,
        "raw_input_normalized": 0,
    }
    processed_dates: list[str] = []
    skipped_dates: list[str] = []
    input_paths: list[str] = []

    conn = open_etl_connection(settings)
    try:
        conn.execute(f"SET TimeZone = '{IGA_TIMEZONE}'")
        configure_bronze_storage(conn, settings, runtime_config.paths.bronze_root)
        for run_date in iter_dates(start_date, end_date):
            run_date_value = run_date.isoformat()
            date_input_paths = resolve_input_paths(
                conn,
                runtime_config,
                model,
                IGA_RUNNER,
                run_date,
            )
            if not date_input_paths:
                skipped_dates.append(run_date_value)
                continue
            input_paths.extend(date_input_paths)
            processed_dates.append(run_date_value)

        if input_paths:
            counts["raw_input"] = _load_input_files(conn, input_paths)
            conn.execute(render_sql_template(WORKFLOW_SQL_DIR / "transform.sql"))
            counts["raw_input_normalized"] = fetch_scalar(
                conn,
                "SELECT count(*) FROM raw_input_normalized",
            )
            ensure_postgres_attached(conn, settings)
            sql_context = _workflow_sql_context()

            conn.execute("BEGIN")
            try:
                conn.execute(
                    render_sql_template(
                        WORKFLOW_SQL_DIR / "sync_dim_products.sql",
                        **sql_context,
                    )
                )
                conn.execute(
                    render_sql_template(
                        WORKFLOW_SQL_DIR / "sync_fct_product_prices.sql",
                        **sql_context,
                    )
                )
                conn.execute("COMMIT")
            except duckdb.Error:
                conn.execute("ROLLBACK")
                raise
    finally:
        conn.close()

    return {
        "processed_dates": ",".join(processed_dates) if processed_dates else "none",
        "skipped_dates": ",".join(skipped_dates) if skipped_dates else "none",
        "counts": counts,
    }
