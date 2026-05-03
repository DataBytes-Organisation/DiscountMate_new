CREATE OR REPLACE TEMP TABLE qa_results AS

SELECT
    'processed_data_row_count' AS check_name,
    count(*) > 0 AS passed,
    count(*)::VARCHAR AS details
FROM processed_data

UNION ALL

SELECT
    'processed_data_product_id_present',
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM processed_data
WHERE product_id IS NULL OR trim(product_id) = ''

UNION ALL

SELECT
    'processed_data_category_id_present',
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM processed_data
WHERE category_id IS NULL OR trim(category_id) = ''

UNION ALL

SELECT
    'processed_data_retailer_id_present',
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM processed_data
WHERE retailer_id IS NULL OR trim(retailer_id) = ''

UNION ALL

SELECT
    'processed_data_price_positive',
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM processed_data
WHERE price <= 0

UNION ALL

SELECT
    'processed_data_unit_price_positive',
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM processed_data
WHERE unit_price <= 0

UNION ALL

SELECT
    'processed_data_product_url_present',
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM processed_data
WHERE product_url IS NULL OR trim(product_url) = '';
