-- Shared Silver transform.
-- Assumes `raw_input_normalized` already exists and contains retailer-agnostic columns.

CREATE OR REPLACE TABLE silver_base AS
WITH cleaned AS (
    SELECT
        lower(trim(CAST(retailer AS VARCHAR))) AS retailer,
        nullif(trim(CAST(product_id AS VARCHAR)), '') AS product_id,
        nullif(trim(CAST(store_id AS VARCHAR)), '') AS store_id,
        trim(CAST(product_name AS VARCHAR)) AS product_name,
        nullif(trim(CAST(brand_name AS VARCHAR)), '') AS brand_name,
        nullif(trim(CAST(description AS VARCHAR)), '') AS description,
        nullif(trim(CAST(pack_size AS VARCHAR)), '') AS pack_size,
        coalesce(nullif(trim(CAST(raw_category AS VARCHAR)), ''), 'uncategorized') AS raw_category,
        CASE
            WHEN raw_category IS NULL OR trim(CAST(raw_category AS VARCHAR)) = '' THEN 'uncategorized'
            ELSE lower(trim(CAST(raw_category AS VARCHAR)))
        END AS category,
        nullif(trim(CAST(image_url AS VARCHAR)), '') AS image_url,
        nullif(trim(CAST(product_url AS VARCHAR)), '') AS product_url,
        current_price,
        previous_price,
        discount_amount,
        price_per_unit,
        nullif(trim(CAST(unit_measure AS VARCHAR)), '') AS unit_measure,
        unit_quantity,
        is_on_special,
        nullif(trim(CAST(promotion_type AS VARCHAR)), '') AS promotion_type,
        nullif(trim(CAST(offer_description AS VARCHAR)), '') AS offer_description,
        nullif(trim(CAST(availability AS VARCHAR)), '') AS availability,
        nullif(trim(CAST(availability_type AS VARCHAR)), '') AS availability_type,
        available_quantity,
        supply_limit,
        product_limit,
        age_restricted,
        alcohol_flag,
        discontinued,
        not_for_sale,
        upper(coalesce(nullif(trim(CAST(currency_code AS VARCHAR)), ''), 'AUD')) AS currency_code,
        scraped_at,
        run_date,
        source_file,
        nullif(trim(CAST(raw_record_id AS VARCHAR)), '') AS raw_record_id,
        raw_json,
        loaded_at
    FROM raw_input_normalized
    WHERE product_name IS NOT NULL
      AND trim(CAST(product_name AS VARCHAR)) <> ''
),
deduplicated AS (
    SELECT *,
        row_number() OVER (
            PARTITION BY retailer, coalesce(product_id, product_name), coalesce(scraped_at, loaded_at)
            ORDER BY loaded_at DESC
        ) AS row_num
    FROM cleaned
)
SELECT
    retailer,
    product_id,
    store_id,
    product_name,
    brand_name,
    description,
    pack_size,
    raw_category,
    category,
    image_url,
    product_url,
    current_price,
    previous_price,
    discount_amount,
    price_per_unit,
    unit_measure,
    unit_quantity,
    is_on_special,
    promotion_type,
    offer_description,
    availability,
    availability_type,
    available_quantity,
    supply_limit,
    product_limit,
    age_restricted,
    alcohol_flag,
    discontinued,
    not_for_sale,
    currency_code,
    scraped_at,
    run_date,
    source_file,
    raw_record_id,
    raw_json,
    loaded_at
FROM deduplicated
WHERE row_num = 1;

CREATE OR REPLACE TABLE silver_products_core AS
SELECT
    retailer,
    product_id,
    store_id,
    product_name,
    brand_name,
    description,
    pack_size,
    category,
    image_url,
    product_url,
    scraped_at,
    run_date,
    source_file,
    raw_record_id,
    loaded_at
FROM silver_base;

CREATE OR REPLACE TABLE silver_product_pricing AS
SELECT
    retailer,
    product_id,
    current_price,
    previous_price,
    discount_amount,
    price_per_unit,
    unit_measure,
    unit_quantity,
    is_on_special,
    promotion_type,
    offer_description,
    currency_code,
    scraped_at,
    run_date,
    source_file,
    raw_record_id,
    loaded_at
FROM silver_base
WHERE current_price IS NOT NULL
  AND current_price >= 0;

CREATE OR REPLACE TABLE silver_product_availability AS
SELECT
    retailer,
    product_id,
    availability,
    availability_type,
    available_quantity,
    supply_limit,
    product_limit,
    age_restricted,
    alcohol_flag,
    discontinued,
    not_for_sale,
    scraped_at,
    run_date,
    source_file,
    raw_record_id,
    loaded_at
FROM silver_base;

CREATE OR REPLACE TABLE silver_product_extended AS
SELECT
    retailer,
    product_id,
    store_id,
    raw_category,
    source_file,
    raw_record_id,
    raw_json,
    scraped_at,
    run_date,
    loaded_at
FROM silver_base;
