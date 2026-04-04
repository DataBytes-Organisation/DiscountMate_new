from __future__ import annotations

from typing import TYPE_CHECKING

from common.duckdb_utils import sql_number

if TYPE_CHECKING:
    from pathlib import Path


def build_example_normalization_sql(source_file: Path, run_date: str) -> str:
    source_file_sql = str(source_file).replace("'", "''")
    return f"""
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
            {sql_number("Price_Now")} AS current_price,
            {sql_number("Price_Was")} AS previous_price,
            {sql_number("SaveAmount")} AS discount_amount,
            {sql_number("UnitPrice")} AS price_per_unit,
            NULLIF(trim(UnitMeasure), '') AS unit_measure,
            {sql_number("UnitQuantity")} AS unit_quantity,
            CASE
                WHEN {sql_number("Price_Was")} > {sql_number("Price_Now")} THEN TRUE
                ELSE FALSE
            END AS is_on_special,
            TRY_CAST(Timestamp AS TIMESTAMP) AS scraped_at,
            DATE '{run_date}' AS run_date,
            '{source_file_sql}' AS source_file,
            CAST(ProductId AS VARCHAR) AS raw_record_id,
            current_timestamp AS loaded_at
        FROM raw_input
    """
