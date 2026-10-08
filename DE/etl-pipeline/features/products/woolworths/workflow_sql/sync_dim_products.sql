MERGE INTO {{ dim_products_table }} AS target
USING (
    WITH retailer_woolworths AS (
        SELECT id AS retailer_id
        FROM {{ dim_retailers_table }}
        WHERE retailer_name = 'woolworths'
    ),
    latest_products AS (
        SELECT
            raw.source_product_key,
            raw.canonical_key,
            raw.brand_name_key,
            raw.canonical_product_name_key,
            categories.id AS category_id,
            raw.standardized_product_name AS product_name,
            raw.brand_name,
            raw.match_gtin AS gtin,
            CAST(raw.pack_quantity AS DECIMAL(10, 3)) AS pack_quantity,
            lower(raw.pack_uom) AS pack_uom,
            raw.image_link_side,
            row_number() OVER (
                PARTITION BY raw.source_product_key
                ORDER BY raw.recorded_at DESC, raw.source_file DESC, raw.item_name DESC
            ) AS product_rank
        FROM raw_input_normalized AS raw
        INNER JOIN {{ dim_categories_table }} AS categories
            ON categories.category_name = raw.category_name
    ),

    touched_products AS (
        SELECT
            source_product_key,
            canonical_key,
            brand_name_key,
            canonical_product_name_key,
            category_id,
            product_name,
            brand_name,
            gtin,
            pack_quantity,
            pack_uom,
            image_link_side
        FROM latest_products
        WHERE product_rank = 1
    ),

    existing_products_base AS (
        SELECT
            products.id AS product_id,
            products.gtin,
            products.product_name,
            products.brand_name,
            CAST(products.pack_quantity AS DECIMAL(10, 3)) AS pack_quantity,
            lower(products.pack_uom) AS pack_uom,
            trim(regexp_replace(lower(coalesce(products.brand_name, '')), '[^a-z0-9]+', ' ', 'g')) AS brand_name_key,
            trim(regexp_replace(lower(coalesce(products.product_name, '')), '[^a-z0-9]+', ' ', 'g')) AS product_name_key
        FROM {{ dim_products_table }} AS products
    ),

    existing_products_brand_stripped AS (
        SELECT
            *,
            CASE
                WHEN brand_name_key <> ''
                 AND (product_name_key = brand_name_key OR product_name_key LIKE brand_name_key || ' %')
                THEN trim(substr(product_name_key, length(brand_name_key) + 1))
                ELSE product_name_key
            END AS stripped_product_name_key
        FROM existing_products_base
    ),

    existing_products_measure_stripped AS (
        SELECT
            *,
            trim(
                regexp_replace(
                    regexp_replace(
                        regexp_replace(
                            regexp_replace(
                                stripped_product_name_key,
                                '[0-9]+[[:space:]]*x[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*(ml|l|g|kg)',
                                ' ', 'g'
                            ),
                            '[0-9]+([.][0-9]+)?[[:space:]]*(ml|l|g|kg)',
                            ' ', 'g'
                        ),
                        '[0-9]+[[:space:]]*(pk|pack)',
                        ' ', 'g'
                    ),
                    '(^|[[:space:]])(each|ea)($|[[:space:]])',
                    ' ', 'g'
                )
            ) AS canonical_product_name_key
        FROM existing_products_brand_stripped
    ),

    existing_products_normalized AS (
        SELECT
            *,
            brand_name_key || '|'
            || trim(regexp_replace(canonical_product_name_key, '[[:space:]]+', ' ', 'g')) || '|'
            || CASE
                WHEN pack_quantity IS NULL THEN ''
                ELSE rtrim(regexp_replace(printf('%.3f', pack_quantity), '0+$', ''), '.')
               END || '|'
            || coalesce(pack_uom, '') AS canonical_key
        FROM existing_products_measure_stripped
    ),

    -- 1) Exact GTIN match. GTIN always has first priority.
    gtin_matches AS (
        SELECT
            incoming.source_product_key,
            min(existing.product_id) AS product_id
        FROM touched_products AS incoming
        INNER JOIN existing_products_normalized AS existing
            ON incoming.gtin IS NOT NULL
           AND existing.gtin = incoming.gtin
        GROUP BY incoming.source_product_key
    ),

    -- 2) Exact canonical match, only when GTIN did not resolve the product.
    canonical_matches AS (
        SELECT
            incoming.source_product_key,
            min(existing.product_id) AS product_id
        FROM touched_products AS incoming
        INNER JOIN existing_products_normalized AS existing
            ON existing.canonical_key = incoming.canonical_key
           AND (
                incoming.gtin IS NULL
                OR existing.gtin IS NULL
                OR existing.gtin = incoming.gtin
           )
        LEFT JOIN gtin_matches
            USING (source_product_key)
        WHERE gtin_matches.product_id IS NULL
        GROUP BY incoming.source_product_key
    ),

    -- 3) Only exact-unmatched products reach fuzzy matching.
    fuzzy_candidate_source AS (
        SELECT incoming.*
        FROM touched_products AS incoming
        LEFT JOIN gtin_matches USING (source_product_key)
        LEFT JOIN canonical_matches USING (source_product_key)
        WHERE gtin_matches.product_id IS NULL
          AND canonical_matches.product_id IS NULL
          AND incoming.pack_quantity IS NOT NULL
          AND incoming.pack_uom IS NOT NULL
    ),

    fuzzy_candidates_base AS (
        SELECT
            incoming.source_product_key,
            existing.product_id,
            incoming.canonical_key AS incoming_canonical_key,
            existing.canonical_key AS existing_canonical_key,
            incoming.canonical_product_name_key AS incoming_name_key,
            existing.canonical_product_name_key AS existing_name_key,
            incoming.brand_name_key AS incoming_brand_key,
            existing.brand_name_key AS existing_brand_key,

            jaro_winkler_similarity(
                incoming.canonical_product_name_key,
                existing.canonical_product_name_key
            ) AS name_similarity,

            CASE
                WHEN incoming.brand_name_key = '' OR existing.brand_name_key = '' THEN NULL
                ELSE jaro_winkler_similarity(incoming.brand_name_key, existing.brand_name_key)
            END AS brand_similarity

        FROM fuzzy_candidate_source AS incoming
        INNER JOIN existing_products_normalized AS existing
            ON incoming.pack_quantity = existing.pack_quantity
           AND lower(incoming.pack_uom) = lower(existing.pack_uom)

           -- Do not fuzzy-merge two different known GTINs.
           AND (
                incoming.gtin IS NULL
                OR existing.gtin IS NULL
                OR incoming.gtin = existing.gtin
           )

           -- Broad candidate blocking only; final thresholds are below.
           AND (
                (
                    incoming.brand_name_key <> ''
                    AND existing.brand_name_key <> ''
                    AND jaro_winkler_similarity(
                        incoming.brand_name_key,
                        existing.brand_name_key
                    ) >= 0.80
                )
                OR
                jaro_winkler_similarity(
                    incoming.canonical_product_name_key,
                    existing.canonical_product_name_key
                ) >= 0.60
           )
    ),

    fuzzy_candidates AS (
        SELECT
            *,
            CASE
                WHEN brand_similarity IS NULL THEN name_similarity
                ELSE (name_similarity * 0.80) + (brand_similarity * 0.20)
            END AS confidence_score
        FROM fuzzy_candidates_base
    ),

    fuzzy_ranked AS (
        SELECT
            *,
            row_number() OVER (
                PARTITION BY source_product_key
                ORDER BY confidence_score DESC, product_id
            ) AS match_rank,
            lead(confidence_score) OVER (
                PARTITION BY source_product_key
                ORDER BY confidence_score DESC, product_id
            ) AS runner_up_score
        FROM fuzzy_candidates
    ),

    fuzzy_best_matches AS (
        SELECT
            source_product_key,
            product_id,
            confidence_score,
            runner_up_score,
            confidence_score - coalesce(runner_up_score, 0) AS score_margin,
            CASE
            WHEN confidence_score >= 0.98
                THEN 'HIGH'
        
            WHEN confidence_score >= 0.92
             AND (
                    runner_up_score IS NULL
                    OR confidence_score - runner_up_score >= 0.03
                 )
                THEN 'HIGH'
            WHEN confidence_score >= 0.80
                THEN 'MEDIUM'
            ELSE 'LOW'
        END AS confidence_band
        FROM fuzzy_ranked
        WHERE match_rank = 1
    ),

    -- HIGH confidence is safe enough for automatic merge.
    fuzzy_high_matches AS (
        SELECT source_product_key, product_id
        FROM fuzzy_best_matches
        WHERE confidence_band = 'HIGH'
    ),

    -- MEDIUM are deliberately held for review, not inserted as new products.
    -- LOW matches and products with no fuzzy candidate are treated as new-product candidates.
    new_product_candidates AS (
        SELECT incoming.*
        FROM touched_products AS incoming
        LEFT JOIN gtin_matches USING (source_product_key)
        LEFT JOIN canonical_matches USING (source_product_key)
        LEFT JOIN fuzzy_best_matches USING (source_product_key)
        WHERE gtin_matches.product_id IS NULL
        AND canonical_matches.product_id IS NULL
        AND (
                fuzzy_best_matches.product_id IS NULL
                OR fuzzy_best_matches.confidence_band = 'LOW'
            )
    ),

    unresolved_products AS (
        SELECT
            source_product_key,
            coalesce(gtin, canonical_key) AS insert_identity_key
        FROM new_product_candidates
    ),

    new_product_ids AS (
        SELECT
            insert_identity_key,
            uuid() AS product_id
        FROM (
            SELECT DISTINCT insert_identity_key
            FROM unresolved_products
        )
    ),

    canonical_products AS (
        SELECT
            coalesce(
                gtin_matches.product_id,
                canonical_matches.product_id,
                fuzzy_high_matches.product_id,
                new_product_ids.product_id
            ) AS product_id,
            touched_products.source_product_key,
            touched_products.category_id,
            touched_products.product_name,
            touched_products.brand_name,
            touched_products.gtin,
            touched_products.pack_quantity,
            touched_products.pack_uom,
            touched_products.image_link_side
        FROM touched_products
        LEFT JOIN gtin_matches USING (source_product_key)
        LEFT JOIN canonical_matches USING (source_product_key)
        LEFT JOIN fuzzy_high_matches USING (source_product_key)
        LEFT JOIN unresolved_products USING (source_product_key)
        LEFT JOIN new_product_ids USING (insert_identity_key)
        WHERE coalesce(
            gtin_matches.product_id,
            canonical_matches.product_id,
            fuzzy_high_matches.product_id,
            new_product_ids.product_id
        ) IS NOT NULL
    ),

    product_gtin_resolution AS (
        SELECT
            canonical_products.product_id,
            CASE
                WHEN count(DISTINCT products.gtin) FILTER (WHERE products.gtin IS NOT NULL) = 1
                    THEN max(products.gtin) FILTER (WHERE products.gtin IS NOT NULL)
                WHEN count(DISTINCT canonical_products.gtin) FILTER (WHERE canonical_products.gtin IS NOT NULL) = 1
                    THEN max(canonical_products.gtin) FILTER (WHERE canonical_products.gtin IS NOT NULL)
                ELSE NULL
            END AS resolved_gtin
        FROM canonical_products
        LEFT JOIN {{ dim_products_table }} AS products
            ON products.id = canonical_products.product_id
        GROUP BY canonical_products.product_id
    ),
    raw_observations AS (
        SELECT
            raw.source_product_key,
            categories.id AS category_id,
            CAST(raw.recorded_at AS TIMESTAMPTZ) AS recorded_at,
            raw.item_name,
            CAST(raw.price AS DECIMAL(10, 2)) AS price,
            CAST(raw.unit_price AS DECIMAL(12, 4)) AS unit_price,
            raw.source_file
        FROM raw_input_normalized AS raw
        INNER JOIN {{ dim_categories_table }} AS categories
            ON categories.category_name = raw.category_name
    ),
    pending_observations AS (
        SELECT
            canonical_products.product_id,
            raw_observations.category_id,
            retailer.retailer_id,
            raw_observations.recorded_at,
            raw_observations.price,
            raw_observations.unit_price,
            row_number() OVER (
                PARTITION BY
                    retailer.retailer_id,
                    canonical_products.product_id,
                    raw_observations.recorded_at,
                    raw_observations.item_name,
                    raw_observations.price,
                    raw_observations.unit_price
                ORDER BY raw_observations.source_file DESC, raw_observations.item_name DESC
            ) AS dedupe_rank,
            row_number() OVER (
                PARTITION BY
                    canonical_products.product_id,
                    raw_observations.recorded_at
                ORDER BY raw_observations.source_file DESC, raw_observations.item_name DESC
            ) AS source_order
        FROM raw_observations
        INNER JOIN canonical_products
            USING (source_product_key)
        CROSS JOIN retailer_woolworths AS retailer
    ),
    existing_price_history AS (
        SELECT
            facts.product_id,
            facts.category_id,
            facts.price,
            facts.unit_price,
            facts.recorded_at,
            facts.created_at,
            0 AS source_order
        FROM {{ fct_product_prices_table }} AS facts
        INNER JOIN canonical_products
            ON canonical_products.product_id = facts.product_id
        CROSS JOIN retailer_woolworths AS retailer
        WHERE facts.retailer_id = retailer.retailer_id
    ),
    combined_price_history AS (
        SELECT
            product_id,
            category_id,
            price,
            unit_price,
            recorded_at,
            current_timestamp AS created_at,
            source_order
        FROM pending_observations
        WHERE dedupe_rank = 1
        UNION ALL
        SELECT
            product_id,
            category_id,
            price,
            unit_price,
            recorded_at,
            created_at,
            source_order
        FROM existing_price_history
    ),
    ranked_prices AS (
        SELECT
            product_id,
            category_id,
            price,
            unit_price,
            row_number() OVER (
                PARTITION BY product_id
                ORDER BY recorded_at DESC, created_at DESC, source_order DESC
            ) AS price_rank
        FROM combined_price_history
    ),
    latest_categories AS (
        SELECT
            product_id,
            category_id AS latest_category_id
        FROM ranked_prices
        WHERE price_rank = 1
    ),
    price_snapshots AS (
        SELECT
            ranked_prices.product_id,
            latest_categories.latest_category_id,
            max(price) FILTER (WHERE price_rank = 1) AS price_current_woolworths,
            max(price) FILTER (WHERE price_rank = 2) AS price_last_woolworths,
            max(unit_price) FILTER (WHERE price_rank = 1) AS unit_price_current_woolworths,
            max(unit_price) FILTER (WHERE price_rank = 2) AS unit_price_last_woolworths
        FROM ranked_prices
        INNER JOIN latest_categories
            ON latest_categories.product_id = ranked_prices.product_id
        WHERE price_rank <= 2
        GROUP BY
            ranked_prices.product_id,
            latest_categories.latest_category_id
    ),
    merged_source AS (
        SELECT
            canonical_products.product_id,
            coalesce(
                price_snapshots.latest_category_id,
                canonical_products.category_id
            ) AS category_id,
            canonical_products.product_name,
            canonical_products.brand_name,
            product_gtin_resolution.resolved_gtin AS gtin,
            canonical_products.pack_quantity,
            canonical_products.pack_uom,
            price_snapshots.price_current_woolworths,
            price_snapshots.price_last_woolworths,
            price_snapshots.unit_price_current_woolworths,
            price_snapshots.unit_price_last_woolworths,
            canonical_products.image_link_side,
            row_number() OVER (
                PARTITION BY canonical_products.product_id
                ORDER BY canonical_products.source_product_key DESC
            ) AS source_rank,
            row_number() OVER (
                PARTITION BY
                    coalesce(lower(canonical_products.brand_name), ''),
                    lower(canonical_products.product_name),
                    coalesce(canonical_products.pack_quantity, -1),
                    coalesce(lower(canonical_products.pack_uom), '')
                ORDER BY canonical_products.source_product_key DESC
            ) AS physical_key_rank
        FROM canonical_products
        INNER JOIN product_gtin_resolution
            USING (product_id)
        LEFT JOIN price_snapshots
            ON price_snapshots.product_id = canonical_products.product_id
    )
    SELECT
        product_id,
        category_id,
        product_name,
        brand_name,
        gtin,
        pack_quantity,
        pack_uom,
        price_current_woolworths,
        price_last_woolworths,
        unit_price_current_woolworths,
        unit_price_last_woolworths,
        image_link_side
    FROM merged_source
    WHERE source_rank = 1
      AND physical_key_rank = 1
) AS source
ON target.id = source.product_id
WHEN MATCHED AND (
    target.category_id IS DISTINCT FROM source.category_id
    OR target.product_name IS DISTINCT FROM source.product_name
    OR target.brand_name IS DISTINCT FROM source.brand_name
    OR target.gtin IS DISTINCT FROM source.gtin
    OR target.pack_quantity IS DISTINCT FROM source.pack_quantity
    OR target.pack_uom IS DISTINCT FROM source.pack_uom
    OR target.price_current_woolworths IS DISTINCT FROM source.price_current_woolworths
    OR target.price_last_woolworths IS DISTINCT FROM source.price_last_woolworths
    OR target.unit_price_current_woolworths IS DISTINCT FROM source.unit_price_current_woolworths
    OR target.unit_price_last_woolworths IS DISTINCT FROM source.unit_price_last_woolworths
    OR target.image_link_side IS DISTINCT FROM source.image_link_side
) THEN UPDATE SET
    category_id = source.category_id,
    product_name = source.product_name,
    brand_name = source.brand_name,
    gtin = source.gtin,
    pack_quantity = source.pack_quantity,
    pack_uom = source.pack_uom,
    price_current_woolworths = source.price_current_woolworths,
    price_last_woolworths = source.price_last_woolworths,
    unit_price_current_woolworths = source.unit_price_current_woolworths,
    unit_price_last_woolworths = source.unit_price_last_woolworths,
    image_link_side = source.image_link_side,
    updated_at = current_timestamp
WHEN NOT MATCHED THEN INSERT (
    id,
    category_id,
    product_name,
    brand_name,
    gtin,
    pack_quantity,
    pack_uom,
    price_current_woolworths,
    price_last_woolworths,
    unit_price_current_woolworths,
    unit_price_last_woolworths,
    image_link_side,
    image_link_back,
    created_at,
    updated_at
) VALUES (
    source.product_id,
    source.category_id,
    source.product_name,
    source.brand_name,
    source.gtin,
    source.pack_quantity,
    source.pack_uom,
    source.price_current_woolworths,
    source.price_last_woolworths,
    source.unit_price_current_woolworths,
    source.unit_price_last_woolworths,
    source.image_link_side,
    NULL,
    current_timestamp,
    current_timestamp
);