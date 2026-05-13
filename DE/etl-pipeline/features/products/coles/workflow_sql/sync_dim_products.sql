MERGE INTO {{ dim_products_table }} AS target
USING (
    WITH retailer_coles AS (
        SELECT id AS retailer_id
        FROM {{ dim_retailers_table }}
        WHERE retailer_name = 'coles'
    ),
    latest_static_master AS (
        SELECT
            product_id,
            gtin,
            row_number() OVER (
                PARTITION BY product_id
                ORDER BY scraped_at DESC, id DESC
            ) AS master_rank
        FROM {{ static_master_coles_products_table }}
    ),
    latest_static_master_products AS (
        SELECT
            product_id,
            gtin
        FROM latest_static_master
        WHERE master_rank = 1
    ),
    latest_products AS (
        SELECT
            raw.raw_product_id,
            raw.canonical_key,
            categories.id AS category_id,
            raw.item_name AS product_name,
            raw.brand_name,
            master.gtin,
            CAST(raw.pack_quantity AS DECIMAL(10, 3)) AS pack_quantity,
            lower(raw.pack_uom) AS pack_uom,
            raw.image_link_side,
            row_number() OVER (
                PARTITION BY raw.raw_product_id
                ORDER BY raw.recorded_at DESC, raw.source_file DESC, raw.item_name DESC
            ) AS product_rank
        FROM raw_input_normalized AS raw
        INNER JOIN {{ dim_categories_table }} AS categories
            ON categories.category_name = raw.category_name
        LEFT JOIN latest_static_master_products AS master
            ON master.product_id = raw.raw_product_id
    ),
    touched_products AS (
        SELECT
            raw_product_id,
            canonical_key,
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
    gtin_matches AS (
        SELECT
            touched_products.raw_product_id,
            products.id AS product_id
        FROM touched_products
        INNER JOIN {{ dim_products_table }} AS products
            ON touched_products.gtin IS NOT NULL
            AND products.gtin = touched_products.gtin
    ),
    canonical_matches AS (
        SELECT
            touched_products.raw_product_id,
            products.id AS product_id
        FROM touched_products
        INNER JOIN {{ dim_products_table }} AS products
            ON {{ dim_product_canonical_key_expr }} = touched_products.canonical_key
    ),
    unmatched_touched_products AS (
        SELECT
            touched_products.*
        FROM touched_products
        LEFT JOIN gtin_matches
            USING (raw_product_id)
        LEFT JOIN canonical_matches
            USING (raw_product_id)
        WHERE
            gtin_matches.product_id IS NULL
            AND canonical_matches.product_id IS NULL
    ),
    canonical_duplicate_keys AS (
        SELECT
            canonical_key
        FROM unmatched_touched_products
        GROUP BY canonical_key
        HAVING count(*) > 1
    ),
    unresolved_products AS (
        SELECT
            unmatched_touched_products.raw_product_id,
            CASE
                WHEN canonical_duplicate_keys.canonical_key IS NOT NULL
                    THEN unmatched_touched_products.canonical_key
                ELSE COALESCE(
                    unmatched_touched_products.gtin,
                    unmatched_touched_products.canonical_key
                )
            END AS insert_identity_key
        FROM unmatched_touched_products
        LEFT JOIN canonical_duplicate_keys
            USING (canonical_key)
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
            COALESCE(
                gtin_matches.product_id,
                canonical_matches.product_id,
                new_product_ids.product_id
            ) AS product_id,
            touched_products.raw_product_id,
            touched_products.category_id,
            touched_products.product_name,
            touched_products.brand_name,
            touched_products.gtin,
            touched_products.pack_quantity,
            touched_products.pack_uom,
            touched_products.image_link_side
        FROM touched_products
        LEFT JOIN gtin_matches
            USING (raw_product_id)
        LEFT JOIN canonical_matches
            USING (raw_product_id)
        LEFT JOIN unresolved_products
            USING (raw_product_id)
        LEFT JOIN new_product_ids
            USING (insert_identity_key)
    ),
    product_gtin_resolution AS (
        SELECT
            product_id,
            CASE
                WHEN count(DISTINCT gtin) FILTER (WHERE gtin IS NOT NULL) = 1
                    THEN MAX(gtin) FILTER (WHERE gtin IS NOT NULL)
                ELSE NULL
            END AS resolved_gtin
        FROM canonical_products
        GROUP BY product_id
    ),
    raw_observations AS (
        SELECT
            raw.raw_product_id,
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
            USING (raw_product_id)
        CROSS JOIN retailer_coles AS retailer
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
        CROSS JOIN retailer_coles AS retailer
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
            MAX(price) FILTER (WHERE price_rank = 1) AS price_current_coles,
            MAX(price) FILTER (WHERE price_rank = 2) AS price_last_coles,
            MAX(unit_price) FILTER (WHERE price_rank = 1) AS unit_price_current_coles,
            MAX(unit_price) FILTER (WHERE price_rank = 2) AS unit_price_last_coles
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
            COALESCE(
                price_snapshots.latest_category_id,
                canonical_products.category_id
            ) AS category_id,
            canonical_products.product_name,
            canonical_products.brand_name,
            product_gtin_resolution.resolved_gtin AS gtin,
            canonical_products.pack_quantity,
            canonical_products.pack_uom,
            price_snapshots.price_current_coles,
            price_snapshots.price_last_coles,
            price_snapshots.unit_price_current_coles,
            price_snapshots.unit_price_last_coles,
            canonical_products.image_link_side,
            row_number() OVER (
                PARTITION BY canonical_products.product_id
                ORDER BY canonical_products.raw_product_id DESC
            ) AS source_rank
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
        price_current_coles,
        price_last_coles,
        unit_price_current_coles,
        unit_price_last_coles,
        image_link_side
    FROM merged_source
    WHERE source_rank = 1
) AS source
ON target.id = source.product_id
WHEN MATCHED AND (
    target.category_id IS DISTINCT FROM source.category_id
    OR target.product_name IS DISTINCT FROM source.product_name
    OR target.brand_name IS DISTINCT FROM source.brand_name
    OR target.gtin IS DISTINCT FROM source.gtin
    OR target.pack_quantity IS DISTINCT FROM source.pack_quantity
    OR target.pack_uom IS DISTINCT FROM source.pack_uom
    OR target.price_current_coles IS DISTINCT FROM source.price_current_coles
    OR target.price_last_coles IS DISTINCT FROM source.price_last_coles
    OR target.unit_price_current_coles IS DISTINCT FROM source.unit_price_current_coles
    OR target.unit_price_last_coles IS DISTINCT FROM source.unit_price_last_coles
    OR target.image_link_side IS DISTINCT FROM source.image_link_side
) THEN UPDATE SET
    category_id = source.category_id,
    product_name = source.product_name,
    brand_name = source.brand_name,
    gtin = source.gtin,
    pack_quantity = source.pack_quantity,
    pack_uom = source.pack_uom,
    price_current_coles = source.price_current_coles,
    price_last_coles = source.price_last_coles,
    unit_price_current_coles = source.unit_price_current_coles,
    unit_price_last_coles = source.unit_price_last_coles,
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
    price_current_coles,
    price_last_coles,
    unit_price_current_coles,
    unit_price_last_coles,
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
    source.price_current_coles,
    source.price_last_coles,
    source.unit_price_current_coles,
    source.unit_price_last_coles,
    source.image_link_side,
    NULL,
    current_timestamp,
    current_timestamp
);
