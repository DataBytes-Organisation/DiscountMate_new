const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getPostgresCatalogueConfig,
} = require('../src/postgres-catalogue/config/postgres-catalogue.config');
const {
  CORE_TABLES,
  READ_MODEL_TABLES,
  detectCatalogueReadModel,
} = require('../src/postgres-catalogue/database/catalogue-data-source');

test('PostgreSQL catalogue defaults to disabled and unconfigured', () => {
  const config = getPostgresCatalogueConfig({});
  assert.equal(config.requested, false);
  assert.equal(config.configured, false);
  assert.equal(config.poolSize, 8);
  assert.equal(config.queryTimeoutMs, 5000);
});

test('catalogue readiness supports migration and finalised read models', () => {
  assert.deepEqual(CORE_TABLES, [
    'silver.dim_products',
    'silver.dim_categories',
    'silver.dim_retailers',
    'silver.fct_product_prices',
  ]);
  assert.deepEqual(READ_MODEL_TABLES.finalised, [
    'app.category_metadata',
    'app.product_metadata',
    'app.product_price_metadata',
  ]);
  assert.deepEqual(READ_MODEL_TABLES.migration, [
    'app.category_api_compatibility',
    'app.product_api_compatibility',
    'app.product_price_source_records',
  ]);
});

function tableRows(tableNames) {
  return tableNames.map((tableName) => ({
    table_name: tableName,
    present: true,
  }));
}

test('catalogue detection prefers the finalised read model', () => {
  const detected = detectCatalogueReadModel(tableRows([
    ...CORE_TABLES,
    ...READ_MODEL_TABLES.finalised,
    ...READ_MODEL_TABLES.migration,
  ]));
  assert.equal(detected.name, 'finalised');
});

test('catalogue detection falls back to the migration read model', () => {
  const detected = detectCatalogueReadModel(tableRows([
    ...CORE_TABLES,
    ...READ_MODEL_TABLES.migration,
  ]));
  assert.equal(detected.name, 'migration');
});

test('catalogue detection rejects incomplete read models', () => {
  const detected = detectCatalogueReadModel(tableRows(CORE_TABLES));
  assert.equal(detected.name, null);
  assert.ok(detected.missingMetadataTables.length > 0);
});

test('PostgreSQL catalogue configuration is bounded and requires explicit true', () => {
  const config = getPostgresCatalogueConfig({
    POSTGRES_CATALOG_ENABLED: 'true',
    DE_DATABASE_URL: 'postgresql://example',
    POSTGRES_CATALOG_POOL_SIZE: '999',
    POSTGRES_CATALOG_QUERY_TIMEOUT_MS: '1',
  });
  assert.equal(config.requested, true);
  assert.equal(config.configured, true);
  assert.equal(config.poolSize, 30);
  assert.equal(config.queryTimeoutMs, 1);
});
