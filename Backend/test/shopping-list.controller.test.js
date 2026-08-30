const test = require('node:test');
const assert = require('node:assert/strict');

const { cleanItems } = require('../src/controllers/shopping-list.controller');

test('shopping-list persistence keeps stable comparison identity and pack metadata', () => {
    const [item] = cleanItems([{
        id: 'line-1',
        name: 'Milk',
        price: 3.49,
        quantity: 1,
        comparisonProductId: '11111111-1111-4111-8111-111111111111',
        sourceProductId: '22222222-2222-4222-8222-222222222222',
        deProductId: '11111111-1111-4111-8111-111111111111',
        gtin: '9300000000001',
        brand: 'Devondale',
        packQuantity: '2',
        packUom: 'L',
        image: 'https://example.test/milk.jpg',
    }]);

    assert.deepEqual(item, {
        id: 'line-1', name: 'Milk', price: 3.49, quantity: 1,
        comparisonProductId: '11111111-1111-4111-8111-111111111111',
        sourceProductId: '22222222-2222-4222-8222-222222222222',
        deProductId: '11111111-1111-4111-8111-111111111111',
        gtin: '9300000000001', brand: 'Devondale', packQuantity: '2', packUom: 'L',
        image: 'https://example.test/milk.jpg',
    });
});
