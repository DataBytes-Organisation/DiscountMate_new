MERGE INTO {{ fct_product_prices_table }} AS target
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
            raw.match_gtin AS gtin,
            CAST(raw.pack_quantity AS DECIMAL(10, 3)) AS pack_quantity,
            lower(raw.pack_uom) AS pack_uom,
            row_number() OVER (
                PARTITION BY raw.source_product_key
                ORDER BY
                    raw.recorded_at DESC,
                    raw.source_file DESC,
                    raw.item_name DESC
            ) AS product_rank
        FROM raw_input_normalized AS raw
    ),
    touched_products AS (
        SELECT
            source_product_key,
            canonical_key,
            brand_name_key,
            canonical_product_name_key,
            gtin,
            pack_quantity,
            pack_uom
        FROM latest_products
        WHERE product_rank = 1
    ),
    /*
        Build the same normalized identity fields for the existing
        dim_products rows that were used by sync_dim_products.sql.
    */
    existing_products_base AS (
        SELECT
            products.id AS product_id,
            products.gtin,
            products.product_name,
            products.brand_name,
            CAST(
                products.pack_quantity AS DECIMAL(10, 3)
            ) AS pack_quantity,
            lower(products.pack_uom) AS pack_uom,
            trim(
                regexp_replace(
                    lower(coalesce(products.brand_name, '')),
                    '[^a-z0-9]+',
                    ' ',
                    'g'
                )
            ) AS brand_name_key,
            trim(
                regexp_replace(
                    lower(coalesce(products.product_name, '')),
                    '[^a-z0-9]+',
                    ' ',
                    'g'
                )
            ) AS product_name_key
        FROM {{ dim_products_table }} AS products
    ),
    existing_products_brand_stripped AS (
        SELECT
            *,
            CASE
                WHEN brand_name_key <> ''
                    AND (
                        product_name_key = brand_name_key
                        OR product_name_key LIKE brand_name_key || ' %'
                    )
                THEN trim(
                    substr(
                        product_name_key,
                        length(brand_name_key) + 1
                    )
                )
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
                                -- 12 x 375ml
                                '[0-9]+[[:space:]]*x[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*(ml|l|g|kg)',
                                ' ',
                                'g'
                            ),
                            -- 375ml / 500 g
                            '[0-9]+([.][0-9]+)?[[:space:]]*(ml|l|g|kg)',
                            ' ',
                            'g'
                        ),
                        -- 12pk / 10 pack
                        '[0-9]+[[:space:]]*(pk|pack)',
                        ' ',
                        'g'
                    ),
                    -- each / ea
                    '(^|[[:space:]])(each|ea)($|[[:space:]])',
                    ' ',
                    'g'
                )
            ) AS canonical_product_name_key
        FROM existing_products_brand_stripped
    ),

    existing_products_normalized AS (
        SELECT
            *,
            brand_name_key
                || '|'
                || trim(
                    regexp_replace(
                        canonical_product_name_key,
                        '[[:space:]]+',
                        ' ',
                        'g'
                    )
                )
                || '|'
                || CASE
                    WHEN pack_quantity IS NULL
                        THEN ''

                    ELSE rtrim(
                        regexp_replace(
                            printf('%.3f', pack_quantity),
                            '0+$',
                            ''
                        ),
                        '.'
                    )
                END
                || '|'
                || coalesce(pack_uom, '') AS canonical_key
        FROM existing_products_measure_stripped
    ),
    /*
        Stage 1:
        Exact GTIN matching receives first priority.
    */
    gtin_identity AS (

        SELECT
            incoming.source_product_key,
            min(existing.product_id) AS product_id
        FROM touched_products AS incoming
        INNER JOIN existing_products_normalized AS existing
            ON incoming.gtin IS NOT NULL
            AND existing.gtin = incoming.gtin
        GROUP BY incoming.source_product_key
    ),
    /*
        Stage 2:
        Exact canonical key matching.
        If both products have a GTIN, they must agree.
    */
    canonical_identity AS (
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
        LEFT JOIN gtin_identity
            USING (source_product_key)
        WHERE gtin_identity.product_id IS NULL
        GROUP BY incoming.source_product_key
    ),
    /*
        Only products not resolved by GTIN or exact canonical
        matching are allowed into fuzzy matching.
    */
    fuzzy_candidate_source AS (

        SELECT incoming.*
        FROM touched_products AS incoming
        LEFT JOIN gtin_identity
            USING (source_product_key)
        LEFT JOIN canonical_identity
            USING (source_product_key)
        WHERE gtin_identity.product_id IS NULL
        AND canonical_identity.product_id IS NULL
        AND incoming.pack_quantity IS NOT NULL
        AND incoming.pack_uom IS NOT NULL
    ),

    /*
        Generate possible fuzzy candidates.
        Pack quantity + UOM are hard compatibility rules.
    */
    fuzzy_candidates_base AS (
        SELECT
            incoming.source_product_key,
            existing.product_id,
            jaro_winkler_similarity(
                incoming.canonical_product_name_key,
                existing.canonical_product_name_key
            ) AS name_similarity,
            CASE
                WHEN incoming.brand_name_key = ''
                OR existing.brand_name_key = ''
                THEN NULL
                ELSE jaro_winkler_similarity(
                    incoming.brand_name_key,
                    existing.brand_name_key
                )
            END AS brand_similarity

        FROM fuzzy_candidate_source AS incoming
        INNER JOIN existing_products_normalized AS existing
            ON incoming.pack_quantity = existing.pack_quantity
            AND lower(incoming.pack_uom)
                = lower(existing.pack_uom)
            /*
                Do not fuzzy merge products if both have
                different known GTINs.
            */
            AND (
                incoming.gtin IS NULL
                OR existing.gtin IS NULL
                OR incoming.gtin = existing.gtin
            )
            /*
                Broad candidate blocking.
            */
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
                WHEN brand_similarity IS NULL
                    THEN name_similarity
                ELSE
                    (name_similarity * 0.80)
                    + (brand_similarity * 0.20)
            END AS confidence_score
        FROM fuzzy_candidates_base
    ),

    /*
        Rank candidates so we can compare the best candidate
        against the runner-up.
    */
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
            confidence_score
                - coalesce(runner_up_score, 0)
                AS score_margin,
            fuzzy_candidate_source AS (

        SELECT incoming.*
        FROM touched_products AS incoming
        LEFT JOIN gtin_identity
            USING (source_product_key)
        LEFT JOIN canonical_identity
            USING (source_product_key)
        WHERE gtin_identity.product_id IS NULL
        AND canonical_identity.product_id IS NULL
        AND incoming.pack_quantity IS NOT NULL
        AND incoming.pack_uom IS NOT NULL
    ),

    /*
        Generate possible fuzzy candidates.
        Pack quantity + UOM are hard compatibility rules.
    */
    fuzzy_candidates_base AS (
        SELECT
            incoming.source_product_key,
            existing.product_id,
            jaro_winkler_similarity(
                incoming.canonical_product_name_key,
                existing.canonical_product_name_key
            ) AS name_similarity,
            CASE
                WHEN incoming.brand_name_key = ''
                OR existing.brand_name_key = ''
                THEN NULL
                ELSE jaro_winkler_similarity(
                    incoming.brand_name_key,
                    existing.brand_name_key
                )
            END AS brand_similarity

        FROM fuzzy_candidate_source AS incoming
        INNER JOIN existing_products_normalized AS existing
            ON incoming.pack_quantity = existing.pack_quantity
            AND lower(incoming.pack_uom)
                = lower(existing.pack_uom)
            /*
                Do not fuzzy merge products if both have
                different known GTINs.
            */
            AND (
                incoming.gtin IS NULL
                OR existing.gtin IS NULL
                OR incoming.gtin = existing.gtin
            )
            /*
                Broad candidate blocking.
            */
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
                WHEN brand_similarity IS NULL
                    THEN name_similarity
                ELSE
                    (name_similarity * 0.80)
                    + (brand_similarity * 0.20)
            END AS confidence_score
        FROM fuzzy_candidates_base
    ),

    /*
        Rank candidates so we can compare the best candidate
        against the runner-up.
    */
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
            confidence_score
                - coalesce(runner_up_score, 0)
                AS score_margin,
            CASE
                WHEN confidence_score >= 0.92
                    AND (
                        runner_up_score IS NULL
                        OR confidence_score
                            - runner_up_score >= 0.05
                    )
                THEN 'HIGH'
                WHEN confidence_score >= 0.85
                    THEN 'MEDIUM'
                ELSE 'LOW'
            END AS confidence_band
        FROM fuzzy_ranked
        WHERE match_rank = 1
    ),

    /*
        Facts are only allowed to use HIGH-confidence
        fuzzy matches.

        MEDIUM and LOW products are held out.
    */
    fuzzy_high_identity AS (
        SELECT
            source_product_key,
            product_id
        FROM fuzzy_best_matches
        WHERE confidence_band = 'HIGH'
    ),
        FROM fuzzy_ranked
        WHERE match_rank = 1
    ),

    /*
        Facts are only allowed to use HIGH-confidence
        fuzzy matches.

        MEDIUM and LOW products are held out.
    */
    fuzzy_high_identity AS (
        SELECT
            source_product_key,
            product_id
        FROM fuzzy_best_matches
        WHERE confidence_band = 'HIGH'
    ),

    /*
        Final mapping from Woolworths Stockcode
        to silver.dim_products product_id.
    */
    product_identity AS (
        SELECT
            incoming.source_product_key,
            coalesce(
                gtin_identity.product_id,
                canonical_identity.product_id,
                fuzzy_high_identity.product_id
            ) AS product_id
        FROM touched_products AS incoming
        LEFT JOIN gtin_identity
            USING (source_product_key)
        LEFT JOIN canonical_identity
            USING (source_product_key)
        LEFT JOIN fuzzy_high_identity
            USING (source_product_key)
        WHERE coalesce(
            gtin_identity.product_id,
            canonical_identity.product_id,
            fuzzy_high_identity.product_id
        ) IS NOT NULL
    ),
    prepared AS (
        SELECT
            product_identity.product_id,
            categories.id AS category_id,
            retailer.retailer_id,
            CAST(raw.recorded_at AS TIMESTAMPTZ) AS recorded_at,
            raw.item_name,
            raw.special_text,
            raw.product_url,
            CAST(raw.price AS DECIMAL(10, 2)) AS price,
            CAST(raw.unit_price AS DECIMAL(12, 4)) AS unit_price,
            raw.is_on_special,
            row_number() OVER (
                PARTITION BY
                    retailer.retailer_id,
                    product_identity.product_id,
                    CAST(raw.recorded_at AS TIMESTAMPTZ),
                    raw.item_name,
                    CAST(raw.price AS DECIMAL(10, 2)),
                    CAST(raw.unit_price AS DECIMAL(12, 4))
                ORDER BY raw.source_file DESC, raw.item_name DESC
            ) AS dedupe_rank
        FROM raw_input_normalized AS raw
        INNER JOIN product_identity
            ON product_identity.source_product_key = raw.source_product_key
        INNER JOIN {{ dim_categories_table }} AS categories
            ON categories.category_name = raw.category_name
        CROSS JOIN retailer_woolworths AS retailer
    )
    SELECT
        uuid() AS id,
        recorded_at,
        product_id,
        category_id,
        retailer_id,
        item_name,
        special_text,
        product_url,
        price,
        unit_price,
        is_on_special,
        current_timestamp AS created_at
    FROM prepared
    WHERE dedupe_rank = 1
) AS source
ON target.retailer_id = source.retailer_id
    AND target.product_id = source.product_id
    AND target.recorded_at = source.recorded_at
    AND target.item_name = source.item_name
WHEN MATCHED AND (
    target.category_id IS DISTINCT FROM source.category_id
    OR target.special_text IS DISTINCT FROM source.special_text
    OR target.product_url IS DISTINCT FROM source.product_url
    OR target.price IS DISTINCT FROM source.price
    OR target.unit_price IS DISTINCT FROM source.unit_price
    OR target.is_on_special IS DISTINCT FROM source.is_on_special
) THEN UPDATE SET
    category_id = source.category_id,
    special_text = source.special_text,
    product_url = source.product_url,
    price = source.price,
    unit_price = source.unit_price,
    is_on_special = source.is_on_special
WHEN NOT MATCHED THEN INSERT (
    id,
    recorded_at,
    product_id,
    category_id,
    retailer_id,
    item_name,
    special_text,
    product_url,
    price,
    unit_price,
    is_on_special,
    created_at
) VALUES (
    source.id,
    source.recorded_at,
    source.product_id,
    source.category_id,
    source.retailer_id,
    source.item_name,
    source.special_text,
    source.product_url,
    source.price,
    source.unit_price,
    source.is_on_special,
    source.created_at
);
