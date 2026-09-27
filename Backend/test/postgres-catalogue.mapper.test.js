const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mapProductRow,
} = require('../src/postgres-catalogue/mappers/postgres-catalogue-api.mapper');

test('maps finalised PostgreSQL values to the camelCase API contract', () => {
  const product = mapProductRow({
    id: '11111111-1111-4111-8111-111111111111',
    category_id: '22222222-2222-4222-8222-222222222222',
    product_name: 'Milk',
    category_name: 'Dairy',
    pack_quantity: '2.000',
    pack_uom: 'L',
    pack_display_unit: 'Bottle',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    prices: [
      {
        retailerId: '33333333-3333-4333-8333-333333333333',
        retailerName: 'coles',
        price: '4.50',
        unitPrice: '2.25',
        unitPriceLabel: '$2.25 per L',
    
        isOnSpecial: true,
        recordedAt: '2026-01-02T00:00:00Z',
      },
      {
        retailerId: '44444444-4444-4444-8444-444444444444',
        retailerName: 'woolworths',
        price: null,
      },
    ],
  });

  assert.equal(product.id, '11111111-1111-4111-8111-111111111111');
  assert.equal(product.pack.quantity, 2);
  assert.equal(product.currentPrice, 4.5);
  assert.equal(product.prices[0].available, true);
  assert.equal(product.prices[0].retailer.name, 'Coles');
  assert.equal(product.prices[0].unitPriceLabel, '$2.25 per L');
  assert.equal(product.prices[1].available, false);
  assert.equal(product.prices[1].retailer.name, 'Woolworths');
  assert.equal(product.prices[1].unitPriceLabel, null);
  assert.equal(product.isOnSpecial, true);
  assert.equal(product.updatedAt, '2026-01-02T00:00:00.000Z');
});

test('does not turn missing or invalid prices into zero', () => {
  const product = mapProductRow({
    id: '11111111-1111-4111-8111-111111111111',
    category_id: '22222222-2222-4222-8222-222222222222',
    product_name: 'No-price product',
    category_name: 'Other',
    prices: [{ retailerId: 'r', retailerName: 'Retailer', price: '0' }],
  });
  assert.equal(product.currentPrice, null);
  assert.equal(product.prices[0].price, null);
  assert.equal(product.prices[0].available, false);
});
