-- Temporary demo transform for the reusable ETL framework.
-- This example is intentionally simple and will later be replaced by
-- fct_product_pricing, dim_products, and dim_retailers.

CREATE OR REPLACE TABLE normalized_products_base AS
WITH cleaned AS (
    SELECT
        lower(trim(CAST(retailer AS VARCHAR))) AS retailer,
        nullif(trim(CAST(product_id AS VARCHAR)), '') AS product_id,
        trim(CAST(product_name AS VARCHAR)) AS product_name,
        nullif(trim(CAST(brand_name AS VARCHAR)), '') AS brand_name,
        nullif(trim(CAST(description AS VARCHAR)), '') AS description,
        nullif(trim(CAST(pack_size AS VARCHAR)), '') AS pack_size,
        coalesce(nullif(trim(CAST(raw_category AS VARCHAR)), ''), 'uncategorized') AS raw_category,
        CASE
            WHEN raw_category IS NULL OR trim(CAST(raw_category AS VARCHAR)) = '' THEN 'uncategorized'
            ELSE lower(trim(CAST(raw_category AS VARCHAR)))
        END AS category,
        current_price,
        previous_price,
        discount_amount,
        price_per_unit,
        nullif(trim(CAST(unit_measure AS VARCHAR)), '') AS unit_measure,
        unit_quantity,
        is_on_special,
        scraped_at,
        run_date,
        source_file,
        nullif(trim(CAST(raw_record_id AS VARCHAR)), '') AS raw_record_id,
        loaded_at
    FROM raw_input_normalized
    WHERE product_name IS NOT NULL
      AND trim(CAST(product_name AS VARCHAR)) <> ''
),
deduplicated AS (
    SELECT
        *,
        row_number() OVER (
            PARTITION BY retailer, coalesce(product_id, product_name), run_date
            ORDER BY loaded_at DESC
        ) AS row_num
    FROM cleaned
)
SELECT
    retailer,
    product_id,
    product_name,
    brand_name,
    description,
    pack_size,
    category,
    current_price,
    previous_price,
    discount_amount,
    price_per_unit,
    unit_measure,
    unit_quantity,
    is_on_special,
    scraped_at,
    run_date,
    source_file,
    raw_record_id,
    loaded_at
FROM deduplicated
WHERE row_num = 1;

CREATE OR REPLACE TABLE demo_product_pricing_summary AS
SELECT
    retailer,
    run_date,
    category,
    COUNT(*) AS product_count,
    COUNT(current_price) AS priced_product_count,
    AVG(current_price) AS avg_current_price,
    MIN(current_price) AS min_current_price,
    MAX(current_price) AS max_current_price,
    SUM(CASE WHEN is_on_special THEN 1 ELSE 0 END) AS discounted_product_count,
    MAX(loaded_at) AS loaded_at
FROM normalized_products_base
GROUP BY retailer, run_date, category;
