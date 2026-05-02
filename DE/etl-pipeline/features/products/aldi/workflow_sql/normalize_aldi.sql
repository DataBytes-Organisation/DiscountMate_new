CREATE OR REPLACE TABLE aldi_silver_stage AS
WITH aldi_cleaned AS (
    SELECT
        nullif(trim(coalesce(CAST(sku AS VARCHAR), CAST(aldi_sku AS VARCHAR))), '') AS source_product_id,
        trim(CAST(name AS VARCHAR)) AS product_name,
        nullif(trim(CAST(brand_name AS VARCHAR)), '') AS brand_name,
        nullif(trim(CAST(product_url AS VARCHAR)), '') AS product_url,
        nullif(trim(CAST(image_url AS VARCHAR)), '') AS image_link_side,
        NULL::VARCHAR AS image_link_back,
        TRY_CAST(price_dollars AS DECIMAL(10, 2)) AS price,
        coalesce(
            TRY_CAST(aldi_price_comparison AS DECIMAL(12, 4)) / 100,
            TRY_CAST(regexp_extract(aldi_price_comparison_display, '\\$([0-9]+(?:\\.[0-9]+)?)', 1) AS DECIMAL(12, 4))
        ) AS unit_price,
        nullif(trim(CAST(aldi_selling_size AS VARCHAR)), '') AS pack_size,
        CASE
            WHEN TRY_CAST(
                regexp_extract(CAST(aldi_selling_size AS VARCHAR), '([0-9]+(?:\\.[0-9]+)?)', 1)
                AS DECIMAL(10, 3)
            ) > 0
            THEN TRY_CAST(
                regexp_extract(CAST(aldi_selling_size AS VARCHAR), '([0-9]+(?:\\.[0-9]+)?)', 1)
                AS DECIMAL(10, 3)
            )
            ELSE NULL
        END AS pack_quantity,
        nullif(
            lower(regexp_extract(CAST(aldi_selling_size AS VARCHAR), '(kg|g|ml|l|ea|each|pack|pk)', 1)),
            ''
        ) AS pack_uom,
        nullif(
            regexp_extract(CAST(aldi_categories AS VARCHAR), '"name": "([^"]+)"', 1),
            ''
        ) AS raw_top_category,
        coalesce(
            try_strptime(CAST(scraped_at AS VARCHAR), '%m/%d/%Y %H:%M'),
            try_strptime(CAST(scraped_at AS VARCHAR), '%Y-%m-%dT%H:%M:%S.%f'),
            TRY_CAST(scraped_at AS TIMESTAMP),
            CAST('__RUN_DATE__ 00:00:00' AS TIMESTAMP)
        ) AS recorded_at,
        CASE
            WHEN nullif(trim(CAST(aldi_price_was_price_display AS VARCHAR)), '') IS NOT NULL THEN TRUE
            WHEN nullif(trim(CAST(aldi_price_savings_display AS VARCHAR)), '') IS NOT NULL THEN TRUE
            ELSE FALSE
        END AS is_on_special,
        nullif(
            coalesce(
                nullif(trim(CAST(aldi_price_savings_display AS VARCHAR)), ''),
                nullif(trim(CAST(aldi_price_additional_info AS VARCHAR)), '')
            ),
            ''
        ) AS special_text,
        current_timestamp AS loaded_at
    FROM raw_aldi_input
),
aldi_mapped AS (
    SELECT
        *,
        CASE
            WHEN lower(raw_top_category) = 'liquor' THEN 'ALCOHOL'
            WHEN lower(raw_top_category) = 'baby' THEN 'BABY FOOD & ACCESSORIES'
            WHEN lower(raw_top_category) = 'bakery' THEN 'BAKERY'
            WHEN lower(raw_top_category) = 'drinks' THEN 'BEVERAGES'
            WHEN lower(raw_top_category) = 'dairy, eggs & fridge' THEN 'DAIRY & REFRIGERATED'
            WHEN lower(raw_top_category) = 'deli & chilled meats' THEN 'DELI & CHILLED MEALS'
            WHEN lower(raw_top_category) = 'freezer' THEN 'FROZEN FOODS'
            WHEN lower(raw_top_category) = 'fruits & vegetables' THEN 'FRUIT, VEG & PRODUCE'
            WHEN lower(raw_top_category) = 'health & beauty' THEN 'HEALTH & BEAUTY'
            WHEN lower(raw_top_category) = 'cleaning & household' THEN 'HOUSEHOLD ITEMS'
            WHEN lower(raw_top_category) = 'pantry' THEN 'PANTRY'
            WHEN lower(raw_top_category) = 'pets' THEN 'PET FOOD & ACCESSORIES'
            WHEN lower(raw_top_category) = 'meat & seafood' THEN 'POULTRY, MEAT & SEAFOOD'
            WHEN lower(raw_top_category) = 'snacks & confectionery' THEN 'SNACKS & CONFECTIONARY'
            WHEN lower(raw_top_category) = 'limited time only' THEN 'SPECIALS'
            ELSE 'MISCELLANEOUS'
        END AS standard_category_name,
        trim(regexp_replace(lower(coalesce(product_name, '')), '[^a-z0-9]+', ' ', 'g')) AS normalized_product_name,
        trim(regexp_replace(lower(coalesce(brand_name, '')), '[^a-z0-9]+', ' ', 'g')) AS normalized_brand_name
    FROM aldi_cleaned
    WHERE product_name IS NOT NULL
      AND trim(product_name) <> ''
      AND price IS NOT NULL
),
aldi_match_ready AS (
    SELECT
        *,
        trim(
            regexp_replace(
                regexp_replace(
                    regexp_replace(
                        lower(coalesce(product_name, '')),
                        '\d+\s*x\s*\d+(?:\.\d+)?\s*(kg|g|ml|l)',
                        ' ',
                        'g'
                    ),
                    '\d+(?:\.\d+)?\s*(kg|g|ml|l|pack|pk|ea|each)',
                    ' ',
                    'g'
                ),
                '[^a-z0-9]+',
                ' ',
                'g'
            )
        ) AS normalized_core_product_name,
        coalesce(
            TRY_CAST(
                nullif(
                    regexp_extract(lower(coalesce(pack_size, '')), '(\d+)\s*(pack|pk|ea|each)', 1),
                    ''
                ) AS INTEGER
            ),
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
            WHEN aldi_measure_uom = 'kg' THEN aldi_measure_value * 1000
            WHEN aldi_measure_uom = 'l' THEN aldi_measure_value * 1000
            ELSE aldi_measure_value
        END AS match_measure_value,
        CASE
            WHEN aldi_measure_uom = 'kg' THEN 'g'
            WHEN aldi_measure_uom = 'l' THEN 'ml'
            ELSE aldi_measure_uom
        END AS match_measure_uom
    FROM (
        SELECT
            *,
            coalesce(
                TRY_CAST(
                    nullif(
                        regexp_extract(lower(coalesce(pack_size, '')), '\d+\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 1),
                        ''
                    ) AS DECIMAL(10, 3)
                ),
                TRY_CAST(
                    nullif(
                        regexp_extract(lower(coalesce(pack_size, '')), '(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 1),
                        ''
                    ) AS DECIMAL(10, 3)
                ),
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
                    nullif(regexp_extract(lower(coalesce(pack_size, '')), '\d+\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 2), ''),
                    nullif(regexp_extract(lower(coalesce(pack_size, '')), '(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 2), ''),
                    nullif(regexp_extract(lower(coalesce(product_name, '')), '\d+\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 2), ''),
                    nullif(regexp_extract(lower(coalesce(product_name, '')), '(\d+(?:\.\d+)?)\s*(kg|g|ml|l)', 2), '')
                )
            ) AS aldi_measure_uom
        FROM aldi_mapped
    )
),
aldi_deduplicated AS (
    SELECT
        *,
        row_number() OVER (
            PARTITION BY coalesce(source_product_id, normalized_product_name), DATE(recorded_at)
            ORDER BY recorded_at DESC, loaded_at DESC
        ) AS row_num
    FROM aldi_match_ready
),
coles_base AS (
    SELECT DISTINCT
        trim(regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', ' ', 'g')) AS normalized_product_name,
        trim(regexp_replace(lower(coalesce(brand_name, brand, '')), '[^a-z0-9]+', ' ', 'g')) AS normalized_brand_name,
        trim(
            regexp_replace(
                regexp_replace(
                    regexp_replace(
                        lower(coalesce(name, '')),
                        '\d+\s*x\s*\d+(?:\.\d+)?\s*(kg|g|ml|l)',
                        ' ',
                        'g'
                    ),
                    '\d+(?:\.\d+)?\s*(kg|g|ml|l|pack|pk|ea|each)',
                    ' ',
                    'g'
                ),
                '[^a-z0-9]+',
                ' ',
                'g'
            )
        ) AS normalized_core_product_name,
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
        END AS match_measure_uom,
        nullif(regexp_replace(CAST(gtin AS VARCHAR), '[^0-9]', '', 'g'), '') AS gtin
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
    )
),
exact_full_candidates AS (
    SELECT
        a.source_product_id,
        c.gtin
    FROM aldi_deduplicated a
    JOIN coles_base c
        ON c.normalized_product_name = a.normalized_product_name
       AND c.normalized_brand_name = a.normalized_brand_name
    WHERE a.row_num = 1
      AND NOT (
          a.match_measure_value IS NOT NULL
          AND c.match_measure_value IS NOT NULL
          AND (
              a.match_measure_value <> c.match_measure_value
              OR a.match_measure_uom <> c.match_measure_uom
          )
      )
      AND NOT (
          a.match_pack_count IS NOT NULL
          AND c.match_pack_count IS NOT NULL
          AND a.match_pack_count <> c.match_pack_count
      )
),
exact_full_best AS (
    SELECT
        source_product_id,
        min(gtin) AS gtin
    FROM exact_full_candidates
    GROUP BY source_product_id
    HAVING count(DISTINCT gtin) = 1
),
exact_core_size_candidates AS (
    SELECT
        a.source_product_id,
        c.gtin
    FROM aldi_deduplicated a
    JOIN coles_base c
        ON c.normalized_core_product_name = a.normalized_core_product_name
       AND c.normalized_brand_name = a.normalized_brand_name
       AND a.match_measure_value IS NOT NULL
       AND c.match_measure_value = a.match_measure_value
       AND c.match_measure_uom = a.match_measure_uom
    WHERE a.row_num = 1
      AND NOT (
          a.match_pack_count IS NOT NULL
          AND c.match_pack_count IS NOT NULL
          AND a.match_pack_count <> c.match_pack_count
      )
),
exact_core_size_best AS (
    SELECT
        source_product_id,
        min(gtin) AS gtin
    FROM exact_core_size_candidates
    GROUP BY source_product_id
    HAVING count(DISTINCT gtin) = 1
),
exact_core_pack_candidates AS (
    SELECT
        a.source_product_id,
        c.gtin
    FROM aldi_deduplicated a
    JOIN coles_base c
        ON c.normalized_core_product_name = a.normalized_core_product_name
       AND c.normalized_brand_name = a.normalized_brand_name
       AND a.match_measure_value IS NULL
       AND a.match_pack_count IS NOT NULL
       AND c.match_pack_count = a.match_pack_count
    WHERE a.row_num = 1
),
exact_core_pack_best AS (
    SELECT
        source_product_id,
        min(gtin) AS gtin
    FROM exact_core_pack_candidates
    GROUP BY source_product_id
    HAVING count(DISTINCT gtin) = 1
),
coles_fuzzy_candidates AS (
    SELECT
        a.source_product_id,
        c.gtin,
        jaro_winkler_similarity(a.normalized_core_product_name, c.normalized_core_product_name) AS name_similarity,
        1 - (
            levenshtein(a.normalized_core_product_name, c.normalized_core_product_name)::DOUBLE
            / greatest(length(a.normalized_core_product_name), length(c.normalized_core_product_name), 1)
        ) AS levenshtein_ratio,
        row_number() OVER (
            PARTITION BY a.source_product_id
            ORDER BY
                CASE
                    WHEN a.match_measure_value IS NOT NULL
                     AND c.match_measure_value = a.match_measure_value
                     AND c.match_measure_uom = a.match_measure_uom
                    THEN 1 ELSE 0
                END DESC,
                CASE
                    WHEN a.match_pack_count IS NOT NULL
                     AND c.match_pack_count = a.match_pack_count
                    THEN 1 ELSE 0
                END DESC,
                jaro_winkler_similarity(a.normalized_core_product_name, c.normalized_core_product_name) DESC,
                1 - (
                    levenshtein(a.normalized_core_product_name, c.normalized_core_product_name)::DOUBLE
                    / greatest(length(a.normalized_core_product_name), length(c.normalized_core_product_name), 1)
                ) DESC
        ) AS row_num,
        lead(jaro_winkler_similarity(a.normalized_core_product_name, c.normalized_core_product_name)) OVER (
            PARTITION BY a.source_product_id
            ORDER BY
                CASE
                    WHEN a.match_measure_value IS NOT NULL
                     AND c.match_measure_value = a.match_measure_value
                     AND c.match_measure_uom = a.match_measure_uom
                    THEN 1 ELSE 0
                END DESC,
                CASE
                    WHEN a.match_pack_count IS NOT NULL
                     AND c.match_pack_count = a.match_pack_count
                    THEN 1 ELSE 0
                END DESC,
                jaro_winkler_similarity(a.normalized_core_product_name, c.normalized_core_product_name) DESC,
                1 - (
                    levenshtein(a.normalized_core_product_name, c.normalized_core_product_name)::DOUBLE
                    / greatest(length(a.normalized_core_product_name), length(c.normalized_core_product_name), 1)
                ) DESC
        ) AS next_name_similarity
    FROM aldi_deduplicated a
    JOIN coles_base c
        ON c.normalized_brand_name = a.normalized_brand_name
       AND c.normalized_brand_name <> ''
    WHERE a.row_num = 1
      AND a.normalized_core_product_name <> ''
      AND c.normalized_core_product_name <> ''
      AND (
          (
              a.match_measure_value IS NOT NULL
              AND c.match_measure_value = a.match_measure_value
              AND c.match_measure_uom = a.match_measure_uom
          )
          OR (
              a.match_pack_count IS NOT NULL
              AND c.match_pack_count = a.match_pack_count
          )
      )
),
coles_fuzzy_best AS (
    SELECT
        source_product_id,
        gtin
    FROM coles_fuzzy_candidates
    WHERE row_num = 1
      AND name_similarity >= 0.92
      AND levenshtein_ratio >= 0.68
      AND coalesce(name_similarity - next_name_similarity, 0.03) >= 0.03
)
SELECT
    a.source_product_id,
    a.product_name,
    a.brand_name,
    CASE
        WHEN length(fx.gtin) <= 14 THEN fx.gtin
        WHEN length(cs.gtin) <= 14 THEN cs.gtin
        WHEN length(cp.gtin) <= 14 THEN cp.gtin
        WHEN length(fz.gtin) <= 14 THEN fz.gtin
        ELSE NULL
    END AS gtin,
    a.standard_category_name,
    a.pack_quantity,
    a.pack_uom,
    a.price,
    a.unit_price,
    a.image_link_side,
    a.image_link_back,
    a.recorded_at,
    a.product_name AS item_name,
    a.special_text,
    a.product_url,
    a.is_on_special
FROM aldi_deduplicated a
LEFT JOIN exact_full_best fx
    ON fx.source_product_id = a.source_product_id
LEFT JOIN exact_core_size_best cs
    ON cs.source_product_id = a.source_product_id
LEFT JOIN exact_core_pack_best cp
    ON cp.source_product_id = a.source_product_id
LEFT JOIN coles_fuzzy_best fz
    ON fz.source_product_id = a.source_product_id
WHERE a.row_num = 1;
