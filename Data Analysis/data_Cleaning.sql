-- Remove Duplicates
CREATE TABLE cleaned_coles_data AS
SELECT DISTINCT *
FROM coles_data;

CREATE TABLE cleaned_woolies_data AS
SELECT DISTINCT *
FROM woolies_data;

-- Filter rows based on category (for Coles)
DELETE FROM cleaned_coles_data
WHERE category = 'Bonus Ovenware Credits';

-- Filter rows based on category (for Woolies)
DELETE FROM cleaned_woolies_data
WHERE category = 'Electronics' OR category ='Home & Lifestyle';


-- Convert price columns to numeric (remove non-numeric characters)
UPDATE cleaned_coles_data
SET best_price = CAST(REGEXP_REPLACE(best_price::TEXT, '[^\d.]', '', 'g') AS DECIMAL(10, 2)),
    item_price = CAST(REGEXP_REPLACE(item_price::TEXT, '[^\d.]', '', 'g') AS DECIMAL(10, 2)),
    best_unit_price = CAST(REGEXP_REPLACE(best_unit_price::TEXT, '[^\d.]', '', 'g') AS DECIMAL(10, 2)),
    unit_price = CAST(REGEXP_REPLACE(unit_price::TEXT, '[^\d.]', '', 'g') AS DECIMAL(10, 2));

UPDATE cleaned_woolies_data
SET best_price = CAST(REGEXP_REPLACE(best_price::TEXT, '[^\d.]', '', 'g') AS DECIMAL(10, 2)),
    item_price = CAST(REGEXP_REPLACE(item_price::TEXT, '[^\d.]', '', 'g') AS DECIMAL(10, 2)),
    best_unit_price = CAST(REGEXP_REPLACE(best_unit_price::TEXT, '[^\d.]', '', 'g') AS DECIMAL(10, 2)),
    unit_price = CAST(REGEXP_REPLACE(unit_price::TEXT, '[^\d.]', '', 'g') AS DECIMAL(10, 2));

-- Remove rows with missing values in key columns
DELETE FROM cleaned_coles_data
WHERE best_price IS NULL
   OR item_price IS NULL
   OR best_unit_price IS NULL
   OR unit_price IS NULL;

DELETE FROM cleaned_woolies_data
WHERE best_price IS NULL
   OR item_price IS NULL
   OR best_unit_price IS NULL

   OR price_was IS NULL
   OR unit_price IS NULL;

SELECT product_code, category, item_name, COUNT(*)
FROM cleaned_coles_data
GROUP BY product_code, category, item_name
HAVING COUNT(*) > 1;

SELECT * FROM cleaned_coles_data LIMIT 5;
SELECT * FROM cleaned_woolies_data LIMIT 5;

