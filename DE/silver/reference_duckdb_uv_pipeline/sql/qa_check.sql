CREATE OR REPLACE TEMP TABLE qa_results AS
WITH duplicate_pricing AS (
    SELECT count(*) AS failure_count
    FROM (
        SELECT retailer, product_id, run_date, scraped_at
        FROM silver_product_pricing
        WHERE product_id IS NOT NULL
        GROUP BY 1, 2, 3, 4
        HAVING count(*) > 1
    )
),
duplicate_core AS (
    SELECT count(*) AS failure_count
    FROM (
        SELECT retailer, coalesce(product_id, product_name), run_date, scraped_at
        FROM silver_products_core
        GROUP BY 1, 2, 3, 4
        HAVING count(*) > 1
    )
)
SELECT
    'products_core_row_count' AS check_name,
    count(*) > 0 AS passed,
    count(*)::VARCHAR AS details
FROM silver_products_core

UNION ALL

SELECT
    'products_core_product_name_not_null' AS check_name,
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM silver_products_core
WHERE product_name IS NULL OR trim(product_name) = ''

UNION ALL

SELECT
    'product_pricing_row_count' AS check_name,
    count(*) > 0 AS passed,
    count(*)::VARCHAR AS details
FROM silver_product_pricing

UNION ALL

SELECT
    'product_pricing_current_price_valid' AS check_name,
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM silver_product_pricing
WHERE current_price IS NULL OR current_price < 0

UNION ALL

SELECT
    'products_core_run_date_present' AS check_name,
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM silver_products_core
WHERE run_date IS NULL

UNION ALL

SELECT
    'products_core_no_duplicates' AS check_name,
    failure_count = 0 AS passed,
    failure_count::VARCHAR AS details
FROM duplicate_core

UNION ALL

SELECT
    'product_pricing_no_duplicates' AS check_name,
    failure_count = 0 AS passed,
    failure_count::VARCHAR AS details
FROM duplicate_pricing

UNION ALL

SELECT
    'product_extended_source_lineage' AS check_name,
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM silver_product_extended
WHERE source_file IS NULL OR trim(source_file) = ''

UNION ALL

SELECT
    'product_extended_run_date_present' AS check_name,
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM silver_product_extended
WHERE run_date IS NULL

UNION ALL

SELECT
    'availability_retailer_present' AS check_name,
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM silver_product_availability
WHERE retailer IS NULL OR trim(retailer) = '';
