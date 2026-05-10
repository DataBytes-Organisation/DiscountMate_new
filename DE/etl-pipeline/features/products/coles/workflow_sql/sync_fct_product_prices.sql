MERGE INTO {{ fct_product_prices_table }} AS target
USING (
    WITH retailer_coles AS (
        SELECT id AS retailer_id
        FROM {{ dim_retailers_table }}
        WHERE retailer_name = 'coles'
    ),
    touched_keys AS (
        SELECT DISTINCT canonical_key
        FROM raw_input_normalized
    ),
    product_identity AS (
        SELECT
            products.id AS product_id,
            {{ dim_product_canonical_key_expr }} AS canonical_key
        FROM {{ dim_products_table }} AS products
        INNER JOIN touched_keys
            ON {{ dim_product_canonical_key_expr }} = touched_keys.canonical_key
    ),
    prepared AS (
        SELECT
            product_identity.product_id,
            categories.id AS category_id,
            retailer.retailer_id,
            CAST(raw.recorded_at AS TIMESTAMPTZ) AS recorded_at,
            raw.item_name,
            raw.special_text,
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
            USING (canonical_key)
        INNER JOIN {{ dim_categories_table }} AS categories
            ON categories.category_name = raw.category_name
        CROSS JOIN retailer_coles AS retailer
    )
    SELECT
        uuid() AS id,
        recorded_at,
        product_id,
        category_id,
        retailer_id,
        item_name,
        special_text,
        NULL AS product_url,
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
