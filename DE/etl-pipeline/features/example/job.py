from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from common.cli import iter_dates
from common.db import load_demo_slice, open_etl_connection
from common.duckdb_utils import fetch_scalar, load_sql
from common.paths import resolve_input_paths

if TYPE_CHECKING:
    import duckdb

    from common.job_models import JobSummary
    from config.settings import AppSettings, RuntimeConfig

SQL_ROOT = Path(__file__).resolve().parent
WORKFLOW_SQL_DIR = SQL_ROOT / "workflow_sql"
EXAMPLE_RUNNER = "products"
DEMO_TRANSFORM_SQL = load_sql(WORKFLOW_SQL_DIR / "demo_transform.sql")
QA_CHECK_SQL = load_sql(WORKFLOW_SQL_DIR / "qa_check.sql")


def _load_input_files(
    conn: duckdb.DuckDBPyConnection,
    input_paths: list[Path],
) -> int:
    if not input_paths:
        return 0

    first_path = input_paths[0]
    conn.execute(
        "CREATE OR REPLACE TABLE raw_input AS SELECT * FROM read_csv_auto(?, header=true, all_varchar=true)",
        [str(first_path)],
    )
    for input_path in input_paths[1:]:
        conn.execute(
            "INSERT INTO raw_input SELECT * FROM read_csv_auto(?, header=true, all_varchar=true)",
            [str(input_path)],
        )
    return fetch_scalar(conn, "SELECT count(*) FROM raw_input")


def _transform_data(
    conn: duckdb.DuckDBPyConnection,
    input_path: Path,
    run_date: str,
) -> int:
    # Keep the starter example generic even though it reads a Coles-shaped file.
    source_file_sql = str(input_path).replace("'", "''")
    # Normalize data
    conn.execute(
        f"""
        CREATE OR REPLACE TABLE raw_input_normalized AS
        SELECT
            'example' AS retailer,
            CAST(ProductId AS VARCHAR) AS product_id,
            trim(Name) AS product_name,
            NULLIF(trim(Brand), '') AS brand_name,
            NULLIF(trim(Description), '') AS description,
            NULLIF(trim(Size), '') AS pack_size,
            coalesce(
                NULLIF(trim(Category), ''),
                NULLIF(trim(SubCategory), ''),
                NULLIF(trim(ClassName), ''),
                NULLIF(trim(CategoryGroup), '')
            ) AS raw_category,
            NULLIF(trim(ImageUri), '') AS image_url,
            TRY_CAST(
                regexp_replace(coalesce(CAST(Price_Now AS VARCHAR), ''), '[^0-9.-]', '', 'g')
                AS DOUBLE
            ) AS current_price,
            TRY_CAST(
                regexp_replace(coalesce(CAST(Price_Was AS VARCHAR), ''), '[^0-9.-]', '', 'g')
                AS DOUBLE
            ) AS previous_price,
            TRY_CAST(
                regexp_replace(coalesce(CAST(SaveAmount AS VARCHAR), ''), '[^0-9.-]', '', 'g')
                AS DOUBLE
            ) AS discount_amount,
            TRY_CAST(
                regexp_replace(coalesce(CAST(UnitPrice AS VARCHAR), ''), '[^0-9.-]', '', 'g')
                AS DOUBLE
            ) AS price_per_unit,
            NULLIF(trim(UnitMeasure), '') AS unit_measure,
            TRY_CAST(
                regexp_replace(coalesce(CAST(UnitQuantity AS VARCHAR), ''), '[^0-9.-]', '', 'g')
                AS DOUBLE
            ) AS unit_quantity,
            CASE
                WHEN TRY_CAST(
                    regexp_replace(coalesce(CAST(Price_Was AS VARCHAR), ''), '[^0-9.-]', '', 'g')
                    AS DOUBLE
                ) > TRY_CAST(
                    regexp_replace(coalesce(CAST(Price_Now AS VARCHAR), ''), '[^0-9.-]', '', 'g')
                    AS DOUBLE
                ) THEN TRUE
                ELSE FALSE
            END AS is_on_special,
            TRY_CAST(Timestamp AS TIMESTAMP) AS scraped_at,
            DATE '{run_date}' AS run_date,
            '{source_file_sql}' AS source_file,
            CAST(ProductId AS VARCHAR) AS raw_record_id,
            current_timestamp AS loaded_at
        FROM raw_input
        """
    )
    conn.execute(DEMO_TRANSFORM_SQL)
    return fetch_scalar(conn, "SELECT count(*) FROM raw_input_normalized")


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
    run_date: str,
) -> int:
    return load_demo_slice(
        conn=conn,
        settings=settings,
        duck_table="demo_product_pricing_summary",
        postgres_table="demo_product_pricing_summary",
        retailer="example",
        run_date=run_date,
    )


def run(
    model: str,
    start_date: str,
    end_date: str | None,
    runtime_config: RuntimeConfig,
    settings: AppSettings,
) -> JobSummary:
    if model != "example":
        raise ValueError("The example workflow supports only model='example'.")

    counts = {
        "raw_input": 0,
        "raw_input_normalized": 0,
        "demo_product_pricing_summary": 0,
    }
    processed_dates: list[str] = []
    skipped_dates: list[str] = []

    conn = open_etl_connection(settings)
    try:
        for run_date in iter_dates(start_date, end_date):
            run_date_value = run_date.isoformat()
            input_paths = resolve_input_paths(
                runtime_config, model, EXAMPLE_RUNNER, run_date
            )
            if not input_paths:
                skipped_dates.append(run_date_value)
                continue

            # Step 1: load the source file into a reusable staging table.
            counts["raw_input"] += _load_input_files(conn, input_paths)

            # Step 2: normalize the raw file and build the downstream summary tables.
            counts["raw_input_normalized"] += _transform_data(
                conn, input_paths[0], run_date_value
            )

            # Step 3: fail fast if the transformed slice does not meet the QA rules.
            _run_quality_checks(conn)

            # Step 4: persist the validated slice to PostgreSQL.
            counts["demo_product_pricing_summary"] += _save_data(
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
