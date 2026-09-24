const test = require('node:test');
const assert = require('node:assert/strict');

const runIntegration = process.env.RUN_POSTGRES_CATALOGUE_INTEGRATION === 'true';
const integrationTest = runIntegration ? test : test.skip;

integrationTest('reads the detected PostgreSQL catalogue schema through TypeORM', async () => {
  require('dotenv').config();
  process.env.POSTGRES_CATALOG_ENABLED = 'true';
  const {
    closePostgresCatalogue,
    getPostgresCatalogueDataSource,
    getPostgresCatalogueReadModel,
    initializePostgresCatalogue,
  } = require('../src/postgres-catalogue/database/catalogue-data-source');
  const {
    PostgresCatalogueRepository,
  } = require('../src/postgres-catalogue/repositories/postgres-catalogue.repository');
  const {
    PostgresCatalogueService,
  } = require('../src/postgres-catalogue/services/postgres-catalogue.service');

  const status = await initializePostgresCatalogue();
  assert.equal(status.available, true);
  assert.match(getPostgresCatalogueReadModel(), /^(migration|finalised)$/);
  const dataSource = getPostgresCatalogueDataSource();
  const [readOnlyState] = await dataSource.query('SHOW default_transaction_read_only');
  assert.equal(
    readOnlyState.default_transaction_read_only,
    'on',
  );
  const service = new PostgresCatalogueService(
    new PostgresCatalogueRepository(
      getPostgresCatalogueDataSource,
      getPostgresCatalogueReadModel,
    ),
  );
  const result = await service.getProducts({ limit: 2 });
  assert.ok(result.items.length > 0);
  assert.match(result.items[0].id, /^[0-9a-f-]{36}$/i);
  await closePostgresCatalogue();
});
