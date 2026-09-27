const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PostgresCatalogueService,
} = require('../src/postgres-catalogue/services/postgres-catalogue.service');

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const CATEGORY_ID = '22222222-2222-4222-8222-222222222222';

function productRow(id = PRODUCT_ID) {
  return {
    id,
    category_id: CATEGORY_ID,
    product_name: 'Milk',
    category_name: 'Dairy',
    prices: [],
  };
}

test('normalises pagination, filtering and specials values', async () => {
  let received;
  const service = new PostgresCatalogueService({
    listProducts: async (options) => {
      received = options;
      return { rows: [productRow()], total: 1 };
    },
  });
  const response = await service.getProducts({
    page: '2',
    limit: '500',
    categoryId: CATEGORY_ID,
    specialsOnly: 'true',
    sort: 'price_asc',
  });

  assert.equal(received.page, 2);
  assert.equal(received.pageSize, 100);
  assert.equal(received.specialsOnly, true);
  assert.equal(response.pagination.totalPages, 1);
});

test('rejects invalid UUID filters before calling the repository', async () => {
  const service = new PostgresCatalogueService({
    listProducts: async () => assert.fail('repository should not be called'),
  });
  await assert.rejects(
    () => service.getProducts({ categoryId: 'not-a-uuid' }),
    (error) => error.code === 'INVALID_UUID' && error.status === 400,
  );
});

test('returns one DE product by UUID', async () => {
  const service = new PostgresCatalogueService({
    findProductById: async (id) =>
      id === PRODUCT_ID ? productRow(PRODUCT_ID) : null,
  });
  const product = await service.getProduct(PRODUCT_ID);
  assert.equal(product.id, PRODUCT_ID);
});
