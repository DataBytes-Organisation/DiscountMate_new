CREATE TEMP TABLE stg_aldi_resolved ON COMMIT DROP AS
WITH stage AS (
    SELECT
        s.*,
        c.id AS category_id,
        r.id AS retailer_id
    FROM stg_aldi_products s
    JOIN silver.dim_categories c
        ON c.category_name = s.standard_category_name
    JOIN silver.dim_retailers r
        ON r.retailer_name = 'Aldi'
),
matched AS (
    SELECT
        stage.*,
        coalesce(by_gtin.id, by_natural.id) AS matched_product_id
    FROM stage
    LEFT JOIN silver.dim_products by_gtin
        ON stage.gtin IS NOT NULL
       AND by_gtin.gtin = stage.gtin
    LEFT JOIN silver.dim_products by_natural
        ON by_natural.gtin IS NULL
       AND lower(by_natural.product_name) = lower(stage.product_name)
       AND lower(coalesce(by_natural.brand_name, '')) = lower(coalesce(stage.brand_name, ''))
       AND by_natural.category_id = stage.category_id
)
SELECT * FROM matched;

INSERT INTO silver.dim_products (
    category_id,
    product_name,
    brand_name,
    gtin,
    pack_quantity,
    pack_uom,
    price_current_aldi,
    unit_price_current_aldi,
    image_link_side,
    image_link_back
)
SELECT
    category_id,
    product_name,
    brand_name,
    gtin,
    pack_quantity,
    pack_uom,
    price,
    unit_price,
    image_link_side,
    image_link_back
FROM stg_aldi_resolved
WHERE matched_product_id IS NULL
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE stg_aldi_matched ON COMMIT DROP AS
WITH matched_raw AS (
    SELECT
        s.*,
        coalesce(by_gtin.id, by_natural.id) AS product_id
    FROM stg_aldi_resolved s
    LEFT JOIN silver.dim_products by_gtin
        ON s.gtin IS NOT NULL
       AND by_gtin.gtin = s.gtin
    LEFT JOIN silver.dim_products by_natural
        ON by_natural.gtin IS NULL
       AND lower(by_natural.product_name) = lower(s.product_name)
       AND lower(coalesce(by_natural.brand_name, '')) = lower(coalesce(s.brand_name, ''))
       AND by_natural.category_id = s.category_id
),
matched AS (
    SELECT
        *,
        row_number() OVER (
            PARTITION BY product_id, retailer_id, recorded_at
            ORDER BY source_product_id
        ) AS snapshot_row_num
    FROM matched_raw
    WHERE product_id IS NOT NULL
)
SELECT * FROM matched
WHERE snapshot_row_num = 1;

UPDATE silver.dim_products p
SET
    price_current_aldi = NULL,
    price_last_week_aldi = NULL,
    unit_price_current_aldi = NULL,
    unit_price_last_week_aldi = NULL,
    updated_at = now()
FROM stg_aldi_matched s
WHERE p.id <> s.product_id
  AND p.category_id = s.category_id
  AND lower(p.product_name) = lower(s.product_name)
  AND lower(coalesce(p.brand_name, '')) = lower(coalesce(s.brand_name, ''))
  AND (
      p.price_current_aldi IS NOT NULL
      OR p.price_last_week_aldi IS NOT NULL
      OR p.unit_price_current_aldi IS NOT NULL
      OR p.unit_price_last_week_aldi IS NOT NULL
  );

DELETE FROM silver.fct_product_prices f
USING silver.dim_products p, stg_aldi_matched s
WHERE f.product_id = p.id
  AND f.retailer_id = s.retailer_id
  AND f.recorded_at = s.recorded_at
  AND p.id <> s.product_id
  AND p.category_id = s.category_id
  AND lower(p.product_name) = lower(s.product_name)
  AND lower(coalesce(p.brand_name, '')) = lower(coalesce(s.brand_name, ''));

UPDATE silver.dim_products p
SET
    category_id = s.category_id,
    product_name = s.product_name,
    brand_name = s.brand_name,
    gtin = coalesce(p.gtin, s.gtin),
    pack_quantity = coalesce(s.pack_quantity, p.pack_quantity),
    pack_uom = coalesce(s.pack_uom, p.pack_uom),
    price_last_week_aldi = CASE
        WHEN p.price_current_aldi IS DISTINCT FROM s.price THEN p.price_current_aldi
        ELSE p.price_last_week_aldi
    END,
    price_current_aldi = s.price,
    unit_price_last_week_aldi = CASE
        WHEN p.unit_price_current_aldi IS DISTINCT FROM s.unit_price THEN p.unit_price_current_aldi
        ELSE p.unit_price_last_week_aldi
    END,
    unit_price_current_aldi = s.unit_price,
    image_link_side = coalesce(s.image_link_side, p.image_link_side),
    image_link_back = coalesce(s.image_link_back, p.image_link_back),
    updated_at = now()
FROM stg_aldi_matched s
WHERE p.id = s.product_id;

INSERT INTO silver.fct_product_prices (
    recorded_at,
    product_id,
    category_id,
    retailer_id,
    item_name,
    special_text,
    product_url,
    price,
    unit_price,
    is_on_special
)
SELECT
    recorded_at,
    product_id,
    category_id,
    retailer_id,
    item_name,
    special_text,
    product_url,
    price,
    unit_price,
    is_on_special
FROM stg_aldi_matched
ON CONFLICT (product_id, retailer_id, recorded_at)
DO UPDATE SET
    category_id = EXCLUDED.category_id,
    item_name = EXCLUDED.item_name,
    special_text = EXCLUDED.special_text,
    product_url = EXCLUDED.product_url,
    price = EXCLUDED.price,
    unit_price = EXCLUDED.unit_price,
    is_on_special = EXCLUDED.is_on_special;
