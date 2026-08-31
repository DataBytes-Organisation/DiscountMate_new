/*
Author: Vidhi Patel

Ticket:
DE-06 – Product Matching & Deduplication (Silver Layer)

Purpose:
Provide reusable, read-only validation queries for the Coles product
matching and deduplication implementation.

The queries validate:
- GTIN coverage;
- duplicate canonical products;
- same-name product variants;
- pack-size preservation;
- brand preservation;
- products without GTIN.

Expected tables:
- silver.dim_products
- silver.fct_product_prices
- silver.static_master_coles_products

This script does not modify production data.
*/


---------------------------------------------------
-- 1. GTIN Coverage
---------------------------------------------------
-- Determines whether GTIN-based matching can currently
-- be validated in the Silver product dimension.

SELECT
    COUNT(*) AS total_products,
    COUNT(gtin) AS products_with_gtin,
    COUNT(*) - COUNT(gtin) AS products_without_gtin,
    ROUND(
        100.0 * COUNT(gtin) / NULLIF(COUNT(*), 0),
        2
    ) AS gtin_coverage_percent
FROM silver.dim_products;


---------------------------------------------------
-- 2. Duplicate Canonical Products
---------------------------------------------------
-- Detects duplicate canonical products using the
-- business identity:
-- product name + brand + pack quantity + pack unit.
--
-- Expected result:
-- zero rows.

SELECT
    product_name,
    brand_name,
    pack_quantity,
    pack_uom,
    COUNT(*) AS duplicate_count
FROM silver.dim_products
GROUP BY
    product_name,
    brand_name,
    pack_quantity,
    pack_uom
HAVING COUNT(*) > 1
ORDER BY
    duplicate_count DESC,
    product_name;


---------------------------------------------------
-- 3. Products Sharing the Same Name
---------------------------------------------------
-- Shows products that share the same product name
-- but differ by brand and/or pack size.
--
-- These records are not automatically merged because
-- name similarity alone is insufficient product identity.

SELECT
    product_name,
    COUNT(*) AS product_count,
    COUNT(DISTINCT brand_name) AS brand_variants,
    COUNT(
        DISTINCT
        CAST(pack_quantity AS TEXT)
        || ' '
        || COALESCE(pack_uom, '')
    ) AS pack_variants
FROM silver.dim_products
GROUP BY
    product_name
HAVING COUNT(*) > 1
ORDER BY
    product_count DESC,
    product_name;


---------------------------------------------------
-- 4. Full Cream Milk Validation
---------------------------------------------------
-- Representative validation example.
-- Products with different brands or pack sizes should
-- remain separate canonical products.

SELECT
    product_name,
    brand_name,
    pack_quantity,
    pack_uom,
    gtin
FROM silver.dim_products
WHERE LOWER(product_name) LIKE '%full cream milk%'
ORDER BY
    brand_name,
    pack_quantity,
    pack_uom;


---------------------------------------------------
-- 5. Extra Virgin Olive Oil Validation
---------------------------------------------------
-- Representative validation example.
-- Products with different brands or pack sizes should
-- remain separate canonical products.

SELECT
    product_name,
    brand_name,
    pack_quantity,
    pack_uom,
    gtin
FROM silver.dim_products
WHERE LOWER(product_name) LIKE '%extra virgin olive oil%'
ORDER BY
    brand_name,
    pack_quantity,
    pack_uom;


---------------------------------------------------
-- 6. Same Product Name with Different Pack Sizes
---------------------------------------------------
-- Validates that different pack sizes remain separate.
--
-- These are potential near-duplicate candidates only.
-- They must not be automatically merged without stronger
-- product identity evidence.

SELECT
    product_name,
    brand_name,
    COUNT(
        DISTINCT
        CAST(pack_quantity AS TEXT)
        || ' '
        || COALESCE(pack_uom, '')
    ) AS pack_variants,
    STRING_AGG(
        DISTINCT
        CAST(pack_quantity AS TEXT)
        || ' '
        || COALESCE(pack_uom, ''),
        ' | '
    ) AS example_pack_sizes
FROM silver.dim_products
WHERE product_name IS NOT NULL
GROUP BY
    product_name,
    brand_name
HAVING COUNT(
    DISTINCT
    CAST(pack_quantity AS TEXT)
    || ' '
    || COALESCE(pack_uom, '')
) > 1
ORDER BY
    pack_variants DESC,
    product_name;


---------------------------------------------------
-- 7. Same Product Name with Different Brands
---------------------------------------------------
-- Validates that products with the same product name
-- but different brands remain separate.

SELECT
    product_name,
    COUNT(DISTINCT brand_name) AS brand_variants,
    STRING_AGG(
        DISTINCT brand_name,
        ' | '
    ) AS example_brands
FROM silver.dim_products
WHERE product_name IS NOT NULL
GROUP BY
    product_name
HAVING COUNT(DISTINCT brand_name) > 1
ORDER BY
    brand_variants DESC,
    product_name;


---------------------------------------------------
-- 8. Products Without GTIN
---------------------------------------------------
-- Lists products that currently rely on the
-- deterministic fallback identity because GTIN is NULL.

SELECT
    product_name,
    brand_name,
    pack_quantity,
    pack_uom
FROM silver.dim_products
WHERE gtin IS NULL
ORDER BY
    product_name,
    brand_name
LIMIT 50;


---------------------------------------------------
-- 9. Near-Duplicate Review Candidates
---------------------------------------------------
-- Identifies cases where the same product name and
-- brand occur with multiple pack identities.
--
-- These are FLAGGED for review rather than automatically
-- merged by fuzzy matching.

SELECT
    product_name,
    brand_name,
    COUNT(*) AS candidate_count,
    STRING_AGG(
        DISTINCT
        CAST(pack_quantity AS TEXT)
        || ' '
        || COALESCE(pack_uom, ''),
        ' | '
    ) AS pack_variants
FROM silver.dim_products
WHERE
    product_name IS NOT NULL
    AND brand_name IS NOT NULL
GROUP BY
    product_name,
    brand_name
HAVING COUNT(*) > 1
ORDER BY
    candidate_count DESC,
    product_name;


---------------------------------------------------
-- 10. Validation Summary
---------------------------------------------------
-- Overall duplicate check.
--
-- Expected result:
-- duplicate_group_count = 0.

SELECT
    COUNT(*) AS duplicate_group_count
FROM (
    SELECT
        product_name,
        brand_name,
        pack_quantity,
        pack_uom
    FROM silver.dim_products
    GROUP BY
        product_name,
        brand_name,
        pack_quantity,
        pack_uom
    HAVING COUNT(*) > 1
) AS duplicate_groups;