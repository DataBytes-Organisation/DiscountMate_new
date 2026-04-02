from __future__ import annotations

from pathlib import Path

from common.duckdb_utils import sql_bool, sql_number


def normalize_sql(source: str, source_file: Path, run_date: str) -> str:
    source_file_sql = str(source_file).replace("'", "''")

    mappings = {
        "coles": f"""
            CREATE OR REPLACE TABLE raw_input_normalized AS
            SELECT
                'coles' AS retailer,
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
                TRY_CAST(Timestamp AS TIMESTAMP) AS scraped_at,
                DATE '{run_date}' AS run_date,
                '{source_file_sql}' AS source_file,
                CAST(ProductId AS VARCHAR) AS raw_record_id,
                current_timestamp AS loaded_at
            FROM raw_input
        """,
        "woolworths": f"""
            CREATE OR REPLACE TABLE raw_input_normalized AS
            SELECT
                'woolworths' AS retailer,
                CAST(Stockcode AS VARCHAR) AS product_id,
                trim(coalesce(NULLIF(DisplayName, ''), NULLIF(Name, ''))) AS product_name,
                NULLIF(trim(Brand_Searched), '') AS brand_name,
                coalesce(NULLIF(trim(FullDescription), ''), NULLIF(trim(Description), '')) AS description,
                coalesce(NULLIF(trim(PackageSize), ''), NULLIF(trim(Unit), '')) AS pack_size,
                coalesce(
                    NULLIF(trim(SapSubCategoryName), ''),
                    NULLIF(trim(SapCategoryName), ''),
                    NULLIF(trim(SapDepartmentName), '')
                ) AS raw_category,
                coalesce(
                    NULLIF(trim(LargeImageFile), ''),
                    NULLIF(trim(MediumImageFile), ''),
                    NULLIF(trim(SmallImageFile), '')
                ) AS image_url,
                {sql_number('Price')} AS current_price,
                {sql_number('WasPrice')} AS previous_price,
                {sql_number('SavingsAmount')} AS discount_amount,
                {sql_number('CupPrice')} AS price_per_unit,
                NULLIF(trim(CupMeasure), '') AS unit_measure,
                NULL AS unit_quantity,
                coalesce(
                    {sql_bool('IsOnSpecial')},
                    CASE WHEN {sql_number('WasPrice')} > {sql_number('Price')} THEN TRUE ELSE FALSE END
                ) AS is_on_special,
                TRY_CAST(Timestamp AS TIMESTAMP) AS scraped_at,
                DATE '{run_date}' AS run_date,
                '{source_file_sql}' AS source_file,
                CAST(Stockcode AS VARCHAR) AS raw_record_id,
                current_timestamp AS loaded_at
            FROM raw_input
        """,
        "iga": f"""
            CREATE OR REPLACE TABLE raw_input_normalized AS
            SELECT
                'iga' AS retailer,
                coalesce(CAST(iga_product_id AS VARCHAR), CAST(sku AS VARCHAR)) AS product_id,
                trim(coalesce(NULLIF(name, ''), NULLIF(iga_name, ''))) AS product_name,
                coalesce(NULLIF(trim(brand_name), ''), NULLIF(trim(iga_brand), '')) AS brand_name,
                NULLIF(trim(iga_description), '') AS description,
                CASE
                    WHEN iga_unit_of_size_size IS NOT NULL AND iga_unit_of_size_abbreviation IS NOT NULL
                    THEN trim(CAST(iga_unit_of_size_size AS VARCHAR) || ' ' || iga_unit_of_size_abbreviation)
                    ELSE NULL
                END AS pack_size,
                coalesce(NULLIF(trim(iga_default_category), ''), NULLIF(trim(iga_categories), '')) AS raw_category,
                coalesce(NULLIF(trim(primary_image_url), ''), NULLIF(trim(iga_image_default), '')) AS image_url,
                coalesce({sql_number('price_numeric')}, {sql_number('iga_price_numeric')}) AS current_price,
                coalesce({sql_number('was_price_numeric')}, {sql_number('iga_was_price_numeric')}) AS previous_price,
                CASE
                    WHEN coalesce({sql_number('was_price_numeric')}, {sql_number('iga_was_price_numeric')}) IS NOT NULL
                     AND coalesce({sql_number('price_numeric')}, {sql_number('iga_price_numeric')}) IS NOT NULL
                    THEN coalesce({sql_number('was_price_numeric')}, {sql_number('iga_was_price_numeric')})
                       - coalesce({sql_number('price_numeric')}, {sql_number('iga_price_numeric')})
                    ELSE NULL
                END AS discount_amount,
                coalesce({sql_number('price_per_unit')}, {sql_number('iga_price_per_unit')}) AS price_per_unit,
                coalesce(
                    NULLIF(trim(iga_unit_of_measure_abbreviation), ''),
                    NULLIF(trim(iga_unit_of_measure_label), '')
                ) AS unit_measure,
                coalesce({sql_number('iga_unit_of_measure_size')}, {sql_number('iga_unit_of_size_size')}) AS unit_quantity,
                CASE
                    WHEN coalesce({sql_number('was_price_numeric')}, {sql_number('iga_was_price_numeric')})
                       > coalesce({sql_number('price_numeric')}, {sql_number('iga_price_numeric')})
                    THEN TRUE
                    ELSE FALSE
                END AS is_on_special,
                TRY_CAST(scraped_at AS TIMESTAMP) AS scraped_at,
                DATE '{run_date}' AS run_date,
                '{source_file_sql}' AS source_file,
                coalesce(CAST(iga_product_id AS VARCHAR), CAST(sku AS VARCHAR)) AS raw_record_id,
                current_timestamp AS loaded_at
            FROM raw_input
        """,
        "aldi": f"""
            CREATE OR REPLACE TABLE raw_input_normalized AS
            SELECT
                'aldi' AS retailer,
                coalesce(CAST(sku AS VARCHAR), CAST(aldi_sku AS VARCHAR)) AS product_id,
                trim(coalesce(NULLIF(name, ''), NULLIF(aldi_name, ''))) AS product_name,
                coalesce(NULLIF(trim(brand_name), ''), NULLIF(trim(aldi_brand_name), '')) AS brand_name,
                NULLIF(trim(aldi_price_additional_info), '') AS description,
                NULLIF(trim(aldi_selling_size), '') AS pack_size,
                coalesce(NULLIF(trim(category_id_from_sitemap), ''), NULLIF(trim(aldi_categories), '')) AS raw_category,
                NULLIF(trim(image_url), '') AS image_url,
                coalesce({sql_number('price_dollars')}, {sql_number('aldi_price_amount')}) AS current_price,
                {sql_number('aldi_price_was_price_display')} AS previous_price,
                {sql_number('aldi_price_amount_relevant')} AS discount_amount,
                {sql_number('aldi_price_per_unit')} AS price_per_unit,
                NULLIF(trim(aldi_quantity_unit), '') AS unit_measure,
                {sql_number('aldi_quantity_default')} AS unit_quantity,
                CASE
                    WHEN {sql_number('aldi_price_was_price_display')}
                       > coalesce({sql_number('price_dollars')}, {sql_number('aldi_price_amount')})
                    THEN TRUE
                    ELSE FALSE
                END AS is_on_special,
                TRY_CAST(scraped_at AS TIMESTAMP) AS scraped_at,
                DATE '{run_date}' AS run_date,
                '{source_file_sql}' AS source_file,
                coalesce(CAST(sku AS VARCHAR), CAST(aldi_sku AS VARCHAR)) AS raw_record_id,
                current_timestamp AS loaded_at
            FROM raw_input
        """,
    }

    return mappings[source]
