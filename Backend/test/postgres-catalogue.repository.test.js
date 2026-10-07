const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PostgresCatalogueRepository,
} = require('../src/postgres-catalogue/repositories/postgres-catalogue.repository');

test('catalogue queries join the finalised App presentation metadata', async () => {
  const calls = [];
  const dataSource = {
    async query(sql, parameters = []) {
      calls.push({ sql, parameters });
      return [];
    },
  };
  const repository = new PostgresCatalogueRepository(() => dataSource);

  await repository.listCategories();
  await repository.listProducts({ search: 'milk', page: 1, pageSize: 24 });

  assert.match(calls[0].sql, /LEFT JOIN app\.category_metadata metadata/);
  assert.match(calls[1].sql, /LEFT JOIN app\.product_metadata product_metadata/);
  assert.match(calls[1].sql, /LEFT JOIN app\.product_price_metadata price_metadata/);
  assert.match(calls[1].sql, /'unitPriceLabel', latest\.unit_price_label/);
  assert.match(calls[1].sql, /product\.pack_uom/);
  assert.match(calls[1].sql, /product_metadata\.pack_display_unit/);
  assert.doesNotMatch(
    calls[1].sql,
    /COALESCE\(product_metadata\.pack_display_unit,\s*product\.pack_uom\)/,
  );
  assert.deepEqual(calls[1].parameters, ['milk', null, null, false, null, 24, 0]);
});

test('catalogue queries adapt to the migration-stage App tables', async () => {
  const calls = [];
  const dataSource = {
    async query(sql, parameters = []) {
      calls.push({ sql, parameters });
      return [];
    },
  };
  const repository = new PostgresCatalogueRepository(
    () => dataSource,
    () => 'migration',
  );

  await repository.listCategories();
  await repository.listProducts({ page: 1, pageSize: 24 });

  assert.match(calls[0].sql, /LEFT JOIN app\.category_api_compatibility metadata/);
  assert.match(calls[1].sql, /LEFT JOIN app\.product_api_compatibility product_metadata/);
  assert.match(calls[1].sql, /product_metadata\.source_measurement AS pack_display_unit/);
  assert.match(calls[1].sql, /LEFT JOIN app\.product_price_source_records price_metadata/);
  assert.match(calls[1].sql, /price_metadata\.raw_unit_price AS unit_price_label/);
  assert.match(calls[1].sql, /'unitPriceLabel', latest\.unit_price_label/);
});
