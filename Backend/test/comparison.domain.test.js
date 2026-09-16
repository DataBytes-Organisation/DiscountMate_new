const test = require('node:test');
const assert = require('node:assert/strict');

const {
    addMoney,
    compareExactOffers,
    confidenceLabel,
    evaluateAdvice,
    normalizePack,
    optimizeBasket,
} = require('../src/comparison/domain/comparison');

const NOW = new Date('2026-08-21T00:00:00.000Z');

test('money arithmetic is exact and half-up at cents', () => {
    assert.equal(addMoney(['0.10', '0.20']), '0.30');
    assert.equal(addMoney(['1.005']), '1.01');
});

test('1000 g and 1 kg normalize compatibly while kg and L do not', () => {
    const grams = normalizePack('1000', 'g');
    const kilograms = normalizePack('1', 'kg');
    const litres = normalizePack('1', 'L');

    assert.deepEqual(grams, { dimension: 'mass', baseQuantity: '1.000', baseUnit: 'kg' });
    assert.deepEqual(kilograms, grams);
    assert.notEqual(kilograms.dimension, litres.dimension);
});

test('the latest available observation remains eligible regardless of age', () => {
    const result = compareExactOffers([
        offer('aldi', '3.49', 'product-1', 'aldi-id', '2026-05-04T00:00:00.000Z'),
        offer('coles', '3.90', 'product-1', 'coles-id', '2026-04-20T00:00:00.000Z'),
    ], NOW);

    assert.equal(result.offers.length, 2);
    assert.equal(result.cheapest.retailerName, 'aldi');
    assert.equal(result.offers[0].availabilitySource, 'latest_price_inference');
    assert.equal(result.offers[0].freshness, 'latest');
    assert.equal(result.excludedOffers.some((item) => item.reason === 'stale_price'), false);
});

test('latest-price policy still excludes invalid prices, timestamps, and incompatible packs', () => {
    const valid = offer('aldi', '3.49', 'product-1', 'aldi-id', '2026-05-04T00:00:00.000Z');
    const incompatible = {
        ...offer('coles', '3.10', 'product-1', 'coles-id', '2026-04-20T00:00:00.000Z'),
        packUom: 'L',
    };
    const result = compareExactOffers([
        valid,
        incompatible,
        offer('woolworths', '0', 'product-1', 'woolworths-id', '2026-05-04T00:00:00.000Z'),
        offer('iga', '3.20', 'product-1', 'iga-id', 'not-a-date'),
    ], NOW);

    assert.deepEqual(result.offers.map((item) => item.retailerName), ['aldi']);
    assert.deepEqual(
        result.excludedOffers.map((item) => item.reason).sort(),
        ['incompatible_pack', 'invalid_observation', 'invalid_price']
    );
});

test('$3.49 versus $3.90 yields a $0.41 difference', () => {
    const result = compareExactOffers([
        offer('aldi', '3.49'),
        offer('coles', '3.90'),
    ], NOW);

    assert.equal(result.cheapest.retailerName, 'aldi');
    assert.equal(result.offers[1].difference.amount, '0.41');
});

test('confidence maps 74% to Medium and 75% to High', () => {
    assert.equal(confidenceLabel(0.54), 'Low');
    assert.equal(confidenceLabel(0.74), 'Medium');
    assert.equal(confidenceLabel(0.75), 'High');
});

test('advice chooses verified buy-now, qualified wait, then current-offer comparison', () => {
    assert.deepEqual(
        evaluateAdvice({ specialText: 'Half Price', isNinetyDayLow: false }),
        {
            type: 'buy_now',
            title: 'Buy now',
            reason: 'The current offer meets the verified deal policy.',
            basis: 'verified_deal',
        }
    );
    assert.equal(evaluateAdvice({ isNinetyDayLow: true }).type, 'buy_now');
    assert.deepEqual(
        evaluateAdvice({ predictedChangePercent: -5, confidence: 0.55, forecastKind: 'model' }),
        {
            type: 'wait',
            title: 'Wait',
            reason: 'A price decrease of at least 5% is forecast with sufficient confidence.',
            basis: 'forecast_drop',
        }
    );
    assert.equal(evaluateAdvice({ predictedChangePercent: -5, confidence: 0.9, forecastKind: 'baseline' }).type, 'compare_offers');
});

test('current-offer advice summarizes price ranges, ties, single offers, and no offers', () => {
    const fourRetailers = evaluateAdvice({
        offers: [
            { retailerName: 'Aldi', price: '2.49' },
            { retailerName: 'IGA', price: '3.00' },
            { retailerName: 'Woolworths', price: '3.00' },
            { retailerName: 'Coles', price: '3.00' },
        ],
    });
    assert.deepEqual(fourRetailers, {
        type: 'compare_offers',
        title: 'Compare current offers',
        reason: 'Current prices range from $2.49 at ALDI to $3.00 across 4 retailers.',
        basis: 'current_price_comparison',
    });

    const tied = evaluateAdvice({
        offers: [
            { retailerName: 'IGA', price: '3.00' },
            { retailerName: 'Woolworths', price: '3.00' },
            { retailerName: 'Coles', price: '3.00' },
        ],
    });
    assert.equal(tied.reason, 'The lowest current price is $3.00 at IGA, Woolworths and Coles.');

    const single = evaluateAdvice({ offers: [{ retailerName: 'Aldi', price: '2.49' }] });
    assert.equal(single.reason, 'One verified current offer is available at ALDI for $2.49.');
    assert.equal(single.basis, 'single_offer');

    const empty = evaluateAdvice({ offers: [] });
    assert.equal(empty.reason, 'No compatible current offers are available.');
    assert.equal(empty.basis, 'no_offer');
});

