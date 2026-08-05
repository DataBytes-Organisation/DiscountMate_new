/*
Author: Vidhi Patel

Ticket:
DE-06 – Product Matching & Deduplication (Silver Layer)

Purpose:
Provide reusable validation queries for DE-06 Product Matching &
Deduplication. These queries validate the quality of the current
Coles product matching implementation before any changes are made
to the production ETL pipeline.

Execution:
Run after the Coles ETL pipeline has populated the Silver Layer.

Expected tables:
- silver.dim_products
- silver.fct_product_prices
- silver.static_master_coles_products

This script is read-only.
No production data is modified.
*/

---------------------------------------------------
-- 1. GTIN Coverage
---------------------------------------------------
-- Determines whether GTIN-based matching can be used.

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
-- Checks whether duplicate products already exist
-- in the canonical product dimension.

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
ORDER BY duplicate_count DESC;

---------------------------------------------------
-- 3. Products Sharing the Same Name
---------------------------------------------------
-- Shows products that share the same product name
-- but differ by brand and/or pack size.

SELECT
    product_name,
    COUNT(*) AS product_count,
    COUNT(DISTINCT brand_name) AS brand_variants,
    COUNT(
        DISTINCT CAST(pack_quantity AS TEXT)
        || ' '
        || COALESCE(pack_uom, '')
    ) AS pack_variants
FROM silver.dim_products
GROUP BY product_name
HAVING COUNT(*) > 1
ORDER BY product_count DESC;

---------------------------------------------------
-- 4. Full Cream Milk Validation
---------------------------------------------------
-- Manual validation example.

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
-- Manual validation example.

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
-- Validates that products with different pack sizes
-- remain separate canonical products.

SELECT
    product_name,
    brand_name,
    COUNT(
        DISTINCT CAST(pack_quantity AS TEXT)
        || ' '
        || COALESCE(pack_uom, '')
    ) AS pack_variants,
    STRING_AGG(
        DISTINCT CAST(pack_quantity AS TEXT)
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
        DISTINCT CAST(pack_quantity AS TEXT)
        || ' '
        || COALESCE(pack_uom, '')
    ) > 1
ORDER BY
    pack_variants DESC,
    product_name;

---------------------------------------------------
-- 7. Same Product Name with Different Brands
---------------------------------------------------
-- Validates that products with the same name but
-- different brands remain separate.

SELECT
    product_name,
    COUNT(DISTINCT brand_name) AS brand_variants,
    STRING_AGG(
        DISTINCT brand_name,
        ' | '
    ) AS example_brands
FROM silver.dim_products
WHERE product_name IS NOT NULL
GROUP BY product_name
HAVING COUNT(DISTINCT brand_name) > 1
ORDER BY
    brand_variants DESC,
    product_name;

---------------------------------------------------
-- 8. Products Without GTIN
---------------------------------------------------
-- Lists sample products that currently rely entirely
-- on canonical matching.

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


-- ## Validation Results

-- Validation was performed against the Silver layer after loading the Coles dataset.

-- ### Findings

-- - 14,578 products were loaded into `silver.dim_products`.
-- - No duplicate products were found for the combination of product name, brand name, pack quantity, and pack unit.
-- - Products sharing the same name (for example, Full Cream Milk and Extra Virgin Olive Oil) are correctly separated by brand and pack size.
-- - Multiple pack-size variants are preserved as separate canonical products.
-- - GTIN values are currently not populated in `silver.dim_products`, so GTIN-first matching could not be validated using the current Silver dataset.