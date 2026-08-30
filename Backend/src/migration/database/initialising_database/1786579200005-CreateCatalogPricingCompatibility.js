class CreateCatalogPricingCompatibility1786579200005 {
  name = 'CreateCatalogPricingCompatibility1786579200005';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE app.catalog_source_keys (
        entity_type text NOT NULL CHECK (entity_type IN ('category', 'product')),
        source_system text NOT NULL,
        source_collection text NOT NULL,
        identifier_type text NOT NULL,
        identifier_value text NOT NULL,
        entity_id uuid NOT NULL,
        source_checksum text,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT pk_catalog_source_keys PRIMARY KEY (
          entity_type,
          source_system,
          source_collection,
          identifier_type,
          identifier_value
        )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_catalog_source_keys_entity
      ON app.catalog_source_keys (entity_type, entity_id)
    `);

    await queryRunner.query(`
      CREATE TABLE app.category_api_compatibility (
        category_id uuid PRIMARY KEY,
        description text,
        icon_url text,
        display_order integer,
        is_active boolean NOT NULL DEFAULT true,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE TABLE app.product_api_compatibility (
        product_id uuid PRIMARY KEY,
        description text,
        image_link_primary text,
        legacy_gtin text,
        legacy_measurement text,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE TABLE app.product_price_source_records (
        source_system text NOT NULL,
        source_collection text NOT NULL,
        source_record_id text NOT NULL,
        price_fact_id uuid NOT NULL,
        price_recorded_at timestamptz NOT NULL,
        best_price numeric(10, 2),
        raw_unit_price text,
        raw_best_unit_price text,
        raw_store_chain text,
        source_name text,
        source_checksum text,
        source_created_at timestamptz,
        source_updated_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT pk_product_price_source_records PRIMARY KEY (
          source_system,
          source_collection,
          source_record_id
        ),
        CONSTRAINT uq_product_price_source_fact UNIQUE (
          price_fact_id,
          price_recorded_at
        )
      )
    `);

    await queryRunner.query(`
      DO $transition$
      BEGIN
        IF to_regclass('silver.category_source_keys') IS NOT NULL THEN
          EXECUTE $sql$
            INSERT INTO app.catalog_source_keys (
              entity_type,
              source_system,
              source_collection,
              identifier_type,
              identifier_value,
              entity_id,
              source_checksum,
              created_at,
              updated_at
            )
            SELECT
              'category',
              source_system,
              source_collection,
              identifier_type,
              identifier_value,
              category_id,
              source_checksum,
              created_at,
              updated_at
            FROM silver.category_source_keys
            ON CONFLICT DO NOTHING
          $sql$;
        END IF;

        IF to_regclass('silver.product_source_keys') IS NOT NULL THEN
          EXECUTE $sql$
            INSERT INTO app.catalog_source_keys (
              entity_type,
              source_system,
              source_collection,
              identifier_type,
              identifier_value,
              entity_id,
              source_checksum,
              created_at,
              updated_at
            )
            SELECT
              'product',
              source_system,
              source_collection,
              identifier_type,
              identifier_value,
              product_id,
              source_checksum,
              created_at,
              updated_at
            FROM silver.product_source_keys
            ON CONFLICT DO NOTHING
          $sql$;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'silver'
            AND table_name = 'dim_categories'
            AND column_name = 'category_code'
        ) THEN
          EXECUTE $sql$
            INSERT INTO app.category_api_compatibility (
              category_id,
              description,
              icon_url,
              display_order,
              is_active,
              updated_at
            )
            SELECT
              id,
              description,
              icon_url,
              display_order,
              is_active,
              updated_at
            FROM silver.dim_categories
            ON CONFLICT (category_id) DO NOTHING
          $sql$;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'silver'
            AND table_name = 'dim_products'
            AND column_name = 'source_attributes'
        ) THEN
          EXECUTE $sql$
            INSERT INTO app.product_api_compatibility (
              product_id,
              description,
              image_link_primary,
              legacy_gtin,
              legacy_measurement,
              updated_at
            )
            SELECT
              id,
              description,
              image_link_primary,
              source_attributes ->> 'rawGtin',
              source_attributes ->> 'rawMeasurement',
              updated_at
            FROM silver.dim_products
            ON CONFLICT (product_id) DO NOTHING
          $sql$;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'silver'
            AND table_name = 'fct_product_prices'
            AND column_name = 'source_record_id'
        ) THEN
          EXECUTE $sql$
            INSERT INTO app.product_price_source_records (
              source_system,
              source_collection,
              source_record_id,
              price_fact_id,
              price_recorded_at,
              best_price,
              raw_unit_price,
              raw_best_unit_price,
              raw_store_chain,
              source_name,
              source_checksum,
              source_created_at,
              source_updated_at,
              created_at,
              updated_at
            )
            SELECT
              source_system,
              source_collection,
              source_record_id,
              id,
              recorded_at,
              best_price,
              raw_unit_price,
              raw_best_unit_price,
              raw_store_chain,
              source_attributes ->> 'source',
              source_checksum,
              source_created_at,
              source_updated_at,
              created_at,
              updated_at
            FROM silver.fct_product_prices
            WHERE source_record_id IS NOT NULL
            ON CONFLICT DO NOTHING
          $sql$;
        END IF;
      END
      $transition$
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS app.product_price_source_records');
    await queryRunner.query('DROP TABLE IF EXISTS app.product_api_compatibility');
    await queryRunner.query('DROP TABLE IF EXISTS app.category_api_compatibility');
    await queryRunner.query('DROP TABLE IF EXISTS app.catalog_source_keys');
  }
}

module.exports = { CreateCatalogPricingCompatibility1786579200005 };
