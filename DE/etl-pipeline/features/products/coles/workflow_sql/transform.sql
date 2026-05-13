CREATE OR REPLACE TABLE raw_input_normalized AS
WITH cleaned AS (
    SELECT
        trim(ProductId) AS raw_product_id,
        trim(Name) AS item_name,
        NULLIF(trim(Brand), '') AS brand_name,
        NULLIF(trim(Size), '') AS raw_size,
        NULLIF(trim(ImageUri), '') AS image_link_side,
        NULLIF(trim(CategoryGroup), '') AS category_group,
        NULLIF(trim(Category), '') AS category_name_raw,
        NULLIF(trim(SubCategory), '') AS subcategory_name_raw,
        NULLIF(trim(ClassName), '') AS class_name_raw,
        NULLIF(trim(OnlineSubCategory), '') AS online_subcategory,
        NULLIF(trim(OnlineCategory), '') AS online_category,
        NULLIF(trim(SaveStatement), '') AS save_statement,
        NULLIF(trim(OfferDescription), '') AS offer_description,
        NULLIF(trim(PromotionType), '') AS promotion_type,
        NULLIF(trim(SpecialType), '') AS special_type,
        NULLIF(trim(Comparable), '') AS comparable,
        TRY_CAST(
            regexp_replace(coalesce(CAST(Price_Now AS VARCHAR), ''), '[^0-9.-]', '', 'g')
            AS DOUBLE
        ) AS price,
        TRY_CAST(
            regexp_replace(coalesce(CAST(Price_Was AS VARCHAR), ''), '[^0-9.-]', '', 'g')
            AS DOUBLE
        ) AS price_was,
        TRY_CAST(
            regexp_replace(coalesce(CAST(UnitPrice AS VARCHAR), ''), '[^0-9.-]', '', 'g')
            AS DOUBLE
        ) AS unit_price,
        TRY_CAST(Timestamp AS TIMESTAMP) AS recorded_at,
        CASE
            WHEN lower(trim(coalesce(CAST(OnlineSpecial AS VARCHAR), ''))) IN ('true', '1', 'yes', 'y') THEN TRUE
            WHEN lower(trim(coalesce(CAST(OnlineSpecial AS VARCHAR), ''))) IN ('false', '0', 'no', 'n') THEN FALSE
            ELSE NULL
        END AS online_special,
        source_file
    FROM raw_input
),
parsed AS (
    SELECT
        *,
        lower(coalesce(online_subcategory, '')) AS online_subcategory_lower,
        lower(coalesce(online_category, '')) AS online_category_lower,
        lower(coalesce(category_group, '')) AS category_group_lower,
        trim(regexp_replace(lower(coalesce(item_name, '')), '[^a-z0-9]+', ' ', 'g')) AS product_name_key,
        trim(regexp_replace(lower(coalesce(brand_name, '')), '[^a-z0-9]+', ' ', 'g')) AS brand_name_key,
        NULLIF(
            TRY_CAST(
                NULLIF(regexp_extract(lower(coalesce(raw_size, '')), '^([0-9]+(?:\.[0-9]+)?)', 1), '')
                AS DOUBLE
            ),
            0
        ) AS pack_quantity,
        CASE lower(NULLIF(regexp_extract(lower(coalesce(raw_size, '')), '^[0-9]+(?:\.[0-9]+)?\s*([a-z]+)', 1), ''))
            WHEN 'g' THEN 'g'
            WHEN 'gram' THEN 'g'
            WHEN 'grams' THEN 'g'
            WHEN 'kg' THEN 'kg'
            WHEN 'kilo' THEN 'kg'
            WHEN 'kilos' THEN 'kg'
            WHEN 'ml' THEN 'ml'
            WHEN 'l' THEN 'l'
            WHEN 'lt' THEN 'l'
            WHEN 'ltr' THEN 'l'
            WHEN 'litre' THEN 'l'
            WHEN 'litres' THEN 'l'
            WHEN 'liter' THEN 'l'
            WHEN 'liters' THEN 'l'
            WHEN 'ea' THEN 'ea'
            WHEN 'each' THEN 'ea'
            WHEN 'pack' THEN 'pack'
            WHEN 'pk' THEN 'pack'
            WHEN 'm' THEN 'm'
            WHEN 'metre' THEN 'm'
            WHEN 'meter' THEN 'm'
            ELSE NULL
        END AS pack_uom,
        COALESCE(
            save_statement,
            offer_description,
            CASE
                WHEN lower(coalesce(promotion_type, '')) NOT IN ('', 'everyday') THEN promotion_type
                ELSE NULL
            END,
            CASE
                WHEN lower(coalesce(special_type, '')) NOT IN ('', 'everyday') THEN special_type
                ELSE NULL
            END,
            CASE
                WHEN upper(coalesce(comparable, '')) = 'SPECIAL' THEN comparable
                ELSE NULL
            END
        ) AS special_text,
        CASE
            WHEN COALESCE(price, 0) < COALESCE(price_was, 0) THEN TRUE
            WHEN upper(coalesce(comparable, '')) = 'SPECIAL' THEN TRUE
            WHEN online_special IS TRUE THEN TRUE
            WHEN lower(coalesce(promotion_type, '')) NOT IN ('', 'everyday') THEN TRUE
            WHEN lower(coalesce(special_type, '')) NOT IN ('', 'everyday') THEN TRUE
            ELSE FALSE
        END AS is_on_special
    FROM cleaned
),
categorized AS (
    SELECT
        *,
        CASE
            WHEN online_subcategory_lower IN ('back to school', 'easter') THEN 'SEASONAL'
            WHEN online_category_lower LIKE '%easter%' THEN 'SEASONAL'
            WHEN online_subcategory_lower IN (
                'down down',
                'big pack value',
                'bonus credit products',
                'deliver more range'
            ) THEN 'SPECIALS'
            WHEN online_category_lower = 'international foods' THEN 'CONTINENTAL'
            WHEN online_category_lower IN ('ready to eat meals', 'frozen meals') THEN 'CONVENIENCE FOOD'
            WHEN online_category_lower LIKE '%health foods%' THEN 'HEALTH FOOD & SUPPLEMENTS'
            WHEN online_category_lower LIKE '%sports nutrition%' THEN 'HEALTH FOOD & SUPPLEMENTS'
            WHEN online_category_lower LIKE '%vitamin%' THEN 'HEALTH FOOD & SUPPLEMENTS'
            WHEN online_category_lower LIKE '%supplement%' THEN 'HEALTH FOOD & SUPPLEMENTS'
            WHEN online_category_lower LIKE '%diet%' THEN 'HEALTH FOOD & SUPPLEMENTS'
            WHEN online_category_lower LIKE '%vegan%' THEN 'HEALTH FOOD & SUPPLEMENTS'
            WHEN online_category_lower LIKE '%vegetarian%' THEN 'HEALTH FOOD & SUPPLEMENTS'
            WHEN online_subcategory_lower = 'liquorland' THEN 'ALCOHOL'
            WHEN online_subcategory_lower = 'baby' THEN 'BABY FOOD & ACCESSORIES'
            WHEN online_subcategory_lower = 'bakery' THEN 'BAKERY'
            WHEN online_subcategory_lower = 'drinks' THEN 'BEVERAGES'
            WHEN online_subcategory_lower = 'pantry' THEN 'PANTRY'
            WHEN online_subcategory_lower = 'chips, chocolates & snacks' THEN 'SNACKS & CONFECTIONARY'
            WHEN online_subcategory_lower = 'dairy, eggs & fridge' THEN 'DAIRY & REFRIGERATED'
            WHEN online_subcategory_lower = 'deli' THEN 'DELI & CHILLED MEALS'
            WHEN online_subcategory_lower = 'frozen' THEN 'FROZEN FOODS'
            WHEN online_subcategory_lower = 'fruit & vegetables' THEN 'FRUIT, VEG & PRODUCE'
            WHEN online_subcategory_lower = 'health & beauty' THEN 'HEALTH & BEAUTY'
            WHEN online_subcategory_lower IN ('cleaning & laundry', 'home & garden') THEN 'HOUSEHOLD ITEMS'
            WHEN online_subcategory_lower = 'pet' THEN 'PET FOOD & ACCESSORIES'
            WHEN online_subcategory_lower = 'meat & seafood' THEN 'POULTRY, MEAT & SEAFOOD'
            WHEN online_category_lower LIKE '%deli%' THEN 'DELI & CHILLED MEALS'
            WHEN category_group_lower IN (
                'poultry',
                'beef/veal',
                'pork/hams/bacon',
                'seafood',
                'lamb',
                'game'
            ) THEN 'POULTRY, MEAT & SEAFOOD'
            ELSE 'MISCELLANEOUS'
        END AS category_name
    FROM parsed
),
deduplicated AS (
    SELECT
        *,
        CASE
            WHEN pack_quantity IS NULL THEN ''
            ELSE regexp_replace(
                regexp_replace(printf('%.3f', pack_quantity), '0+$', ''),
                '\.$',
                ''
            )
        END AS pack_quantity_key,
        row_number() OVER (
            PARTITION BY
                raw_product_id,
                recorded_at,
                item_name,
                COALESCE(price, -1),
                COALESCE(unit_price, -1),
                source_file
            ORDER BY source_file
        ) AS dedupe_rank
    FROM categorized
)
SELECT
    raw_product_id,
    item_name,
    brand_name,
    raw_size,
    pack_quantity,
    pack_uom,
    pack_quantity_key,
    image_link_side,
    category_name,
    special_text,
    price,
    unit_price,
    is_on_special,
    recorded_at,
    source_file,
    brand_name_key || '|' || product_name_key || '|' || pack_quantity_key || '|' || COALESCE(pack_uom, '') AS canonical_key
FROM deduplicated
WHERE
    dedupe_rank = 1
    AND raw_product_id IS NOT NULL
    AND item_name IS NOT NULL
    AND price IS NOT NULL
    AND recorded_at IS NOT NULL
