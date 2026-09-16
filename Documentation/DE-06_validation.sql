-- DE-06  Product Matching & Deduplication -- Validation Query Set (Silver layer)

-- SECTION 0 -- Load snapshot (record these before/after an idempotency re-run)
SELECT
    (SELECT count(*)               FROM silver.dim_products)                          AS dim_products,
    (SELECT count(*)               FROM silver.fct_product_prices)                    AS fct_rows,
    (SELECT count(gtin)            FROM silver.dim_products)                          AS products_with_gtin,
    (SELECT count(DISTINCT gtin)   FROM silver.dim_products WHERE gtin IS NOT NULL)   AS distinct_gtins;
-- Idempotency test:  run the SAME date twice, run this query after each run.
--   PASS  -> dim_products is (near) identical across the two runs.
--   FAIL  -> dim_products grows on the 2nd run (identity not resolving
--            against existing product, investigate gtin_matches / canonical_matches).

-- SECTION 1 -- GTIN INTEGRITY

-- No GTIN maps to more than one product.
SELECT gtin, count(*) AS product_count
FROM silver.dim_products
WHERE gtin IS NOT NULL
GROUP BY gtin
HAVING count(*) > 1
ORDER BY product_count DESC;

-- GTIN shape: length within 8..14, digits only.
SELECT id, gtin, length(gtin) AS len
FROM silver.dim_products
WHERE gtin IS NOT NULL
  AND (gtin !~ '^[0-9]+$' OR length(gtin) NOT BETWEEN 8 AND 14);

-- SECTION 2 -- CANONICAL-KEY / NEAR-DUPLICATE DETECTION

-- Duplicates under the ENFORCED database index definition
SELECT
    coalesce(lower(brand_name), '')       AS brand_key,
    lower(product_name)                    AS name_key,
    coalesce(pack_quantity, -1)            AS pack_qty,
    coalesce(lower(pack_uom), '')          AS uom,
    count(*)                               AS n
FROM silver.dim_products
GROUP BY 1, 2, 3, 4
HAVING count(*) > 1
ORDER BY n DESC;

-- Near-duplicates under the MERGE expression's normalization
WITH keyed AS (
    SELECT
        id,
        product_name,
        brand_name,
        pack_quantity,
        pack_uom,
        trim(regexp_replace(lower(coalesce(brand_name, '')),   '[^a-z0-9]+', ' ', 'g')) AS brand_key,
        trim(regexp_replace(lower(coalesce(product_name, '')), '[^a-z0-9]+', ' ', 'g')) AS name_norm
    FROM silver.dim_products
),
core AS (
    SELECT
        *,
        CASE
            WHEN brand_key <> '' AND name_norm LIKE brand_key || ' %'
                THEN substr(name_norm, length(brand_key) + 2)
            ELSE name_norm
        END AS core_name
    FROM keyed
)
SELECT
    brand_key,
    core_name,
    pack_quantity,
    coalesce(lower(pack_uom), '') AS uom,
    count(*)                      AS n,
    array_agg(product_name)       AS example_names,
    array_agg(id)                 AS product_ids
FROM core
GROUP BY brand_key, core_name, pack_quantity, uom
HAVING count(*) > 1
ORDER BY n DESC
LIMIT 100;

-- SECTION 3 -- FACT-TABLE INTEGRITY

-- Every fact references an existing product / category / retailer.
SELECT f.id
FROM silver.fct_product_prices f
LEFT JOIN silver.dim_products   p ON p.id = f.product_id
LEFT JOIN silver.dim_categories c ON c.id = f.category_id
LEFT JOIN silver.dim_retailers  r ON r.id = f.retailer_id
WHERE p.id IS NULL OR c.id IS NULL OR r.id IS NULL;

-- Duplicate fact observations on the logical key
SELECT retailer_id, product_id, recorded_at, item_name, count(*) AS n
FROM silver.fct_product_prices
GROUP BY retailer_id, product_id, recorded_at, item_name
HAVING count(*) > 1
ORDER BY n DESC
LIMIT 100;

-- SECTION 4 -- MATCH-RATE / COVERAGE METRICS

-- GTIN coverage overall.
SELECT
    count(*)                                                              AS products,
    count(gtin)                                                           AS with_gtin,
    round(100.0 * count(gtin) / nullif(count(*), 0), 1)                   AS pct_with_gtin
FROM silver.dim_products;

-- Per-retailer price coverage
SELECT
    count(*) FILTER (WHERE price_current_coles      IS NOT NULL) AS has_coles,
    count(*) FILTER (WHERE price_current_woolworths IS NOT NULL) AS has_woolworths,
    count(*) FILTER (WHERE price_current_aldi       IS NOT NULL) AS has_aldi,
    count(*) FILTER (WHERE price_current_iga        IS NOT NULL) AS has_iga
FROM silver.dim_products;

-- CROSS-RETAILER MATCH SUCCESS 
SELECT count(*) AS products_in_2plus_retailers
FROM silver.dim_products
WHERE (price_current_coles      IS NOT NULL)::int
    + (price_current_woolworths IS NOT NULL)::int
    + (price_current_aldi       IS NOT NULL)::int
    + (price_current_iga        IS NOT NULL)::int >= 2;

-- SECTION 5 -- DATA-QUALITY SPOT CHECKS

-- pack_uom must be in the allowed set (also a CHECK constraint).
SELECT DISTINCT pack_uom
FROM silver.dim_products
WHERE pack_uom IS NOT NULL
  AND lower(pack_uom) NOT IN ('g','kg','ml','l','ea','pack','m');

-- Category distribution 
SELECT c.category_name, count(*) AS products
FROM silver.dim_products p
JOIN silver.dim_categories c ON c.id = p.category_id
GROUP BY c.category_name
ORDER BY products DESC;

-- Unit-price check
SELECT count(*) AS rows_unit_gt_price
FROM silver.fct_product_prices
WHERE unit_price IS NOT NULL AND price IS NOT NULL AND unit_price > price;
