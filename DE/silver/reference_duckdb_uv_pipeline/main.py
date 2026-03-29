import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

import duckdb
import yaml
from dotenv import load_dotenv

try:
    import psycopg
except ImportError:  # pragma: no cover - depends on local environment sync
    psycopg = None


PROJECT_ROOT = Path(__file__).resolve().parent
SQL_DIR = PROJECT_ROOT / "sql"
TABLE_LOADS = [
    ("silver_products_core", "products_core"),
    ("silver_product_pricing", "product_pricing"),
    ("silver_product_availability", "product_availability"),
    ("silver_product_extended", "product_extended"),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the reference DuckDB Silver pipeline.")
    parser.add_argument("--source", required=True, help="Retailer source: coles, woolworths, iga, aldi")
    parser.add_argument("--runner", required=True, help="Pipeline runner. Phase 1 supports only 'products'")
    parser.add_argument("--date", required=True, help="Run date in YYYY-MM-DD format")
    parser.add_argument(
        "--config",
        default="config/local.yaml",
        help="Path to YAML config relative to the project root or an absolute path",
    )
    return parser.parse_args()


def load_config(config_path: str) -> dict:
    candidate = Path(config_path)
    resolved = candidate if candidate.is_absolute() else PROJECT_ROOT / candidate
    with resolved.open("r", encoding="utf-8") as handle:
        raw_config = yaml.safe_load(handle)
    return expand_env_vars(raw_config)


def expand_env_vars(value):
    if isinstance(value, dict):
        return {key: expand_env_vars(inner_value) for key, inner_value in value.items()}
    if isinstance(value, list):
        return [expand_env_vars(item) for item in value]
    if isinstance(value, str):
        return os.path.expandvars(value)
    return value


def validate_date(date_value: str) -> tuple[str, str]:
    parsed = datetime.strptime(date_value, "%Y-%m-%d")
    return date_value, parsed.strftime("%Y%m%d")


def resolve_input_path(config: dict, source: str, runner: str, date_value: str) -> Path:
    if source not in config["sources"]:
        raise ValueError(f"Unsupported source '{source}'.")

    source_mapping = config["sources"][source]
    if runner not in source_mapping:
        raise ValueError(f"Unsupported runner '{runner}' for source '{source}'.")

    date_iso, date_compact = validate_date(date_value)
    bronze_root = config["paths"]["bronze_root"]
    template = source_mapping[runner]
    relative_path = template.format(
        bronze_root=bronze_root,
        date=date_iso,
        date_compact=date_compact,
    )
    path = PROJECT_ROOT / relative_path
    if not path.exists():
        raise FileNotFoundError(f"Input file not found: {path}")
    return path


def sql_bool(column: str) -> str:
    return (
        f"CASE "
        f"WHEN lower(trim(coalesce(CAST({column} AS VARCHAR), ''))) IN ('true', '1', 'yes', 'y') THEN TRUE "
        f"WHEN lower(trim(coalesce(CAST({column} AS VARCHAR), ''))) IN ('false', '0', 'no', 'n') THEN FALSE "
        f"ELSE NULL END"
    )


def sql_number(column: str) -> str:
    return (
        f"TRY_CAST("
        f"regexp_replace(coalesce(CAST({column} AS VARCHAR), ''), '[^0-9.-]', '', 'g') "
        f"AS DOUBLE)"
    )


def normalize_sql(source: str, source_file: Path, run_date: str) -> str:
    source_file_sql = str(source_file).replace("'", "''")

    mappings = {
        "coles": f"""
            CREATE OR REPLACE TABLE raw_input_normalized AS
            SELECT
                'coles' AS retailer,
                CAST(ProductId AS VARCHAR) AS product_id,
                NULL AS store_id,
                trim(Name) AS product_name,
                NULLIF(trim(Brand), '') AS brand_name,
                NULLIF(trim(Description), '') AS description,
                NULLIF(trim(Size), '') AS pack_size,
                coalesce(NULLIF(trim(Category), ''), NULLIF(trim(SubCategory), ''), NULLIF(trim(ClassName), ''), NULLIF(trim(CategoryGroup), '')) AS raw_category,
                NULLIF(trim(ImageUri), '') AS image_url,
                NULL AS product_url,
                {sql_number('Price_Now')} AS current_price,
                {sql_number('Price_Was')} AS previous_price,
                {sql_number('SaveAmount')} AS discount_amount,
                {sql_number('UnitPrice')} AS price_per_unit,
                NULLIF(trim(UnitMeasure), '') AS unit_measure,
                {sql_number('UnitQuantity')} AS unit_quantity,
                CASE
                    WHEN {sql_number('Price_Was')} > {sql_number('Price_Now')} THEN TRUE
                    ELSE {sql_bool('OnlineSpecial')}
                END AS is_on_special,
                coalesce(NULLIF(trim(PromotionType), ''), NULLIF(trim(SpecialType), '')) AS promotion_type,
                coalesce(NULLIF(trim(OfferDescription), ''), NULLIF(trim(SaveStatement), '')) AS offer_description,
                NULLIF(trim(Availability), '') AS availability,
                NULLIF(trim(AvailabilityType), '') AS availability_type,
                {sql_number('AvailableQuantity')} AS available_quantity,
                {sql_number('RetailLimit')} AS supply_limit,
                {sql_number('PromotionalLimit')} AS product_limit,
                CASE
                    WHEN {sql_bool('LiquorRestricted')} IS TRUE OR {sql_bool('TobaccoRestricted')} IS TRUE THEN TRUE
                    ELSE FALSE
                END AS age_restricted,
                {sql_bool('LiquorRestricted')} AS alcohol_flag,
                NULL AS discontinued,
                NULL AS not_for_sale,
                'AUD' AS currency_code,
                TRY_CAST(Timestamp AS TIMESTAMP) AS scraped_at,
                DATE '{run_date}' AS run_date,
                '{source_file_sql}' AS source_file,
                CAST(ProductId AS VARCHAR) AS raw_record_id,
                NULL AS raw_json,
                current_timestamp AS loaded_at
            FROM raw_input
        """,
        "woolworths": f"""
            CREATE OR REPLACE TABLE raw_input_normalized AS
            SELECT
                'woolworths' AS retailer,
                CAST(Stockcode AS VARCHAR) AS product_id,
                NULL AS store_id,
                trim(coalesce(NULLIF(DisplayName, ''), NULLIF(Name, ''))) AS product_name,
                NULLIF(trim(Brand_Searched), '') AS brand_name,
                coalesce(NULLIF(trim(FullDescription), ''), NULLIF(trim(Description), '')) AS description,
                coalesce(NULLIF(trim(PackageSize), ''), NULLIF(trim(Unit), '')) AS pack_size,
                coalesce(NULLIF(trim(SapSubCategoryName), ''), NULLIF(trim(SapCategoryName), ''), NULLIF(trim(SapDepartmentName), '')) AS raw_category,
                coalesce(NULLIF(trim(LargeImageFile), ''), NULLIF(trim(MediumImageFile), ''), NULLIF(trim(SmallImageFile), '')) AS image_url,
                NULLIF(trim(UrlFriendlyName), '') AS product_url,
                {sql_number('Price')} AS current_price,
                {sql_number('WasPrice')} AS previous_price,
                {sql_number('SavingsAmount')} AS discount_amount,
                {sql_number('CupPrice')} AS price_per_unit,
                NULLIF(trim(CupMeasure), '') AS unit_measure,
                NULL AS unit_quantity,
                coalesce({sql_bool('IsOnSpecial')}, CASE WHEN {sql_number('WasPrice')} > {sql_number('Price')} THEN TRUE ELSE FALSE END) AS is_on_special,
                coalesce(NULLIF(trim(PromotionType), ''), NULLIF(trim(CentreTagType), '')) AS promotion_type,
                NULL AS offer_description,
                CASE
                    WHEN {sql_bool('IsAvailable')} IS TRUE OR {sql_bool('IsInStock')} IS TRUE THEN 'available'
                    WHEN {sql_bool('IsAvailable')} IS FALSE OR {sql_bool('IsInStock')} IS FALSE THEN 'unavailable'
                    ELSE NULL
                END AS availability,
                'stock_status' AS availability_type,
                NULL AS available_quantity,
                {sql_number('SupplyLimit')} AS supply_limit,
                {sql_number('ProductLimit')} AS product_limit,
                {sql_bool('AgeRestricted')} AS age_restricted,
                NULL AS alcohol_flag,
                NULL AS discontinued,
                NULL AS not_for_sale,
                'AUD' AS currency_code,
                TRY_CAST(Timestamp AS TIMESTAMP) AS scraped_at,
                DATE '{run_date}' AS run_date,
                '{source_file_sql}' AS source_file,
                CAST(Stockcode AS VARCHAR) AS raw_record_id,
                NULL AS raw_json,
                current_timestamp AS loaded_at
            FROM raw_input
        """,
        "iga": f"""
            CREATE OR REPLACE TABLE raw_input_normalized AS
            SELECT
                'iga' AS retailer,
                coalesce(CAST(iga_product_id AS VARCHAR), CAST(sku AS VARCHAR)) AS product_id,
                CAST(store_id AS VARCHAR) AS store_id,
                trim(coalesce(NULLIF(name, ''), NULLIF(iga_name, ''))) AS product_name,
                coalesce(NULLIF(trim(brand_name), ''), NULLIF(trim(iga_brand), '')) AS brand_name,
                NULLIF(trim(iga_description), '') AS description,
                CASE
                    WHEN iga_unit_of_size_size IS NOT NULL AND iga_unit_of_size_abbreviation IS NOT NULL THEN trim(CAST(iga_unit_of_size_size AS VARCHAR) || ' ' || iga_unit_of_size_abbreviation)
                    ELSE NULL
                END AS pack_size,
                coalesce(NULLIF(trim(iga_default_category), ''), NULLIF(trim(iga_categories), '')) AS raw_category,
                coalesce(NULLIF(trim(primary_image_url), ''), NULLIF(trim(iga_image_default), '')) AS image_url,
                NULL AS product_url,
                coalesce({sql_number('price_numeric')}, {sql_number('iga_price_numeric')}) AS current_price,
                coalesce({sql_number('was_price_numeric')}, {sql_number('iga_was_price_numeric')}) AS previous_price,
                CASE
                    WHEN coalesce({sql_number('was_price_numeric')}, {sql_number('iga_was_price_numeric')}) IS NOT NULL
                     AND coalesce({sql_number('price_numeric')}, {sql_number('iga_price_numeric')}) IS NOT NULL
                    THEN coalesce({sql_number('was_price_numeric')}, {sql_number('iga_was_price_numeric')}) - coalesce({sql_number('price_numeric')}, {sql_number('iga_price_numeric')})
                    ELSE NULL
                END AS discount_amount,
                coalesce({sql_number('price_per_unit')}, {sql_number('iga_price_per_unit')}) AS price_per_unit,
                coalesce(NULLIF(trim(iga_unit_of_measure_abbreviation), ''), NULLIF(trim(iga_unit_of_measure_label), '')) AS unit_measure,
                coalesce({sql_number('iga_unit_of_measure_size')}, {sql_number('iga_unit_of_size_size')}) AS unit_quantity,
                CASE
                    WHEN coalesce({sql_number('was_price_numeric')}, {sql_number('iga_was_price_numeric')}) > coalesce({sql_number('price_numeric')}, {sql_number('iga_price_numeric')}) THEN TRUE
                    ELSE FALSE
                END AS is_on_special,
                coalesce(NULLIF(trim(price_source), ''), NULLIF(trim(iga_price_source), ''), NULLIF(trim(price_label), '')) AS promotion_type,
                coalesce(NULLIF(trim(iga_shopping_rule_messages_information), ''), NULLIF(trim(price_label), ''), NULLIF(trim(iga_price_label), '')) AS offer_description,
                CASE
                    WHEN coalesce({sql_bool('available')}, {sql_bool('iga_available')}) IS TRUE THEN 'available'
                    WHEN coalesce({sql_bool('available')}, {sql_bool('iga_available')}) IS FALSE THEN 'unavailable'
                    ELSE NULL
                END AS availability,
                'stock_status' AS availability_type,
                NULL AS available_quantity,
                NULL AS supply_limit,
                NULL AS product_limit,
                coalesce({sql_bool('iga_attributes_alcohol_restricted')}, FALSE) AS age_restricted,
                {sql_bool('iga_attributes_alcohol_restricted')} AS alcohol_flag,
                NULL AS discontinued,
                NULL AS not_for_sale,
                'AUD' AS currency_code,
                TRY_CAST(scraped_at AS TIMESTAMP) AS scraped_at,
                DATE '{run_date}' AS run_date,
                '{source_file_sql}' AS source_file,
                coalesce(CAST(iga_product_id AS VARCHAR), CAST(sku AS VARCHAR)) AS raw_record_id,
                raw_json AS raw_json,
                current_timestamp AS loaded_at
            FROM raw_input
        """,
        "aldi": f"""
            CREATE OR REPLACE TABLE raw_input_normalized AS
            SELECT
                'aldi' AS retailer,
                coalesce(CAST(sku AS VARCHAR), CAST(aldi_sku AS VARCHAR)) AS product_id,
                NULL AS store_id,
                trim(coalesce(NULLIF(name, ''), NULLIF(aldi_name, ''))) AS product_name,
                coalesce(NULLIF(trim(brand_name), ''), NULLIF(trim(aldi_brand_name), '')) AS brand_name,
                NULLIF(trim(aldi_price_additional_info), '') AS description,
                NULLIF(trim(aldi_selling_size), '') AS pack_size,
                coalesce(NULLIF(trim(category_id_from_sitemap), ''), NULLIF(trim(aldi_categories), '')) AS raw_category,
                NULLIF(trim(image_url), '') AS image_url,
                coalesce(NULLIF(trim(product_url), ''), NULLIF(trim(aldi_url_slug_text), ''), NULLIF(trim(url_slug), '')) AS product_url,
                coalesce({sql_number('price_dollars')}, {sql_number('aldi_price_amount')}) AS current_price,
                {sql_number('aldi_price_was_price_display')} AS previous_price,
                {sql_number('aldi_price_amount_relevant')} AS discount_amount,
                {sql_number('aldi_price_per_unit')} AS price_per_unit,
                NULLIF(trim(aldi_quantity_unit), '') AS unit_measure,
                {sql_number('aldi_quantity_default')} AS unit_quantity,
                CASE
                    WHEN {sql_number('aldi_price_was_price_display')} > coalesce({sql_number('price_dollars')}, {sql_number('aldi_price_amount')}) THEN TRUE
                    ELSE FALSE
                END AS is_on_special,
                NULLIF(trim(aldi_badges), '') AS promotion_type,
                coalesce(NULLIF(trim(aldi_price_additional_info), ''), NULLIF(trim(aldi_price_fee_text), '')) AS offer_description,
                CASE
                    WHEN {sql_bool('aldi_not_for_sale')} IS TRUE THEN 'not_for_sale'
                    WHEN {sql_bool('aldi_discontinued')} IS TRUE THEN 'discontinued'
                    ELSE 'available'
                END AS availability,
                'product_status' AS availability_type,
                NULL AS available_quantity,
                {sql_number('aldi_quantity_max')} AS supply_limit,
                {sql_number('aldi_quantity_max')} AS product_limit,
                {sql_bool('aldi_age_restriction')} AS age_restricted,
                {sql_bool('aldi_alcohol')} AS alcohol_flag,
                {sql_bool('aldi_discontinued')} AS discontinued,
                {sql_bool('aldi_not_for_sale')} AS not_for_sale,
                coalesce(NULLIF(trim(aldi_price_currency_code), ''), 'AUD') AS currency_code,
                TRY_CAST(scraped_at AS TIMESTAMP) AS scraped_at,
                DATE '{run_date}' AS run_date,
                '{source_file_sql}' AS source_file,
                coalesce(CAST(sku AS VARCHAR), CAST(aldi_sku AS VARCHAR)) AS raw_record_id,
                raw_json AS raw_json,
                current_timestamp AS loaded_at
            FROM raw_input
        """,
    }

    return mappings[source]


def load_sql(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def execute_postgres_ddl(config: dict) -> None:
    if psycopg is None:
        raise RuntimeError(
            "psycopg is not installed in the project environment. Run `uv sync` or "
            "`uv add 'psycopg[binary]'` locally before loading data into PostgreSQL."
        )
    postgres = config["postgres"]
    with psycopg.connect(
        host=postgres["host"],
        port=postgres["port"],
        dbname=postgres["database"],
        user=postgres["user"],
        password=postgres["password"],
        autocommit=True,
    ) as conn:
        with conn.cursor() as cursor:
            cursor.execute(load_sql(SQL_DIR / "postgres_ddl.sql"))


def fetch_table_payload(
    conn: duckdb.DuckDBPyConnection,
    duck_table: str,
) -> tuple[list[tuple], list[str]]:
    rows = conn.execute(f"SELECT * FROM {duck_table}").fetchall()
    columns = [desc[0] for desc in conn.description]
    return rows, columns


def load_all_tables(
    conn: duckdb.DuckDBPyConnection,
    config: dict,
    slice_retailer: str,
    slice_run_date: str,
) -> dict[str, int]:
    if psycopg is None:
        raise RuntimeError(
            "psycopg is not installed in the project environment. Run `uv sync` or "
            "`uv add 'psycopg[binary]'` locally before loading data into PostgreSQL."
        )
    postgres = config["postgres"]
    slice_run_date_value = datetime.strptime(slice_run_date, "%Y-%m-%d").date()
    payloads: dict[str, tuple[list[tuple], list[str]]] = {
        postgres_table: fetch_table_payload(conn, duck_table)
        for duck_table, postgres_table in TABLE_LOADS
    }
    counts: dict[str, int] = {
        duck_table: len(payloads[postgres_table][0])
        for duck_table, postgres_table in TABLE_LOADS
    }

    with psycopg.connect(
        host=postgres["host"],
        port=postgres["port"],
        dbname=postgres["database"],
        user=postgres["user"],
        password=postgres["password"],
    ) as pg_conn:
        with pg_conn.cursor() as cursor:
            for _, postgres_table in TABLE_LOADS:
                full_table = f"{postgres['schema']}.{postgres_table}"
                cursor.execute(
                    f"DELETE FROM {full_table} WHERE retailer = %s AND run_date = %s",
                    (slice_retailer, slice_run_date_value),
                )

            for _, postgres_table in TABLE_LOADS:
                rows, columns = payloads[postgres_table]
                if not rows:
                    continue
                full_table = f"{postgres['schema']}.{postgres_table}"
                placeholders = ", ".join(["%s"] * len(columns))
                column_list = ", ".join(columns)
                cursor.executemany(
                    f"INSERT INTO {full_table} ({column_list}) VALUES ({placeholders})",
                    rows,
                )
    return counts


def fetch_scalar(conn: duckdb.DuckDBPyConnection, query: str) -> int:
    return int(conn.execute(query).fetchone()[0])


def main() -> None:
    load_dotenv()
    args = parse_args()
    config = load_config(args.config)

    if args.runner != "products":
        raise ValueError("Phase 1 supports only runner='products'.")

    if config.get("mode") != "local":
        raise ValueError("Only local mode is implemented in Phase 1.")

    source_file = resolve_input_path(config, args.source, args.runner, args.date)

    conn = duckdb.connect()
    conn.execute(
        "CREATE OR REPLACE TABLE raw_input AS SELECT * FROM read_csv_auto(?, header=true, all_varchar=true)",
        [str(source_file)],
    )
    conn.execute(normalize_sql(args.source, source_file, args.date))
    conn.execute(load_sql(SQL_DIR / "silver_transform.sql"))
    conn.execute(load_sql(SQL_DIR / "qa_check.sql"))

    qa_results = conn.execute(
        "SELECT check_name, passed, details FROM qa_results ORDER BY passed ASC, check_name ASC"
    ).fetchall()
    failed_checks = [row for row in qa_results if not row[1]]
    if failed_checks:
        formatted = "; ".join(f"{name}={details}" for name, _, details in failed_checks)
        raise RuntimeError(f"QA checks failed: {formatted}")

    execute_postgres_ddl(config)

    counts = {
        "raw_input": fetch_scalar(conn, "SELECT count(*) FROM raw_input"),
        "raw_input_normalized": fetch_scalar(conn, "SELECT count(*) FROM raw_input_normalized"),
    }
    counts.update(load_all_tables(conn, config, args.source.lower(), args.date))

    print("Pipeline completed successfully")
    print(f"source={args.source}")
    print(f"runner={args.runner}")
    print(f"date={args.date}")
    print(f"input_file={source_file}")
    for name, count in counts.items():
        print(f"{name}_rows={count}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Pipeline failed: {exc}", file=sys.stderr)
        raise
