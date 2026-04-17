CREATE OR REPLACE TEMP TABLE qa_results AS
SELECT
    'demo_product_pricing_summary_row_count' AS check_name,
    count(*) > 0 AS passed,
    count(*)::VARCHAR AS details
FROM demo_product_pricing_summary

UNION ALL

SELECT
    'demo_product_pricing_summary_run_date_present' AS check_name,
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM demo_product_pricing_summary
WHERE run_date IS NULL

UNION ALL

SELECT
    'demo_product_pricing_summary_retailer_present' AS check_name,
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM demo_product_pricing_summary
WHERE retailer IS NULL OR trim(retailer) = ''

UNION ALL

SELECT
    'demo_product_pricing_summary_product_count_positive' AS check_name,
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM demo_product_pricing_summary
WHERE product_count <= 0;
