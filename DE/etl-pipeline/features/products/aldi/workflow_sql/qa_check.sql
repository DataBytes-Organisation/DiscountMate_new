CREATE OR REPLACE TEMP TABLE qa_results AS
WITH aldi_parsed AS (
    SELECT
        s.*,
        coalesce(
            CASE
                WHEN lower(coalesce(pack_uom, '')) IN ('pack', 'pk', 'ea', 'each')
                THEN TRY_CAST(pack_quantity AS INTEGER)
                ELSE NULL
            END,
            TRY_CAST(
                nullif(
                    regexp_extract(lower(coalesce(product_name, '')), '(\d+)\s*x\s*\d+(?:\.\d+)?\s*(kg|g|ml|l)', 1),
                    ''
                ) AS INTEGER
            ),
            TRY_CAST(
                nullif(
                    regexp_extract(lower(coalesce(product_name, '')), '(\d+)\s*(pack|pk|ea|each)', 1),
                    ''
                ) AS INTEGER
            )
        ) AS match_pack_count,
        CASE
            WHEN structured_measure_uom = 'kg' THEN structured_measure_value * 1000
            WHEN structured_measure_uom = 'l' THEN structured_measure_value * 1000
            WHEN structured_measure_uom IS NOT NULL THEN structured_measure_value
            WHEN aldi_measure_uom = 'kg' THEN aldi_measure_value * 1000
            WHEN aldi_measure_uom = 'l' THEN aldi_measure_value * 1000
            ELSE aldi_measure_value
        END AS match_measure_value,
        CASE
            WHEN structured_measure_uom = 'kg' THEN 'g'
            WHEN structured_measure_uom = 'l' THEN 'ml'
            WHEN structured_measure_uom IS NOT NULL THEN structured_measure_uom
            WHEN aldi_measure_uom = 'kg' THEN 'g'
            WHEN aldi_measure_uom = 'l' THEN 'ml'
            ELSE aldi_measure_uom
        END AS match_measure_uom
    FROM (
        SELECT
            s.*,
            CASE
                WHEN lower(coalesce(pack_uom, '')) IN ('kg', 'g', 'ml', 'l')
                THEN TRY_CAST(pack_quantity AS DECIMAL(10, 3))
                ELSE NULL
            END AS structured_measure_value,
            CASE
                WHEN lower(coalesce(pack_uom, '')) IN ('kg', 'g', 'ml', 'l')
                THEN lower(pack_uom)
                ELSE NULL
            END AS structured_measure_uom,
            coalesce(
                TRY_CAST(
                    nullif(
                        regexp_extract(lower(coalesce(product_name, '')), '\d+\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 1),
                        ''
                    ) AS DECIMAL(10, 3)
                ),
                TRY_CAST(
                    nullif(
                        regexp_extract(lower(coalesce(product_name, '')), '(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 1),
                        ''
                    ) AS DECIMAL(10, 3)
                )
            ) AS aldi_measure_value,
            lower(
                coalesce(
                    nullif(regexp_extract(lower(coalesce(product_name, '')), '\d+\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 2), ''),
                    nullif(regexp_extract(lower(coalesce(product_name, '')), '(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 2), '')
                )
            ) AS aldi_measure_uom
        FROM aldi_silver_stage s
    ) s
),
coles_parsed AS (
    SELECT
        gtin,
        min(name) AS name,
        min(coalesce(brand_name, brand)) AS brand_name,
        min(match_pack_count) AS match_pack_count,
        min(match_measure_value) AS match_measure_value,
        min(match_measure_uom) AS match_measure_uom
    FROM (
        SELECT
            nullif(regexp_replace(CAST(gtin AS VARCHAR), '[^0-9]', '', 'g'), '') AS gtin,
            name,
            brand_name,
            brand,
            coalesce(
                TRY_CAST(
                    nullif(
                        regexp_extract(lower(coalesce(size, '')), '(\d+)\s*(pack|pk|ea|each)', 1),
                        ''
                    ) AS INTEGER
                ),
                TRY_CAST(
                    nullif(
                        regexp_extract(lower(coalesce(name, '')), '(\d+)\s*x\s*\d+(?:\.\d+)?\s*(kg|g|ml|l)', 1),
                        ''
                    ) AS INTEGER
                ),
                TRY_CAST(
                    nullif(
                        regexp_extract(lower(coalesce(name, '')), '(\d+)\s*(pack|pk|ea|each)', 1),
                        ''
                    ) AS INTEGER
                )
            ) AS match_pack_count,
            CASE
                WHEN coles_measure_uom = 'kg' THEN coles_measure_value * 1000
                WHEN coles_measure_uom = 'l' THEN coles_measure_value * 1000
                ELSE coles_measure_value
            END AS match_measure_value,
            CASE
                WHEN coles_measure_uom = 'kg' THEN 'g'
                WHEN coles_measure_uom = 'l' THEN 'ml'
                ELSE coles_measure_uom
            END AS match_measure_uom
        FROM (
            SELECT
                *,
                coalesce(
                    TRY_CAST(
                        nullif(
                            regexp_extract(lower(coalesce(size, '')), '\d+\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 1),
                            ''
                        ) AS DECIMAL(10, 3)
                    ),
                    TRY_CAST(
                        nullif(
                            regexp_extract(lower(coalesce(size, '')), '(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 1),
                            ''
                        ) AS DECIMAL(10, 3)
                    ),
                    TRY_CAST(
                        nullif(
                            regexp_extract(lower(coalesce(name, '')), '\d+\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 1),
                            ''
                        ) AS DECIMAL(10, 3)
                    ),
                    TRY_CAST(
                        nullif(
                            regexp_extract(lower(coalesce(name, '')), '(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 1),
                            ''
                        ) AS DECIMAL(10, 3)
                    )
                ) AS coles_measure_value,
                lower(
                    coalesce(
                        nullif(regexp_extract(lower(coalesce(size, '')), '\d+\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 2), ''),
                        nullif(regexp_extract(lower(coalesce(size, '')), '(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 2), ''),
                        nullif(regexp_extract(lower(coalesce(name, '')), '\d+\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 2), ''),
                        nullif(regexp_extract(lower(coalesce(name, '')), '(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 2), '')
                    )
                ) AS coles_measure_uom
            FROM raw_coles_master
            WHERE nullif(regexp_replace(CAST(gtin AS VARCHAR), '[^0-9]', '', 'g'), '') IS NOT NULL
        ) c
    ) c
    GROUP BY gtin
),
matched_validation AS (
    SELECT
        a.source_product_id,
        a.product_name,
        a.brand_name,
        a.gtin,
        a.match_pack_count AS aldi_pack_count,
        a.match_measure_value AS aldi_measure_value,
        a.match_measure_uom AS aldi_measure_uom,
        c.match_pack_count AS coles_pack_count,
        c.match_measure_value AS coles_measure_value,
        c.match_measure_uom AS coles_measure_uom
    FROM aldi_parsed a
    LEFT JOIN coles_parsed c
        ON c.gtin = a.gtin
    WHERE a.gtin IS NOT NULL
)
SELECT
    'aldi_stage_row_count' AS check_name,
    count(*) > 0 AS passed,
    count(*)::VARCHAR AS details
FROM aldi_silver_stage

UNION ALL

SELECT
    'aldi_stage_product_name_present' AS check_name,
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM aldi_silver_stage
WHERE product_name IS NULL OR trim(product_name) = ''

UNION ALL

SELECT
    'aldi_stage_category_present' AS check_name,
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM aldi_silver_stage
WHERE standard_category_name IS NULL OR trim(standard_category_name) = ''

UNION ALL

SELECT
    'aldi_stage_recorded_at_present' AS check_name,
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM aldi_silver_stage
WHERE recorded_at IS NULL

UNION ALL

SELECT
    'aldi_stage_price_present' AS check_name,
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM aldi_silver_stage
WHERE price IS NULL

UNION ALL

SELECT
    'aldi_gtin_size_conflicts_absent' AS check_name,
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM matched_validation
WHERE aldi_measure_value IS NOT NULL
  AND coles_measure_value IS NOT NULL
  AND (
      aldi_measure_value <> coles_measure_value
      OR aldi_measure_uom <> coles_measure_uom
  )

UNION ALL

SELECT
    'aldi_gtin_pack_conflicts_absent' AS check_name,
    count(*) = 0 AS passed,
    count(*)::VARCHAR AS details
FROM matched_validation
WHERE aldi_pack_count IS NOT NULL
  AND coles_pack_count IS NOT NULL
  AND aldi_pack_count <> coles_pack_count

UNION ALL

SELECT
    'aldi_expected_match_cadbury_bar' AS check_name,
    count(*) = 1 AS passed,
    count(*)::VARCHAR AS details
FROM aldi_silver_stage
WHERE product_name = 'Dairy Milk Chocolate Bar 50g'
  AND brand_name = 'CADBURY'
  AND gtin IS NOT NULL

UNION ALL

SELECT
    'aldi_expected_match_dare_espresso' AS check_name,
    count(*) = 1 AS passed,
    count(*)::VARCHAR AS details
FROM aldi_silver_stage
WHERE product_name = 'Iced Coffee Double Espresso 750ml'
  AND brand_name = 'DARE'
  AND gtin IS NOT NULL

UNION ALL

SELECT
    'aldi_expected_match_three_threes_apple_sauce' AS check_name,
    count(*) = 1 AS passed,
    count(*)::VARCHAR AS details
FROM aldi_silver_stage
WHERE product_name = 'Apple Sauce 250g'
  AND brand_name = 'THREE THREES'
  AND gtin IS NOT NULL

UNION ALL

SELECT
    'aldi_expected_unmatched_bega_755g' AS check_name,
    count(*) = 1 AS passed,
    count(*)::VARCHAR AS details
FROM aldi_silver_stage
WHERE product_name = 'Smooth Peanut Butter 755g'
  AND brand_name = 'BEGA'
  AND gtin IS NULL

UNION ALL

SELECT
    'aldi_expected_unmatched_moro_500ml' AS check_name,
    count(*) = 1 AS passed,
    count(*)::VARCHAR AS details
FROM aldi_silver_stage
WHERE product_name = 'Extra Virgin Olive Oil 500ml'
  AND brand_name = 'MORO'
  AND gtin IS NULL;
