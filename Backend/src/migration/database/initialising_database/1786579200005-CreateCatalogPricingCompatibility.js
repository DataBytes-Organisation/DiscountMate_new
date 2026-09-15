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
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS app.product_price_source_records');
    await queryRunner.query('DROP TABLE IF EXISTS app.product_api_compatibility');
    await queryRunner.query('DROP TABLE IF EXISTS app.category_api_compatibility');
    await queryRunner.query('DROP TABLE IF EXISTS app.catalog_source_keys');
  }
}

module.exports = { CreateCatalogPricingCompatibility1786579200005 };
