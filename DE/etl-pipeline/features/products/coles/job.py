from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import duckdb
import psycopg
from psycopg import sql

from common.cli import iter_dates
from common.db import (
    configure_bronze_storage,
    ensure_postgres_attached,
    open_etl_connection,
    postgres_table,
)
from common.duckdb_utils import fetch_scalar, render_sql_template
from common.job_validation import validate_positive_offer_count
from common.paths import resolve_input_paths

if TYPE_CHECKING:
    from common.job_models import JobSummary
    from config.settings import AppSettings, RuntimeConfig

SQL_ROOT = Path(__file__).resolve().parent
WORKFLOW_SQL_DIR = SQL_ROOT / "workflow_sql"
COLES_RUNNER = "products"
COLES_MODEL = "products_coles"
COLES_TIMEZONE = "Australia/Melbourne"


def _validate_positive_offer_count(count: int) -> None:
    validate_positive_offer_count("Coles", count)


def _workflow_sql_context() -> dict[str, str]:
    return {
        "dim_categories_table": postgres_table("dim_categories"),
        "dim_retailers_table": postgres_table("dim_retailers"),
        "dim_products_table": postgres_table("dim_products"),
        "fct_product_prices_table": postgres_table("fct_product_prices"),
        "static_master_coles_products_table": postgres_table(
            "static_master_coles_products"
        ),
        "dim_product_canonical_key_expr": """
            trim(regexp_replace(lower(coalesce(products.brand_name, '')), '[^a-z0-9]+', ' ', 'g'))
            || '|'
            || trim(regexp_replace(lower(coalesce(products.product_name, '')), '[^a-z0-9]+', ' ', 'g'))
            || '|'
            || CASE
                WHEN products.pack_quantity IS NULL THEN ''
                ELSE regexp_replace(
                    regexp_replace(printf('%.3f', products.pack_quantity), '0+$', ''),
                    '\\.$',
                    ''
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


def _load_static_master_files(
    conn: duckdb.DuckDBPyConnection,
    input_paths: list[str],
) -> int:
    if not input_paths:
        return 0

    conn.execute(
        """
        CREATE OR REPLACE TABLE static_master_input AS
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
    conn.execute(
        """
        CREATE OR REPLACE TABLE static_master_input_normalized AS
        SELECT
            nullif(trim(product_id), '') AS product_id,
            coalesce(nullif(trim(name), ''), 'Unknown product') AS name,
            coalesce(nullif(trim(brand), ''), nullif(trim(brand_name), ''),
                     'Unknown brand') AS brand,
            coalesce(nullif(trim(description), ''), nullif(trim(name), ''),
                     'Unknown product') AS description,
            nullif(trim(longDescription), '') AS long_description,
            nullif(trim(size), '') AS size,
            CASE
                WHEN regexp_full_match(trim(coalesce(gtin, '')), '[0-9]{8,14}')
                    THEN trim(gtin)
                ELSE NULL
            END AS gtin,
            coalesce(nullif(trim(merchandise_category), ''), 'MISCELLANEOUS')
                AS merchandise_category,
            nullif(trim(online_aisle), '') AS online_aisle,
            coalesce(nullif(trim(brand_name), ''), nullif(trim(brand), ''))
                AS brand_name,
            TRY_CAST(price_now AS DECIMAL(10, 2)) AS price_now,
            TRY_CAST(price_was AS DECIMAL(10, 2)) AS price_was,
            nullif(trim(price_comparable), '') AS price_comparable,
            coalesce(CAST(TRY_CAST(variations_json AS JSON) AS VARCHAR), '[]')
                AS variations_json,
            coalesce(CAST(TRY_CAST(images_json AS JSON) AS VARCHAR), '[]')
                AS images_json,
            nullif(trim(local_image_paths), '') AS local_image_paths,
            coalesce(TRY_CAST(image_count AS INTEGER), 0) AS image_count,
            coalesce(nullif(trim(url), ''), 'https://www.coles.com.au/') AS url,
            coalesce(TRY_CAST(timestamp AS TIMESTAMPTZ), current_timestamp)
                AS scraped_at,
            coalesce(nullif(trim(scrape_status), ''), 'unknown') AS scrape_status
        FROM static_master_input
        WHERE nullif(trim(product_id), '') IS NOT NULL
        """
    )

    return fetch_scalar(conn, "SELECT count(*) FROM static_master_input_normalized")


def _sync_static_master_to_postgres(
    conn: duckdb.DuckDBPyConnection,
    settings: AppSettings,
) -> int:
    columns = (
        "product_id",
        "name",
        "brand",
        "description",
        "long_description",
        "size",
        "gtin",
        "merchandise_category",
        "online_aisle",
        "brand_name",
        "price_now",
        "price_was",
        "price_comparable",
        "variations_json",
        "images_json",
        "local_image_paths",
        "image_count",
        "url",
        "scraped_at",
        "scrape_status",
    )
    column_list = ", ".join(columns)
    rows = conn.execute(
        f"SELECT {column_list} FROM static_master_input_normalized"
    ).fetchall()
    if not rows:
        return 0

    target = sql.Identifier(settings.postgres_schema, "static_master_coles_products")
    stage = sql.Identifier("static_master_coles_products_stage")
    identifiers = sql.SQL(", ").join(map(sql.Identifier, columns))
    join_condition = sql.SQL(
        "target.product_id = stage.product_id "
        "AND target.scraped_at = stage.scraped_at"
    )

    with (
        psycopg.connect(settings.postgres_duckdb_uri()) as pg_connection,
        pg_connection.cursor() as cursor,
    ):
        cursor.execute(
            sql.SQL("CREATE TEMP TABLE {} (LIKE {} INCLUDING DEFAULTS) ON COMMIT DROP")
            .format(stage, target)
        )
        with cursor.copy(
            sql.SQL("COPY {} ({}) FROM STDIN").format(stage, identifiers)
        ) as copy:
            for row in rows:
                copy.write_row(row)
        cursor.execute(
            sql.SQL("DELETE FROM {} AS target USING {} AS stage WHERE {}")
            .format(target, stage, join_condition)
        )
        cursor.execute(
            sql.SQL("INSERT INTO {} ({}) SELECT {} FROM {}")
            .format(target, identifiers, identifiers, stage)
        )

    return len(rows)


def run(
    model: str,
    start_date: str,
    end_date: str | None,
    runtime_config: RuntimeConfig,
    settings: AppSettings,
) -> JobSummary:
    if model != COLES_MODEL:
        raise ValueError(f"The Coles workflow supports only model='{COLES_MODEL}'.")

    counts = {
        "raw_input": 0,
        "raw_input_normalized": 0,
        "static_master": 0,
    }
    processed_dates: list[str] = []
    skipped_dates: list[str] = []
    input_paths: list[str] = []
    master_paths: list[str] = []

    conn = open_etl_connection(settings)
    try:
        conn.execute(f"SET TimeZone = '{COLES_TIMEZONE}'")
        configure_bronze_storage(conn, settings, runtime_config.paths.bronze_root)
        for run_date in iter_dates(start_date, end_date):
            run_date_value = run_date.isoformat()
            date_input_paths = resolve_input_paths(
                conn,
                runtime_config,
                model,
                COLES_RUNNER,
                run_date,
            )
            if not date_input_paths:
                skipped_dates.append(run_date_value)
                continue
            input_paths.extend(date_input_paths)
            processed_dates.append(run_date_value)
            if not master_paths:
                master_paths = resolve_input_paths(
                    conn,
                    runtime_config,
                    model,
                    "coles_master",
                    run_date,
                )

        if input_paths:
            counts["raw_input"] = _load_input_files(conn, input_paths)
            if not master_paths:
                raise RuntimeError(
                    "Coles GTIN master input was not found; product identity enrichment "
                    "cannot run safely."
                )
            counts["static_master"] = _load_static_master_files(conn, master_paths)
            _sync_static_master_to_postgres(conn, settings)
            ensure_postgres_attached(conn, settings)
            sql_context = _workflow_sql_context()
            conn.execute(render_sql_template(WORKFLOW_SQL_DIR / "transform.sql"))
            counts["raw_input_normalized"] = fetch_scalar(
                conn,
                "SELECT count(*) FROM raw_input_normalized",
            )
            _validate_positive_offer_count(counts["raw_input_normalized"])

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
        "source_files": sorted(input_paths),
    }
