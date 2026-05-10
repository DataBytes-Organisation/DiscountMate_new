CREATE OR REPLACE TABLE raw_input_normalized AS
WITH cleaned AS (
    SELECT
        NULLIF(
            trim(
                coalesce(
                    CAST(iga_product_id AS VARCHAR),
                    CAST(iga_productid AS VARCHAR),
                    CAST(sku AS VARCHAR),
                    CAST(iga_sku AS VARCHAR)
                )
            ),
            ''
        ) AS raw_product_id,
        NULLIF(
            trim(
                coalesce(
                    CAST(barcode AS VARCHAR),
                    CAST(iga_barcode AS VARCHAR)
                )
            ),
            ''
        ) AS raw_gtin,
        NULLIF(
            trim(
                coalesce(
                    CAST(name AS VARCHAR),
                    CAST(iga_name AS VARCHAR)
                )
            ),
            ''
        ) AS item_name,
        NULLIF(
            trim(
                coalesce(
                    CAST(brand_name AS VARCHAR),
                    CAST(brandname AS VARCHAR),
                    CAST(iga_brand AS VARCHAR)
                )
            ),
            ''
        ) AS brand_name,
        NULLIF(
            trim(
                coalesce(
                    CAST(primary_image_url AS VARCHAR),
                    CAST(primaryimageurl AS VARCHAR),
                    CAST(iga_image_default AS VARCHAR),
                    CAST(iga_image_cell AS VARCHAR),
                    CAST(iga_image_details AS VARCHAR),
                    CAST(iga_image_zoom AS VARCHAR)
                )
            ),
            ''
        ) AS image_link_side,
        NULLIF(trim(CAST(iga_categories AS VARCHAR)), '') AS raw_categories,
        NULLIF(
            trim(
                coalesce(
                    CAST(iga_default_category AS VARCHAR),
                    CAST(iga_defaultcategory AS VARCHAR)
                )
            ),
            ''
        ) AS raw_default_category,
        NULLIF(
            trim(
                coalesce(
                    CAST(price_label AS VARCHAR),
                    CAST(pricelabel AS VARCHAR),
                    CAST(iga_price_label AS VARCHAR),
                    CAST(iga_pricelabel AS VARCHAR)
                )
            ),
            ''
        ) AS price_label,
        lower(
            trim(
                coalesce(
                    CAST(price_source AS VARCHAR),
                    CAST(pricesource AS VARCHAR),
                    CAST(iga_price_source AS VARCHAR),
                    CAST(iga_pricesource AS VARCHAR),
                    ''
                )
            )
        ) AS price_source,
        CASE
            WHEN NULLIF(
                trim(
                    coalesce(
                        CAST(iga_product_id AS VARCHAR),
                        CAST(iga_productid AS VARCHAR),
                        CAST(sku AS VARCHAR),
                        CAST(iga_sku AS VARCHAR)
                    )
                ),
                ''
            ) IS NULL THEN NULL
            ELSE 'https://www.igashop.com.au/product/'
                || trim(
                    coalesce(
                        CAST(iga_product_id AS VARCHAR),
                        CAST(iga_productid AS VARCHAR),
                        CAST(sku AS VARCHAR),
                        CAST(iga_sku AS VARCHAR)
                    )
                )
        END AS product_url,
        TRY_CAST(
            coalesce(
                CAST(price_numeric AS VARCHAR),
                CAST(pricenumeric AS VARCHAR),
                CAST(iga_price_numeric AS VARCHAR),
                CAST(iga_pricenumeric AS VARCHAR)
            ) AS DOUBLE
        ) AS price,
        COALESCE(
            TRY_CAST(
                regexp_extract(
                    coalesce(
                        CAST(price_per_unit AS VARCHAR),
                        CAST(priceperunit AS VARCHAR),
                        CAST(iga_price_per_unit AS VARCHAR),
                        CAST(iga_priceperunit AS VARCHAR),
                        ''
                    ),
                    '\\$([0-9]+\\.?[0-9]*)',
                    1
                ) AS DOUBLE
            ),
            round(
                TRY_CAST(
                    coalesce(
                        CAST(price_numeric AS VARCHAR),
                        CAST(pricenumeric AS VARCHAR),
                        CAST(iga_price_numeric AS VARCHAR),
                        CAST(iga_pricenumeric AS VARCHAR)
                    ) AS DOUBLE
                ) / NULLIF(
                    TRY_CAST(
                        coalesce(
                            CAST(iga_unit_of_size_size AS VARCHAR),
                            CAST(iga_unitofsize_size AS VARCHAR),
                            CAST(iga_unit_of_measure_size AS VARCHAR),
                            CAST(iga_unitofmeasure_size AS VARCHAR)
                        ) AS DOUBLE
                    ),
                    0
                ),
                4
            )
        ) AS unit_price,
        TRY_CAST(
            coalesce(
                CAST(scraped_at AS VARCHAR),
                CAST(scrapedat AS VARCHAR)
            ) AS TIMESTAMP
        ) AS recorded_at,
        CASE
            WHEN lower(
                trim(
                    coalesce(
                        CAST(price_source AS VARCHAR),
                        CAST(pricesource AS VARCHAR),
                        CAST(iga_price_source AS VARCHAR),
                        CAST(iga_pricesource AS VARCHAR),
                        ''
                    )
                )
            ) = 'tpr' THEN TRUE
            ELSE FALSE
        END AS is_on_special,
        TRY_CAST(
            coalesce(
                CAST(iga_unit_of_size_size AS VARCHAR),
                CAST(iga_unitofsize_size AS VARCHAR),
                CAST(iga_unit_of_measure_size AS VARCHAR),
                CAST(iga_unitofmeasure_size AS VARCHAR)
            ) AS DOUBLE
        ) AS pack_quantity_raw,
        lower(
            trim(
                coalesce(
                    CAST(iga_unit_of_size_type AS VARCHAR),
                    CAST(iga_unitofsize_type AS VARCHAR),
                    CAST(iga_unit_of_measure_type AS VARCHAR),
                    CAST(iga_unitofmeasure_type AS VARCHAR),
                    ''
                )
            )
        ) AS pack_uom_raw,
        lower(
            trim(
                coalesce(
                    TRY(
                        json_extract_string(
                            coalesce(
                                CAST(iga_default_category AS VARCHAR),
                                CAST(iga_defaultcategory AS VARCHAR)
                            ),
                            '$[0].category'
                        )
                    ),
                    ''
                )
            )
        ) AS default_category_lower,
        lower(trim(coalesce(TRY(json_extract_string(iga_categories, '$[1].category')), ''))) AS category_group_lower,
        source_file
    FROM raw_input
),
gtin_normalized AS (
    SELECT
        *,
        regexp_extract_all(coalesce(raw_gtin, ''), '[0-9]{8,14}') AS gtin_candidates
    FROM cleaned
),
prepared AS (
    SELECT
        *,
        coalesce(
            list_extract(list_filter(gtin_candidates, candidate -> length(candidate) = 14), 1),
            list_extract(list_filter(gtin_candidates, candidate -> length(candidate) = 13), 1),
            list_extract(list_filter(gtin_candidates, candidate -> length(candidate) = 12), 1),
            list_extract(list_filter(gtin_candidates, candidate -> length(candidate) = 11), 1),
            list_extract(list_filter(gtin_candidates, candidate -> length(candidate) = 10), 1),
            list_extract(list_filter(gtin_candidates, candidate -> length(candidate) = 9), 1),
            list_extract(list_filter(gtin_candidates, candidate -> length(candidate) = 8), 1)
        ) AS match_gtin,
        trim(regexp_replace(lower(coalesce(item_name, '')), '[^a-z0-9]+', ' ', 'g')) AS product_name_key,
        trim(regexp_replace(lower(coalesce(brand_name, '')), '[^a-z0-9]+', ' ', 'g')) AS brand_name_key,
        CASE
            WHEN item_name IS NULL THEN NULL
            WHEN brand_name IS NULL THEN item_name
            WHEN lower(item_name) LIKE lower(brand_name) || '%' THEN coalesce(
                NULLIF(
                    trim(
                        regexp_replace(
                            substr(item_name, length(brand_name) + 1),
                            '^[[:space:][:punct:]]+',
                            ''
                        )
                    ),
                    ''
                ),
                item_name
            )
            ELSE item_name
        END AS standardized_product_name,
        NULLIF(pack_quantity_raw, 0) AS pack_quantity,
        CASE pack_uom_raw
            WHEN 'gram' THEN 'g'
            WHEN 'g' THEN 'g'
            WHEN 'kilogram' THEN 'kg'
            WHEN 'kg' THEN 'kg'
            WHEN 'millilitre' THEN 'ml'
            WHEN 'milliliter' THEN 'ml'
            WHEN 'ml' THEN 'ml'
            WHEN 'litre' THEN 'l'
            WHEN 'liter' THEN 'l'
            WHEN 'l' THEN 'l'
            WHEN 'each' THEN 'ea'
            WHEN 'ea' THEN 'ea'
            WHEN 'pack' THEN 'pack'
            WHEN 'pk' THEN 'pack'
            WHEN 'metre' THEN 'm'
            WHEN 'meter' THEN 'm'
            WHEN 'm' THEN 'm'
            ELSE NULL
        END AS pack_uom,
        CASE
            WHEN category_group_lower = 'baby' THEN 'BABY FOOD & ACCESSORIES'
            WHEN category_group_lower = 'bakery' THEN 'BAKERY'
            WHEN category_group_lower = 'drinks' THEN 'BEVERAGES'
            WHEN category_group_lower = 'dairy, eggs and fridge' THEN 'DAIRY & REFRIGERATED'
            WHEN category_group_lower = 'frozen' THEN 'FROZEN FOODS'
            WHEN category_group_lower = 'fruit and vegetable' THEN 'FRUIT, VEG & PRODUCE'
            WHEN category_group_lower = 'health and beauty' THEN 'HEALTH & BEAUTY'
            WHEN category_group_lower = 'household' THEN 'HOUSEHOLD ITEMS'
            WHEN category_group_lower = 'liquor' THEN 'ALCOHOL'
            WHEN category_group_lower = 'meat, seafood and deli' THEN 'POULTRY, MEAT & SEAFOOD'
            WHEN category_group_lower = 'pantry' THEN 'PANTRY'
            WHEN category_group_lower = 'pet' THEN 'PET FOOD & ACCESSORIES'
            WHEN category_group_lower IN ('front of house', 'other', '') THEN 'MISCELLANEOUS'
            WHEN default_category_lower LIKE '%snack%' THEN 'SNACKS & CONFECTIONARY'
            WHEN default_category_lower LIKE '%chocolate%' THEN 'SNACKS & CONFECTIONARY'
            WHEN default_category_lower LIKE '%lollies%' THEN 'SNACKS & CONFECTIONARY'
            WHEN default_category_lower LIKE '%chips%' THEN 'SNACKS & CONFECTIONARY'
            WHEN default_category_lower LIKE '%ready to eat%' THEN 'CONVENIENCE FOOD'
            WHEN default_category_lower LIKE '%meal%' THEN 'CONVENIENCE FOOD'
            WHEN default_category_lower LIKE '%asian%' THEN 'CONTINENTAL'
            WHEN default_category_lower LIKE '%thai%' THEN 'CONTINENTAL'
            ELSE 'MISCELLANEOUS'
        END AS category_name,
        coalesce(
            price_label,
            CASE
                WHEN price_source = 'tpr' THEN 'TPR'
                ELSE NULL
            END
        ) AS special_text
    FROM gtin_normalized
),
normalized_identity AS (
    SELECT
        *,
        trim(
            regexp_replace(
                lower(coalesce(standardized_product_name, item_name, '')),
                '[^a-z0-9]+',
                ' ',
                'g'
            )
        ) AS standardized_product_name_key,
        CASE
            WHEN brand_name_key <> '' AND standardized_product_name_key LIKE brand_name_key || ' %'
                THEN substr(standardized_product_name_key, length(brand_name_key) + 2)
            ELSE standardized_product_name_key
        END AS canonical_product_name_key,
        CASE
            WHEN pack_quantity IS NULL THEN ''
            ELSE rtrim(
                regexp_replace(printf('%.3f', pack_quantity), '0+$', ''),
                '.'
            )
        END AS pack_quantity_key
    FROM prepared
),
deduplicated AS (
    SELECT
        *,
        brand_name_key
            || '|'
            || coalesce(NULLIF(canonical_product_name_key, ''), standardized_product_name_key)
            || '|'
            || pack_quantity_key
            || '|'
            || coalesce(pack_uom, '') AS canonical_key,
        coalesce(
            match_gtin,
            raw_product_id,
            brand_name_key
                || '|'
                || coalesce(NULLIF(canonical_product_name_key, ''), standardized_product_name_key)
                || '|'
                || pack_quantity_key
                || '|'
                || coalesce(pack_uom, '')
        ) AS source_product_key,
        row_number() OVER (
            PARTITION BY
                coalesce(
                    match_gtin,
                    raw_product_id,
                    brand_name_key
                        || '|'
                        || coalesce(NULLIF(canonical_product_name_key, ''), standardized_product_name_key)
                        || '|'
                        || pack_quantity_key
                        || '|'
                        || coalesce(pack_uom, '')
                ),
                recorded_at,
                coalesce(price, -1),
                coalesce(unit_price, -1),
                coalesce(special_text, '')
            ORDER BY source_file DESC, item_name DESC
        ) AS dedupe_rank
    FROM normalized_identity
)
SELECT
    raw_product_id,
    match_gtin AS gtin,
    match_gtin,
    item_name,
    standardized_product_name,
    brand_name,
    category_name,
    pack_quantity,
    pack_uom,
    image_link_side,
    product_url,
    special_text,
    price,
    unit_price,
    is_on_special,
    recorded_at,
    source_file,
    canonical_key,
    source_product_key
FROM deduplicated
WHERE
    dedupe_rank = 1
    AND item_name IS NOT NULL
    AND item_name <> ''
    AND price IS NOT NULL
    AND recorded_at IS NOT NULL
