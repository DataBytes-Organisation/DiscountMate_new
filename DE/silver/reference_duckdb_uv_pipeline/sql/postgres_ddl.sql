CREATE SCHEMA IF NOT EXISTS silver;

CREATE TABLE IF NOT EXISTS silver.products_core (
    retailer TEXT NOT NULL,
    product_id TEXT,
    store_id TEXT,
    product_name TEXT NOT NULL,
    brand_name TEXT,
    description TEXT,
    pack_size TEXT,
    category TEXT,
    image_url TEXT,
    product_url TEXT,
    scraped_at TIMESTAMP,
    run_date DATE NOT NULL,
    source_file TEXT NOT NULL,
    raw_record_id TEXT,
    loaded_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS silver.product_pricing (
    retailer TEXT NOT NULL,
    product_id TEXT,
    current_price DOUBLE PRECISION NOT NULL,
    previous_price DOUBLE PRECISION,
    discount_amount DOUBLE PRECISION,
    price_per_unit DOUBLE PRECISION,
    unit_measure TEXT,
    unit_quantity DOUBLE PRECISION,
    is_on_special BOOLEAN,
    promotion_type TEXT,
    offer_description TEXT,
    currency_code TEXT,
    scraped_at TIMESTAMP,
    run_date DATE NOT NULL,
    source_file TEXT NOT NULL,
    raw_record_id TEXT,
    loaded_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS silver.product_availability (
    retailer TEXT NOT NULL,
    product_id TEXT,
    availability TEXT,
    availability_type TEXT,
    available_quantity DOUBLE PRECISION,
    supply_limit DOUBLE PRECISION,
    product_limit DOUBLE PRECISION,
    age_restricted BOOLEAN,
    alcohol_flag BOOLEAN,
    discontinued BOOLEAN,
    not_for_sale BOOLEAN,
    scraped_at TIMESTAMP,
    run_date DATE NOT NULL,
    source_file TEXT NOT NULL,
    raw_record_id TEXT,
    loaded_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS silver.product_extended (
    retailer TEXT NOT NULL,
    product_id TEXT,
    store_id TEXT,
    raw_category TEXT,
    source_file TEXT NOT NULL,
    raw_record_id TEXT,
    raw_json TEXT,
    scraped_at TIMESTAMP,
    run_date DATE NOT NULL,
    loaded_at TIMESTAMP NOT NULL
);

ALTER TABLE silver.products_core
    ADD COLUMN IF NOT EXISTS run_date DATE;

ALTER TABLE silver.product_pricing
    ADD COLUMN IF NOT EXISTS run_date DATE;

ALTER TABLE silver.product_availability
    ADD COLUMN IF NOT EXISTS run_date DATE;

ALTER TABLE silver.product_extended
    ADD COLUMN IF NOT EXISTS run_date DATE;

CREATE INDEX IF NOT EXISTS idx_products_core_slice
    ON silver.products_core (retailer, run_date);

CREATE INDEX IF NOT EXISTS idx_product_pricing_slice
    ON silver.product_pricing (retailer, run_date);

CREATE INDEX IF NOT EXISTS idx_product_availability_slice
    ON silver.product_availability (retailer, run_date);

CREATE INDEX IF NOT EXISTS idx_product_extended_slice
    ON silver.product_extended (retailer, run_date);
