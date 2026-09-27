const test = require('node:test');
const assert = require('node:assert/strict');

const {
    MockRetailerCartAdapter,
    ProductLinkRetailerAdapter,
} = require('../src/comparison/services/retailer-cart.adapters');

test('product-link adapter keeps retailer items but strips unsafe handoff URLs', () => {
    const adapter = new ProductLinkRetailerAdapter((value) => value.startsWith('https://safe.test') ? value : null);
    const groups = adapter.createGroups([
        { retailerName: 'Coles', productName: 'Milk', productUrl: 'https://safe.test/milk' },
        { retailerName: 'Coles', productName: 'Bread', productUrl: 'javascript:alert(1)' },
    ]);

    assert.equal(groups[0].items.length, 2);
    assert.equal(groups[0].items[0].productUrl, 'https://safe.test/milk');
    assert.equal(groups[0].retailerCapability, 'product_page');
    assert.equal(groups[0].items[0].linkStatus, 'exact');
    assert.equal(groups[0].items[1].productUrl, null);
    assert.equal(groups[0].items[1].linkStatus, 'missing');
});

test('product-link adapter reports catalogue-only and store-required retailer capabilities', () => {
    const adapter = new ProductLinkRetailerAdapter((value) => value || null);
    const groups = adapter.createGroups([
        { retailerName: 'ALDI', productName: 'Maple Syrup', productUrl: 'https://www.aldi.com.au/products/maple-syrup' },
        { retailerName: 'IGA', productName: 'Milk', productUrl: 'https://iga.com.au/product/milk' },
        { retailerName: 'Woolworths', productName: 'Bread', productUrl: 'https://woolworths.com.au/product/bread' },
    ]);

    const aldi = groups.find((group) => group.retailerName === 'ALDI');
    const iga = groups.find((group) => group.retailerName === 'IGA');
    const woolworths = groups.find((group) => group.retailerName === 'Woolworths');

    assert.equal(aldi.retailerCapability, 'catalogue_only');
    assert.equal(aldi.items[0].linkStatus, 'unsupported');
    assert.equal(iga.retailerCapability, 'store_required');
    assert.equal(iga.items[0].linkStatus, 'exact');
    assert.equal(woolworths.retailerCapability, 'product_page');
});

test('mock adapter returns only a labelled DiscountMate sandbox handoff', () => {
    const cart = new MockRetailerCartAdapter().createCart({ id: 'session-1', groups: [] });
    assert.deepEqual(cart, {
        provider: 'discountmate_sandbox',
        sessionId: 'session-1',
        checkoutPath: '/shopping-session/session-1/sandbox',
        acceptsPayment: false,
    });
});
