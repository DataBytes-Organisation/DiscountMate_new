const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePackUom,
  transformProductDocument,
} = require('../src/migration/cli/lib/catalog-transform');
const {
  transformProductPricingDocument,
} = require('../src/migration/cli/lib/product-pricing-transform');
const {
  FIELD_BACKUPS,
  FINALISED_COLUMN_RENAMES,
  finaliseProductPriceMetadata,
  restoreMigrationProductPriceSources,
} = require('../src/migration/database/initialising_database/1786579200007-ApplyFinalisedPostgreSQL');
const {
  CreateCatalogPricingCompatibility1786579200005,
} = require('../src/migration/database/initialising_database/1786579200005-CreateCatalogPricingCompatibility');

test('keeps Silver pack units canonical while preserving the source measurement', () => {
  assert.equal(normalizePackUom('  pack  '), 'pack');
  assert.equal(normalizePackUom('Each'), 'ea');
  assert.equal(normalizePackUom('Bottle'), null);

  const transformed = transformProductDocument({
    _id: 'mongo-product-1',
    category_id: 'mongo-category-1',
    product_code: 'product-1',
    product_name: '0.0% Bottle 330ml',
    unit_per_prod: 6,
    measurement: 'Pack',
  }, new Date('2026-01-01T00:00:00Z'));

  assert.equal(transformed.valid, true);
  assert.equal(transformed.product.packQuantity, 6);
  assert.equal(transformed.product.packUom, 'pack');
  assert.equal(transformed.product.sourceAttributes.rawMeasurement, 'Pack');
  assert.equal(transformed.canonicalKey.packUom, 'pack');
});

test('keeps unsupported source measurements out of constrained Silver values', () => {
  const transformed = transformProductDocument({
    _id: 'mongo-product-2',
    category_id: 'mongo-category-1',
    product_code: 'product-2',
    product_name: 'Loose produce',
    unit_per_prod: 1,
    measurement: 'bunch',
  }, new Date('2026-01-01T00:00:00Z'));

  assert.equal(transformed.product.packUom, null);
  assert.equal(transformed.product.sourceAttributes.rawMeasurement, 'bunch');
  assert.equal(transformed.warnings[0].reason, 'catalog_product_unsupported_pack_uom');
  assert.deepEqual(transformed.warnings[0].detail, { rawMeasurement: 'bunch' });
});

test('keeps the exact source unit-price label beside the numeric Silver value', () => {
  const transformed = transformProductPricingDocument({
    _id: 'mongo-price-1',
    product_id: 'mongo-product-1',
    store_chain: 'Coles',
    date: '2026-01-02T00:00:00Z',
    price: 3.5,
    unit_price: '0.046 per ml',
  });

  assert.equal(transformed.valid, true);
  assert.equal(transformed.price.unitPrice, 0.046);
  assert.equal(transformed.price.rawUnitPrice, '0.046 per ml');
});

test('creates source measurement with the initial product metadata table', async () => {
  const queries = [];
  const migration = new CreateCatalogPricingCompatibility1786579200005();

  await migration.up({
    query: async (sql) => {
      queries.push(sql);
    },
  });

  const productMetadataQuery = queries.find((sql) => (
    /CREATE TABLE app\.product_api_compatibility/.test(sql)
  ));

  assert.ok(productMetadataQuery);
  assert.match(productMetadataQuery, /source_measurement text/);
});

test('finalised schema retains presentation metadata needed by the API', () => {
  const productBackup = FIELD_BACKUPS.find(
    (entry) => entry.table === 'app.product_api_compatibility',
  );
  assert.deepEqual(productBackup.columns, [
    ['legacy_gtin', 'text'],
    ['legacy_measurement', 'text'],
  ]);

  const renames = new Map(
    FINALISED_COLUMN_RENAMES.map((entry) => [
      `${entry.table}.${entry.migrationColumn}`,
      entry.finalisedColumn,
    ]),
  );
  assert.equal(renames.has('app.product_api_compatibility.legacy_measurement'), false);
  assert.equal(
    renames.get('app.product_api_compatibility.source_measurement'),
    'pack_display_unit',
  );
  assert.equal(renames.has('app.product_price_source_records.raw_unit_price'), false);
});

test('finalisation separates runtime price metadata from migration lineage', async () => {
  const queries = [];

  await finaliseProductPriceMetadata({
    query: async (sql) => {
      queries.push(sql);
    },
  });

  assert.equal(queries.length, 3);
  assert.match(queries[0], /CREATE TABLE app\.product_price_metadata/);
  assert.match(queries[0], /price_fact_id uuid NOT NULL/);
  assert.match(queries[0], /price_recorded_at timestamptz NOT NULL/);
  assert.match(queries[0], /unit_price_label text/);
  assert.match(queries[0], /best_price numeric\(10, 2\)/);
  assert.match(queries[0], /best_unit_price_label text/);
  assert.doesNotMatch(queries[0], /source_system/);
  assert.match(queries[1], /raw_unit_price/);
  assert.doesNotMatch(queries[1], /regexp_replace/);
  assert.match(queries[1], /best_price/);
  assert.match(queries[1], /raw_best_unit_price/);
  assert.match(
    queries[2],
    /ALTER TABLE app\.product_price_source_records SET SCHEMA migration/,
  );
});

test('reverting finalisation restores the migration price source table', async () => {
  const queries = [];

  await restoreMigrationProductPriceSources({
    query: async (sql) => {
      queries.push(sql);
    },
  });

  assert.deepEqual(queries, [
    'DROP TABLE app.product_price_metadata',
    'ALTER TABLE migration.product_price_source_records SET SCHEMA app',
  ]);
});
