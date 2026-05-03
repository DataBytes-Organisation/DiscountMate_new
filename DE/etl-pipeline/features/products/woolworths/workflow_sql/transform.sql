-- 1. Drop existing processed_data table
DROP TABLE IF EXISTS processed_data;

-- 2. Create category mapping table
DROP TABLE IF EXISTS category_map;

CREATE TABLE category_map AS
SELECT * FROM (
    VALUES
        ('health care', 'HEALTH & BEAUTY'),
        ('toiletries', 'HEALTH & BEAUTY'),
        ('meat convenience', 'POULTRY, MEAT & SEAFOOD'),
        ('deli service', 'DELI & CHILLED MEALS'),
        ('confectionery', 'SNACKS & CONFECTIONARY'),
        ('stationery', 'HOUSEHOLD ITEMS'),
        ('ethnic gourmet food', 'CONVENIENCE FOOD'),
        ('cleansing', 'HOUSEHOLD ITEMS'),
        ('canned fish', 'PANTRY'),
        ('hardware', 'HOUSEHOLD ITEMS'),
        ('baby needs', 'BABY FOOD & ACCESSORIES'),
        ('carbonated soft drinks', 'BEVERAGES'),
        ('pet food', 'PET FOOD & ACCESSORIES'),
        ('breakfast foods', 'PANTRY'),
        ('condiments', 'PANTRY'),
        ('domesticware', 'HOUSEHOLD ITEMS'),
        ('beverages', 'BEVERAGES'),
        ('pasta rice', 'PANTRY'),
        ('canned vegetables', 'PANTRY'),
        ('frozen meals', 'FROZEN FOODS'),
        ('biscuits', 'SNACKS & CONFECTIONARY'),
        ('lifestyle water non carbonated', 'BEVERAGES'),
        ('proprietary bakery', 'BAKERY'),
        ('prepared foods', 'CONVENIENCE FOOD'),
        ('cooking needs', 'PANTRY'),
        ('dairy chilled juices and drinks', 'BEVERAGES'),
        ('canned fruit  desserts', 'PANTRY'),
        ('veg freshcuts   hard produce', 'FRUIT, VEG & PRODUCE'),
        ('dairy eggs', 'DAIRY & REFRIGERATED'),
        ('cheese entertaining', 'DAIRY & REFRIGERATED'),
        ('jams spreads', 'PANTRY'),
        ('cheese cooking', 'DAIRY & REFRIGERATED'),
        ('dairy yoghurt', 'DAIRY & REFRIGERATED'),
        ('deli convenience', 'CONVENIENCE FOOD'),
        ('snacks', 'SNACKS & CONFECTIONARY'),
        ('ice cream', 'FROZEN FOODS'),
        ('papergoods', 'HOUSEHOLD ITEMS'),
        ('dairy butter and margarine', 'DAIRY & REFRIGERATED'),
        ('cheese everyday', 'DAIRY & REFRIGERATED'),
        ('freezer fish', 'FROZEN FOODS'),
        ('freezer desserts and pastry', 'FROZEN FOODS'),
        ('oils cooking)', 'PANTRY'),
        ('longlife juice  drinks', 'BEVERAGES'),
        ('cordial drink bases', 'BEVERAGES'),
        ('freezer poultry', 'FROZEN FOODS'),
        ('dairy milk', 'DAIRY & REFRIGERATED'),
        ('garden aids seeds/bulbs', 'MISCELLANEOUS'),
        ('haberdashery', 'MISCELLANEOUS'),
        ('health foods', 'HEALTH & BEAUTY'),
        ('dairy entertaining', 'DAIRY & REFRIGERATED'),
        ('dairy snacks', 'DAIRY & REFRIGERATED'),
        ('apparel', 'MISCELLANEOUS'),
        ('dairy cream', 'DAIRY & REFRIGERATED'),
        ('freezer vegetables', 'FROZEN FOODS'),
        ('instore bakery', 'BAKERY'),
        ('household cleaning', 'HOUSEHOLD ITEMS'),
        ('seafood convenience', 'CONVENIENCE FOOD'),
        ('electrical', 'MISCELLANEOUS'),
        ('babywear layette', 'BABY FOOD & ACCESSORIES'),
        ('dairy plant based and ethnic', 'HEALTH FOOD & SUPPLEMENTS'),
        ('seafood', 'POULTRY, MEAT & SEAFOOD'),
        ('fruit', 'FRUIT, VEG & PRODUCE')
) AS t(original, revised);

-- 3. Create processed_data with transformations + FK lookups
CREATE TABLE processed_data AS
WITH transformed AS (
    SELECT
        Timestamp AS recorded_at,

        CASE WHEN Barcode IS NOT NULL AND Barcode != '' 
             THEN CAST(CAST(Barcode AS DOUBLE) AS BIGINT)::VARCHAR 
             ELSE NULL 
        END AS product_id_raw,

        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        LOWER(TRIM(SapCategoryName)),
                        '&', 'and'
                    ),
                    '/ |- ', ' '
                ),
                '[^a-z0-9 ]', ' '
            ),
            '\\s+',
            ' '
        ) AS category_id_raw,

        'Woolworths' AS retailer_id,
        TRIM(DisplayName) AS item_name,
        CASE WHEN PromotionType = 'NOT_SET' THEN NULL ELSE TRIM(PromotionType) END AS special_text,

        'https://www.woolworths.com.au/shop/productdetails/' 
            || CAST(Stockcode AS VARCHAR) || '/' || TRIM(UrlFriendlyName) AS product_url,

        Price AS price,

        CASE 
            WHEN regexp_matches(PackageSize, '\\d+') 
            THEN ROUND(Price / CAST(regexp_extract(PackageSize, '(\\d+)', 1) AS DOUBLE), 3) 
            ELSE NULL 
        END AS unit_price,

        IsOnSpecial AS is_on_special,

        ROW_NUMBER() OVER (
            PARTITION BY CASE WHEN Barcode IS NOT NULL AND Barcode != '' 
                              THEN CAST(CAST(Barcode AS DOUBLE) AS BIGINT)::VARCHAR 
                              ELSE NULL END
            ORDER BY Timestamp DESC
        ) AS rn

    FROM raw_data
    WHERE Barcode IS NOT NULL
      AND Barcode != ''
      AND SapCategoryName IS NOT NULL
      AND TRIM(SapCategoryName) != ''
      AND Price IS NOT NULL
      AND Price > 0
      AND regexp_matches(PackageSize, '\\d+')
      AND CAST(regexp_extract(PackageSize, '(\\d+)', 1) AS DOUBLE) > 0
)

SELECT
    t.recorded_at,
    dp.product_id AS product_id,
    dc.category_id AS category_id,
    t.retailer_id,
    t.item_name,
    t.special_text,
    t.product_url,
    t.price,
    t.unit_price,
    t.is_on_special,
    now() AS created_at

FROM transformed t
LEFT JOIN category_map m
    ON t.category_id_raw = m.original
LEFT JOIN dim_products dp
    ON dp.product_id = t.product_id_raw
LEFT JOIN dim_categories dc
    ON dc.category_id = COALESCE(m.revised, t.category_id_raw)
WHERE t.rn = 1
  AND t.product_url IS NOT NULL
  AND t.product_url != ''
  AND t.unit_price IS NOT NULL
  AND t.unit_price > 0;
