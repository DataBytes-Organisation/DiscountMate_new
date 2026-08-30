CREATE OR REPLACE TABLE raw_input_normalized AS
WITH cleaned AS (
    SELECT
        nullif(trim(CAST(Stockcode AS VARCHAR)), '') AS raw_product_id,
        nullif(regexp_replace(CAST(Barcode AS VARCHAR), '[^0-9]', '', 'g'), '') AS raw_gtin,
        nullif(trim(coalesce(CAST(DisplayName AS VARCHAR), CAST(Name AS VARCHAR))), '') AS item_name,
        NULL::VARCHAR AS brand_name,
        nullif(trim(CAST(PackageSize AS VARCHAR)), '') AS raw_size,
        nullif(trim(CAST(SapCategoryName AS VARCHAR)), '') AS raw_category,
        nullif(trim(CAST(PromotionType AS VARCHAR)), '') AS promotion_type,
        nullif(trim(CAST(UrlFriendlyName AS VARCHAR)), '') AS url_friendly_name,
        nullif(trim(CAST(LargeImageFile AS VARCHAR)), '') AS image_link_side,
        TRY_CAST(Price AS DOUBLE) AS price,
        TRY_CAST(CupPrice AS DOUBLE) AS cup_price,
        nullif(trim(CAST(CupMeasure AS VARCHAR)), '') AS cup_measure,
        nullif(trim(CAST(CupString AS VARCHAR)), '') AS cup_string,
        CASE
            WHEN lower(trim(coalesce(CAST(IsOnSpecial AS VARCHAR), ''))) IN ('true', '1', 'yes', 'y') THEN TRUE
            WHEN lower(trim(coalesce(CAST(IsOnSpecial AS VARCHAR), ''))) IN ('false', '0', 'no', 'n') THEN FALSE
            ELSE NULL
        END AS is_on_special,
        TRY_CAST(Timestamp AS TIMESTAMP) AS recorded_at,
        source_file
    FROM raw_input
),
prepared AS (
    SELECT
        *,
        coalesce(
            TRY_CAST(
                nullif(
                    regexp_extract(lower(coalesce(raw_size, '')), '^([0-9]+(?:\.[0-9]+)?)', 1),
                    ''
                ) AS DOUBLE
            ),
            TRY_CAST(
                nullif(
                    regexp_extract(lower(coalesce(cup_measure, '')), '^([0-9]+(?:\.[0-9]+)?)', 1),
                    ''
                ) AS DOUBLE
            )
        ) AS pack_quantity,
        CASE lower(
            coalesce(
                nullif(regexp_extract(lower(coalesce(raw_size, '')), '^[0-9]+(?:\.[0-9]+)?\s*([a-z]+)', 1), ''),
                nullif(regexp_extract(lower(coalesce(cup_measure, '')), '^[0-9]+(?:\.[0-9]+)?\s*([a-z]+)', 1), '')
            )
        )
            WHEN 'g' THEN 'g'
            WHEN 'gram' THEN 'g'
            WHEN 'grams' THEN 'g'
            WHEN 'kg' THEN 'kg'
            WHEN 'ml' THEN 'ml'
            WHEN 'l' THEN 'l'
            WHEN 'lt' THEN 'l'
            WHEN 'ltr' THEN 'l'
            WHEN 'litre' THEN 'l'
            WHEN 'litres' THEN 'l'
            WHEN 'ea' THEN 'ea'
            WHEN 'each' THEN 'ea'
            WHEN 'pack' THEN 'pack'
            WHEN 'pk' THEN 'pack'
            ELSE NULL
        END AS pack_uom,
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        LOWER(TRIM(coalesce(raw_category, ''))),
                        '&', 'and'
                    ),
                    '/ |- ', ' '
                ),
                '[^a-z0-9 ]', ' '
            ),
            '\\s+',
            ' '
        ) AS category_key,
        trim(regexp_replace(lower(coalesce(item_name, '')), '[^a-z0-9]+', ' ', 'g')) AS product_name_key,
        trim(regexp_replace(lower(coalesce(brand_name, '')), '[^a-z0-9]+', ' ', 'g')) AS brand_name_key,
        CASE
            WHEN raw_product_id IS NULL THEN NULL
            WHEN url_friendly_name IS NULL THEN 'https://www.woolworths.com.au/shop/productdetails/' || raw_product_id
            ELSE 'https://www.woolworths.com.au/shop/productdetails/' || raw_product_id || '/' || url_friendly_name
        END AS product_url,
        CASE
            WHEN promotion_type IS NULL OR upper(promotion_type) = 'NOT_SET' THEN NULL
            ELSE promotion_type
        END AS special_text
    FROM cleaned
),
categorized AS (
    SELECT
        *,
        CASE category_key
            WHEN 'health care' THEN 'HEALTH & BEAUTY'
            WHEN 'toiletries' THEN 'HEALTH & BEAUTY'
            WHEN 'meat convenience' THEN 'POULTRY, MEAT & SEAFOOD'
            WHEN 'deli service' THEN 'DELI & CHILLED MEALS'
            WHEN 'confectionery' THEN 'SNACKS & CONFECTIONARY'
            WHEN 'stationery' THEN 'HOUSEHOLD ITEMS'
            WHEN 'ethnic gourmet food' THEN 'CONVENIENCE FOOD'
            WHEN 'cleansing' THEN 'HOUSEHOLD ITEMS'
            WHEN 'canned fish' THEN 'PANTRY'
            WHEN 'hardware' THEN 'HOUSEHOLD ITEMS'
            WHEN 'baby needs' THEN 'BABY FOOD & ACCESSORIES'
            WHEN 'carbonated soft drinks' THEN 'BEVERAGES'
            WHEN 'pet food' THEN 'PET FOOD & ACCESSORIES'
            WHEN 'breakfast foods' THEN 'PANTRY'
            WHEN 'condiments' THEN 'PANTRY'
            WHEN 'domesticware' THEN 'HOUSEHOLD ITEMS'
            WHEN 'beverages' THEN 'BEVERAGES'
            WHEN 'pasta rice' THEN 'PANTRY'
            WHEN 'canned vegetables' THEN 'PANTRY'
            WHEN 'frozen meals' THEN 'FROZEN FOODS'
            WHEN 'biscuits' THEN 'SNACKS & CONFECTIONARY'
            WHEN 'lifestyle water non carbonated' THEN 'BEVERAGES'
            WHEN 'proprietary bakery' THEN 'BAKERY'
            WHEN 'prepared foods' THEN 'CONVENIENCE FOOD'
            WHEN 'cooking needs' THEN 'PANTRY'
            WHEN 'dairy chilled juices and drinks' THEN 'BEVERAGES'
            WHEN 'canned fruit desserts' THEN 'PANTRY'
            WHEN 'veg freshcuts hard produce' THEN 'FRUIT, VEG & PRODUCE'
            WHEN 'dairy eggs' THEN 'DAIRY & REFRIGERATED'
            WHEN 'cheese entertaining' THEN 'DAIRY & REFRIGERATED'
            WHEN 'jams spreads' THEN 'PANTRY'
            WHEN 'cheese cooking' THEN 'DAIRY & REFRIGERATED'
            WHEN 'dairy yoghurt' THEN 'DAIRY & REFRIGERATED'
            WHEN 'deli convenience' THEN 'CONVENIENCE FOOD'
            WHEN 'snacks' THEN 'SNACKS & CONFECTIONARY'
            WHEN 'ice cream' THEN 'FROZEN FOODS'
            WHEN 'papergoods' THEN 'HOUSEHOLD ITEMS'
            WHEN 'dairy butter and margarine' THEN 'DAIRY & REFRIGERATED'
            WHEN 'cheese everyday' THEN 'DAIRY & REFRIGERATED'
            WHEN 'freezer fish' THEN 'FROZEN FOODS'
            WHEN 'freezer desserts and pastry' THEN 'FROZEN FOODS'
            WHEN 'oils cooking' THEN 'PANTRY'
            WHEN 'longlife juice drinks' THEN 'BEVERAGES'
            WHEN 'cordial drink bases' THEN 'BEVERAGES'
            WHEN 'freezer poultry' THEN 'FROZEN FOODS'
            WHEN 'dairy milk' THEN 'DAIRY & REFRIGERATED'
            WHEN 'garden aids seeds bulbs' THEN 'MISCELLANEOUS'
            WHEN 'haberdashery' THEN 'MISCELLANEOUS'
            WHEN 'health foods' THEN 'HEALTH FOOD & SUPPLEMENTS'
            WHEN 'dairy entertaining' THEN 'DAIRY & REFRIGERATED'
            WHEN 'dairy snacks' THEN 'DAIRY & REFRIGERATED'
            WHEN 'apparel' THEN 'MISCELLANEOUS'
            WHEN 'dairy cream' THEN 'DAIRY & REFRIGERATED'
            WHEN 'freezer vegetables' THEN 'FROZEN FOODS'
            WHEN 'instore bakery' THEN 'BAKERY'
            WHEN 'household cleaning' THEN 'HOUSEHOLD ITEMS'
            WHEN 'seafood convenience' THEN 'CONVENIENCE FOOD'
            WHEN 'electrical' THEN 'MISCELLANEOUS'
            WHEN 'babywear layette' THEN 'BABY FOOD & ACCESSORIES'
            WHEN 'dairy plant based and ethnic' THEN 'HEALTH FOOD & SUPPLEMENTS'
            WHEN 'seafood' THEN 'POULTRY, MEAT & SEAFOOD'
            WHEN 'fruit' THEN 'FRUIT, VEG & PRODUCE'
            WHEN '' THEN 'MISCELLANEOUS'
            ELSE 'MISCELLANEOUS'
        END AS category_name
    FROM prepared
),
deduplicated AS (
    SELECT
        *,
        CASE
            WHEN pack_quantity IS NULL THEN ''
            ELSE rtrim(
                regexp_replace(printf('%.3f', pack_quantity), '0+$', ''),
                '.'
            )
        END AS pack_quantity_key,
        brand_name_key
            || '|'
            || product_name_key
            || '|'
            || CASE
                WHEN pack_quantity IS NULL THEN ''
                ELSE rtrim(
                    regexp_replace(printf('%.3f', pack_quantity), '0+$', ''),
                    '.'
                )
            END
            || '|'
            || coalesce(pack_uom, '') AS canonical_key,
        row_number() OVER (
            PARTITION BY
                coalesce(raw_gtin, raw_product_id),
                recorded_at,
                coalesce(price, -1),
                coalesce(cup_price, -1)
            ORDER BY source_file DESC, item_name DESC
        ) AS dedupe_rank
    FROM categorized
)
SELECT
    raw_product_id,
    raw_gtin AS gtin,
    raw_gtin AS match_gtin,
    item_name,
    item_name AS standardized_product_name,
    brand_name,
    category_name,
    NULLIF(pack_quantity, 0) AS pack_quantity,
    pack_uom,
    image_link_side,
    product_url,
    special_text,
    CAST(price AS DECIMAL(10, 2)) AS price,
    CAST(coalesce(cup_price, price / nullif(pack_quantity, 0)) AS DECIMAL(12, 4)) AS unit_price,
    coalesce(is_on_special, special_text IS NOT NULL, FALSE) AS is_on_special,
    recorded_at,
    source_file,
    canonical_key,
    coalesce(raw_gtin, raw_product_id, canonical_key) AS source_product_key
FROM deduplicated
WHERE dedupe_rank = 1
  AND raw_product_id IS NOT NULL
  AND item_name IS NOT NULL
  AND item_name <> ''
  AND price IS NOT NULL
  AND price > 0
  AND recorded_at IS NOT NULL
  AND product_url IS NOT NULL;