test('optimizer prioritizes coverage before raw total', () => {
    const result = optimizeBasket({
        items: [
            { productId: 'p1', quantity: 1 },
            { productId: 'p2', quantity: 1 },
            { productId: 'p3', quantity: 1 },
        ],
        offers: [
            offer('partial', '2.00', 'p1'),
            offer('partial', '3.00', 'p2'),
            offer('complete', '4.00', 'p1'),
            offer('complete', '4.00', 'p2'),
            offer('complete', '4.00', 'p3'),
        ],
        objective: 'one_retailer',
        maxRetailers: 1,
        now: NOW,
    });

    assert.equal(result.plans[0].retailers[0].retailerName, 'complete');
    assert.equal(result.plans[0].coverage.found, 3);
    assert.equal(result.plans[0].total.amount, '12.00');

    const partial = result.retailerResults.find((row) => row.retailerName === 'partial');
    assert.equal(partial.total.amount, '5.00');
    assert.equal(partial.coverage.found, 2);
    assert.equal(partial.rankEligible, false);
});

test('basket optimizer includes the latest available historical observation', () => {
    const oldOffer = offer(
        'aldi',
        '3.49',
        'p1',
        'aldi-id',
        '2026-05-04T00:00:00.000Z'
    );
    const result = optimizeBasket({
        items: [{ productId: 'p1', quantity: 1 }],
        offers: [oldOffer],
        objective: 'lowest_total',
        maxRetailers: 1,
        now: NOW,
    });

    assert.equal(result.plans.length, 1);
    assert.equal(result.plans[0].total.amount, '3.49');
});

test('retailer savings only use that retailer covered item set', () => {
    const result = optimizeBasket({
        items: [
            { productId: 'p1', quantity: 2 },
            { productId: 'p2', quantity: 1 },
            { productId: 'p3', quantity: 1 },
        ],
        offers: [
            offer('aldi', '2.00', 'p1'),
            offer('coles', '3.00', 'p1'),
            offer('aldi', '1.00', 'p2'),
            offer('coles', '2.00', 'p2'),
            offer('coles', '7.00', 'p3'),
        ],
        objective: 'one_retailer',
        maxRetailers: 1,
        now: NOW,
    });

    const aldi = result.retailerResults.find((row) => row.retailerName === 'aldi');
    assert.equal(aldi.savings.amount, '3.00');
    assert.equal(aldi.coverage.found, 2);
});

test('retailer UUID provides deterministic exact tie-breaking', () => {
    const result = optimizeBasket({
        items: [{ productId: 'p1', quantity: 1 }],
        offers: [
            offer('z-shop', '5.00', 'p1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
            offer('a-shop', '5.00', 'p1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
        ],
        objective: 'lowest_total',
        maxRetailers: 1,
        now: NOW,
    });

    assert.equal(result.plans[0].retailers[0].retailerId, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
});

test('optimizer preserves distinct saved-list lines that resolve to the same product', () => {
    const result = optimizeBasket({
        items: [
            { lineItemId: 'donation-redkite', productId: 'p1', quantity: 2 },
            { lineItemId: 'donation-secondbite', productId: 'p1', quantity: 2 },
        ],
        offers: [offer('coles', '2.00', 'p1')],
        objective: 'one_retailer',
        maxRetailers: 1,
        now: NOW,
    });

    assert.equal(result.plans[0].coverage.found, 2);
    assert.equal(result.plans[0].coverage.total, 2);
    assert.equal(result.plans[0].total.amount, '8.00');
    assert.deepEqual(
        result.plans[0].items.map((item) => item.lineItemId),
        ['donation-redkite', 'donation-secondbite']
    );
});

test('savings are unavailable when no item has a comparable retailer baseline', () => {
    const result = optimizeBasket({
        items: [{ lineItemId: 'milk', productId: 'p1', quantity: 1 }],
        offers: [offer('coles', '3.49', 'p1')],
        objective: 'one_retailer',
        maxRetailers: 1,
        now: NOW,
    });

    assert.equal(result.retailerResults[0].savings, null);
    assert.equal(result.retailerResults[0].savingsStatus, 'unavailable');
    assert.equal(result.retailerResults[0].comparableItemCount, 0);
    assert.equal(result.plans[0].savings, null);
});

function offer(
    retailerName,
    price,
    productId = 'product-1',
    retailerId = `${retailerName}-id`,
    observedAt = '2026-08-20T00:00:00.000Z'
) {
    return {
        productId,
        retailerId,
        retailerName,
        price,
        currency: 'AUD',
        packQuantity: '1',
        packUom: 'kg',
        observedAt,
    };
}
