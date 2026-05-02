CREATE OR REPLACE TEMP TABLE qa_results AS

-- Checks whether the summary table is empty
SELECT
    'demo_product_pricing_summary_row_count'                AS check_name,
    count(*) > 0                                            AS passed,
    count(*)::VARCHAR                                       AS details
FROM demo_product_pricing_summary

UNION ALL

-- checks if there are any invalid run dates (ex. if scraped_at is missing)
SELECT
    'demo_product_pricing_summary_run_date_present'         AS check_name,
    count(*) = 0                                            AS passed,
    count(*)::VARCHAR                                       AS details
FROM demo_product_pricing_summary
WHERE run_date IS NULL

UNION ALL

-- checks for blank retailer_id rows
SELECT
    'demo_product_pricing_summary_retailer_present'         AS check_name,
    count(*) = 0                                            AS passed,
    count(*)::VARCHAR                                       AS details
FROM demo_product_pricing_summary
WHERE retailer IS NULL
   OR trim(retailer) = ''

UNION ALL

-- checks if every group (retailer, category, recorded_at) has at least 1 product
SELECT
    'demo_product_pricing_summary_product_count_positive'   AS check_name,
    count(*) = 0                                            AS passed,
    count(*)::VARCHAR                                       AS details
FROM demo_product_pricing_summary
WHERE product_count <= 0;