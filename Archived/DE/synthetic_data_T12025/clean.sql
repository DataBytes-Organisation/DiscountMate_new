BEGIN;

---------------------------------------------
-- Clean Users Table
---------------------------------------------
CREATE TABLE users_clean AS
SELECT DISTINCT
    _id,
    TRIM(COALESCE(account_user_name, 'unknown')) AS account_user_name,
    COALESCE(best_price_id, 'N/A') AS best_price_id,
    TRIM(COALESCE(created_by, 'unknown')) AS created_by,
    COALESCE(date_created, CURRENT_TIMESTAMP) AS date_created,
    TRIM(COALESCE(login_email, 'unknown@example.com')) AS login_email,
    COALESCE(latitude, 0) AS latitude,
    COALESCE(longitude, 0) AS longitude
FROM users_dirty;

-- Drop any redundant columns
DO $$
DECLARE
    col RECORD;
BEGIN
    FOR col IN 
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='users_clean' AND column_name LIKE 'redundant_%'
    LOOP
        EXECUTE format('ALTER TABLE users_clean DROP COLUMN %I', col.column_name);
    END LOOP;
END$$;

DROP TABLE users_dirty;
ALTER TABLE users_clean RENAME TO users;

---------------------------------------------
-- Clean Stores Table
---------------------------------------------
CREATE TABLE stores_clean AS
SELECT DISTINCT
    _id,
    TRIM(COALESCE(store_name, 'unknown')) AS store_name,
    TRIM(COALESCE(store_chain, 'unknown')) AS store_chain,
    TRIM(COALESCE(store_address, 'unknown')) AS store_address,
    TRIM(COALESCE(store_suburb, 'unknown')) AS store_suburb,
    TRIM(COALESCE(store_city, 'unknown')) AS store_city,
    COALESCE(post_code, '0000') AS post_code,
    TRIM(COALESCE(phone_number, '0000000000')) AS phone_number,
    TRIM(COALESCE(link_image, '')) AS link_image
FROM stores_dirty;

-- Drop any redundant columns
DO $$
DECLARE
    col RECORD;
BEGIN
    FOR col IN 
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='stores_clean' AND column_name LIKE 'redundant_%'
    LOOP
        EXECUTE format('ALTER TABLE stores_clean DROP COLUMN %I', col.column_name);
    END LOOP;
END$$;

DROP TABLE stores_dirty;
ALTER TABLE stores_clean RENAME TO stores;

---------------------------------------------
-- Clean Products Table
---------------------------------------------
CREATE TABLE products_clean AS
SELECT DISTINCT
    _id,
    TRIM(COALESCE(product_code, 'UNKNOWN')) AS product_code,
    TRIM(COALESCE(product_name, 'unknown')) AS product_name,
    TRIM(COALESCE(brand, 'unknown')) AS brand,
    TRIM(COALESCE(sub_category, 'unknown')) AS sub_category,
    COALESCE(currency_price, 'AUD') AS currency_price,
    COALESCE(current_price, 0) AS current_price,
    TRIM(COALESCE(measurement_unit, 'unit')) AS measurement_unit,
    TRIM(COALESCE(link_image, '')) AS link_image
FROM products_dirty;

-- Drop any redundant columns
DO $$
DECLARE
    col RECORD;
BEGIN
    FOR col IN 
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='products_clean' AND column_name LIKE 'redundant_%'
    LOOP
        EXECUTE format('ALTER TABLE products_clean DROP COLUMN %I', col.column_name);
    END LOOP;
END$$;

DROP TABLE products_dirty;
ALTER TABLE products_clean RENAME TO products;

---------------------------------------------
-- Clean Product Pricing Table
---------------------------------------------
CREATE TABLE product_pricing_clean AS
SELECT DISTINCT
    _id,
    COALESCE(product_id, 'unknown') AS product_id,
    COALESCE(date, CURRENT_TIMESTAMP) AS date,
    COALESCE(price, 0) AS price
FROM product_pricing_dirty;

-- Drop any redundant columns
DO $$
DECLARE
    col RECORD;
BEGIN
    FOR col IN 
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='product_pricing_clean' AND column_name LIKE 'redundant_%'
    LOOP
        EXECUTE format('ALTER TABLE product_pricing_clean DROP COLUMN %I', col.column_name);
    END LOOP;
END$$;

DROP TABLE product_pricing_dirty;
ALTER TABLE product_pricing_clean RENAME TO product_pricing;

---------------------------------------------
-- Clean Baskets Table
---------------------------------------------
CREATE TABLE baskets_clean AS
SELECT DISTINCT
    _id,
    COALESCE(user_id, 'unknown') AS user_id,
    COALESCE(product_id, 'unknown') AS product_id,
    COALESCE(store_id, 'unknown') AS store_id,
    COALESCE(date_created, CURRENT_TIMESTAMP) AS date_created,
    COALESCE(quantity, 1) AS quantity,
    COALESCE(total_price, 0) AS total_price
FROM baskets_dirty;

-- Drop any redundant columns
DO $$
DECLARE
    col RECORD;
BEGIN
    FOR col IN 
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='baskets_clean' AND column_name LIKE 'redundant_%'
    LOOP
        EXECUTE format('ALTER TABLE baskets_clean DROP COLUMN %I', col.column_name);
    END LOOP;
END$$;

DROP TABLE baskets_dirty;
ALTER TABLE baskets_clean RENAME TO baskets;

---------------------------------------------
-- Clean Shopping Lists Table
---------------------------------------------
CREATE TABLE shopping_lists_clean AS
SELECT DISTINCT
    _id,
    COALESCE(user_id, 'unknown') AS user_id,
    COALESCE(date_created, CURRENT_TIMESTAMP) AS date_created
FROM shopping_lists_dirty;

-- Drop any redundant columns
DO $$
DECLARE
    col RECORD;
BEGIN
    FOR col IN 
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='shopping_lists_clean' AND column_name LIKE 'redundant_%'
    LOOP
        EXECUTE format('ALTER TABLE shopping_lists_clean DROP COLUMN %I', col.column_name);
    END LOOP;
END$$;

DROP TABLE shopping_lists_dirty;
ALTER TABLE shopping_lists_clean RENAME TO shopping_lists;

---------------------------------------------
-- Clean Shopping List Items Table
---------------------------------------------
CREATE TABLE shopping_list_items_clean AS
SELECT DISTINCT
    _id,
    COALESCE(shopping_list_id, 'unknown') AS shopping_list_id,
    TRIM(COALESCE(item_name, 'unknown')) AS item_name,
    COALESCE(quantity, 1) AS quantity,
    TRIM(COALESCE(note, '')) AS note
FROM shopping_list_items_dirty;

-- Drop any redundant columns
DO $$
DECLARE
    col RECORD;
BEGIN
    FOR col IN 
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='shopping_list_items_clean' AND column_name LIKE 'redundant_%'
    LOOP
        EXECUTE format('ALTER TABLE shopping_list_items_clean DROP COLUMN %I', col.column_name);
    END LOOP;
END$$;

DROP TABLE shopping_list_items_dirty;
ALTER TABLE shopping_list_items_clean RENAME TO shopping_list_items;

COMMIT;
