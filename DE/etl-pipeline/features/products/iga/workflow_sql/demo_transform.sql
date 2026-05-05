/*
SQL Code for cleaning and transforming the data
-- Input:  raw_input (loaded from raw CSV in job.py)
-- Output: normalized_products_base -> demo_product_pricing_summary (TESTING) OR fct_product_prices (FINAL)
*/

CREATE OR REPLACE TABLE normalized_products_base AS
WITH cleaned AS (
    SELECT
         TRY_CAST(scraped_at AS TIMESTAMP) AS recorded_at

        -- JOINED with the dim tables for product/retailer/category ID
        , p.id AS product_id
        , c.id AS category_id
        , r.id AS retailer_id

        -- Removes extra spaces from the name (like more than 1 in between the words or before and after the words) and converts it to text
        , trim(CAST(iga_name AS VARCHAR)) AS item_name

        -- Gets the promo description (ex. 20% off or DOWN DOWN or Special) from the product, but if none, then it is NULL
        , NULLIF(trim(CAST(iga_price_label AS VARCHAR)), '') AS special_text

        -- CONCATENATES the iga product url template to the product_id
        , 'https://www.igashop.com.au/product/' || CAST(iga_product_id AS VARCHAR) AS product_url

        -- gets the current price converted into a number
        , TRY_CAST(price_numeric AS DOUBLE) AS price

        -- price_per_unit: gets the number from price per unit (ex. 3.03 from $3.03 each) or does manual calculation if it's blank
        , COALESCE(
            TRY_CAST(regexp_extract(CAST(price_per_unit AS VARCHAR), '\$([0-9]+\.?[0-9]*)', 1) AS DOUBLE), round(TRY_CAST(price_numeric AS DOUBLE) / NULLIF(TRY_CAST(iga_unit_of_measure_size AS DOUBLE), 0), 3)
            )
            AS unit_price

        -- is_on_special: IGA sale prices as 'tpr' in price_source, so if tpr is the value then TRUE otherwise FALSE
        , CASE
            WHEN lower(trim(CAST(iga_price_source AS VARCHAR))) = 'tpr' THEN TRUE
            ELSE FALSE
        END AS is_on_special

        -- gets the timestamp when this code is run/when the data is uploaded
        , current_timestamp AS created_at
        FROM raw_input
        LEFT JOIN pg.silver.dim_retailers r
            ON r.retailer_name = 'IGA'
        LEFT JOIN pg.silver.dim_products p
            ON p.gtin = CAST(raw_input.iga_barcode AS VARCHAR)
        LEFT JOIN pg.silver.dim_categories c
            ON c.name = CASE
                lower(trim(
                    TRY(json_extract_string(
                        CAST(iga_categories AS VARCHAR), '$[1].category'
                    ))
                ))
                WHEN 'fruit and vegetable'    THEN 'FRUIT, VEG & PRODUCE'
                WHEN 'meat, seafood and deli' THEN 'POULTRY, MEAT & SEAFOOD'
                WHEN 'dairy, eggs and fridge' THEN 'DAIRY & REFRIGERATED'
                WHEN 'bakery'                 THEN 'BAKERY'
                WHEN 'frozen'                 THEN 'FROZEN FOODS'
                WHEN 'pantry'                 THEN 'PANTRY'
                WHEN 'drinks'                 THEN 'BEVERAGES'
                WHEN 'health and beauty'      THEN 'HEALTH & BEAUTY'
                WHEN 'household'              THEN 'HOUSEHOLD ITEMS'
                WHEN 'pet'                    THEN 'PET FOOD & ACCESSORIES'
                WHEN 'baby'                   THEN 'BABY FOOD & ACCESSORIES'
                WHEN 'liquor'                 THEN 'ALCOHOL'
                WHEN 'front of house'         THEN NULL
                WHEN 'other'                  THEN NULL
                ELSE NULL
            END
        WHERE iga_name IS NOT NULL
          AND trim(CAST(iga_name AS VARCHAR)) <> ''
          AND iga_barcode IS NOT NULL
          AND trim(CAST(iga_barcode AS VARCHAR)) <> ''

),
deduplicated AS (
    SELECT
        *
        -- If the same product appears more than once for the same date,
        -- keep only the most recently loaded version
        , row_number() OVER (
            PARTITION BY retailer_id, coalesce(product_id, item_name), recorded_at::DATE
            ORDER BY created_at DESC
        ) AS row_num
    FROM cleaned
        WHERE item_name IS NOT NULL
            AND trim(CAST(item_name AS VARCHAR)) <> ''
            AND product_id IS NOT NULL
            AND trim(CAST(product_id AS VARCHAR)) <> ''
)
SELECT
    recorded_at
    ,product_id
    ,category_id
    ,retailer_id
    ,item_name
    ,special_text
    ,product_url
    ,price
    ,unit_price
    ,is_on_special
    ,created_at
FROM deduplicated
WHERE row_num = 1;

-- Makes the summary table grouped by date, retailer, and category
-- Used by the QA checks and save

CREATE OR REPLACE TABLE demo_product_pricing_summary AS
SELECT
    recorded_at::DATE AS run_date
    ,retailer_id AS retailer
    ,category_id AS category
    ,COUNT(*) AS product_count
    ,COUNT(price) AS priced_product_count
    ,AVG(price) AS avg_current_price
    ,MIN(price) AS min_current_price
    ,MAX(price) AS max_current_price
    ,SUM(CASE WHEN is_on_special THEN 1 ELSE 0 END) AS discounted_product_count
    ,MAX(created_at) AS loaded_at
FROM normalized_products_base
GROUP BY retailer_id, category_id, recorded_at::DATE;

-- One row per product for fct_product_prices (what's actually being uploaded)
CREATE OR REPLACE TABLE fct_product_prices_staging AS
SELECT
    recorded_at
    , product_id
    , category_id
    , retailer_id
    , item_name
    , special_text
    , product_url
    , price
    , unit_price
    , is_on_special
    , created_at
FROM normalized_products_base;