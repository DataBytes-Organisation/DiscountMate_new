const test = require('node:test');
const assert = require('node:assert/strict');

const { createComparisonService } = require('../src/comparison/services/comparison.service');
const { toCsvCell } = require('../src/comparison/domain/csv');
const { validateTrackingEvents } = require('../src/comparison/domain/events');

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const ALDI_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COLES_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NOW = new Date('2026-08-21T00:00:00.000Z');

test('product comparison isolates one retailer forecast failure', async () => {
    const service = createComparisonService({
        deRepository: productRepository(),
        appRepository: appRepository(),
        listRepository: listRepository(),
        forecastClient: {
            async forecast({ retailerId }) {
                if (retailerId === COLES_ID) throw new Error('timeout');
                return { predictedPrice: '3.20', confidence: 0.75, modelVersion: 'moving-average-v1' };
            },
        },
        clock: () => NOW,
    });

    const result = await service.getProductComparison(PRODUCT_ID, {
        range: '3m',
        includeSimilar: true,
    });

    assert.equal(result.cheapest.retailerName, 'Aldi');
    assert.equal(result.comparisonProductId, PRODUCT_ID);
    assert.equal(result.offers[1].difference.amount, '0.41');
    assert.equal(result.forecasts.length, 2);
    assert.equal(result.forecasts.find((item) => item.retailerId === ALDI_ID).confidenceLabel, 'High');
    assert.deepEqual(
        result.forecasts.find((item) => item.retailerId === COLES_ID),
        {
            retailerId: COLES_ID,
            retailerName: 'Coles',
            horizonDays: 14,
            predictedPrice: { amount: '3.90', currency: 'AUD' },
            predictedChangePercent: 0,
            forecastKind: 'baseline',
            baselineReason: 'model_unavailable',
            forecastAt: '2026-09-03T00:00:00.000Z',
            basedOnObservedAt: '2026-08-20T00:00:00.000Z',
            confidence: null,
            confidenceLabel: null,
            modelVersion: null,
        }
    );
    assert.ok(result.warnings.some((warning) => warning.code === 'forecast_partial'));
    assert.equal(result.dataWatermark, '2026-08-20T08:00:00.000Z');
    assert.equal(result.history.length, 6);
    assert.deepEqual(result.unavailableRetailers, [{
        retailerId: 'wwwwwwww-wwww-4www-8www-wwwwwwwwwwww',
        retailerName: 'Woolworths',
        reason: 'no_exact_product_match',
    }, {
        retailerId: '11111111-aaaa-4aaa-8aaa-111111111111',
        retailerName: 'IGA',
        dataAvailable: false,
        reason: 'retailer_data_unavailable',
    }]);
});

test('product comparison uses a neutral 14-day baseline when fewer than three observation days exist', async () => {
    const repository = productRepository();
    repository.getPriceHistory = async () => [{
        retailerId: ALDI_ID,
        retailerName: 'Aldi',
        price: '3.49',
        observedAt: '2026-05-04T08:00:00.000Z',
    }];
    let forecastCalls = 0;
    const service = createComparisonService({
        deRepository: repository,
        appRepository: appRepository(),
        listRepository: listRepository(),
        forecastClient: {
            async forecast() {
                forecastCalls += 1;
                throw new Error('The model must not be called for a one-day series');
            },
        },
        clock: () => NOW,
    });

    const result = await service.getProductComparison(PRODUCT_ID, { range: '3m' });

    assert.equal(forecastCalls, 0);
    assert.equal(result.forecasts.length, 2);
    const baseline = result.forecasts.find((item) => item.retailerId === ALDI_ID);
    assert.deepEqual(baseline, {
        retailerId: ALDI_ID,
        retailerName: 'Aldi',
        horizonDays: 14,
        predictedPrice: { amount: '3.49', currency: 'AUD' },
        predictedChangePercent: 0,
        forecastKind: 'baseline',
        baselineReason: 'insufficient_history',
        forecastAt: '2026-05-18T08:00:00.000Z',
        basedOnObservedAt: '2026-05-04T08:00:00.000Z',
        confidence: null,
        confidenceLabel: null,
        modelVersion: null,
    });
    assert.equal(result.advice.type, 'compare_offers');
    assert.equal(result.advice.title, 'Compare current offers');
    assert.equal(result.advice.basis, 'current_price_comparison');
});

test('product comparison keeps only the latest retailer observation per calendar day', async () => {
    const repository = productRepository();
    repository.getPriceHistory = async () => [
        { retailerId: ALDI_ID, retailerName: 'Aldi', price: '3.80', observedAt: '2026-05-04T01:00:00.000Z' },
        { retailerId: ALDI_ID, retailerName: 'Aldi', price: '3.49', observedAt: '2026-05-04T08:00:00.000Z' },
        { retailerId: COLES_ID, retailerName: 'Coles', price: '3.90', observedAt: '2026-05-04T07:00:00.000Z' },
    ];
    const service = createComparisonService({
        deRepository: repository,
        appRepository: appRepository(),
        listRepository: listRepository(),
        forecastClient: { forecast: async () => null },
        clock: () => NOW,
    });

    const result = await service.getProductComparison(PRODUCT_ID, { range: '3m' });

    assert.equal(result.history.length, 2);
    assert.equal(result.history.find((point) => point.retailerId === ALDI_ID).price.amount, '3.49');
    assert.equal(result.historyObservationDays, 1);
});

test('a higher-priced half-price offer does not override the cheapest exact offer', async () => {
    const repository = productRepository();
    const latestOffers = [
        offer(ALDI_ID, 'Aldi', '2.49'),
        { ...offer(COLES_ID, 'Coles', '3.00'), isOnSpecial: true, specialText: 'Half Price' },
    ];
    repository.getLatestOffers = async () => latestOffers;
    repository.getPriceHistory = async () => [
        { retailerId: ALDI_ID, retailerName: 'Aldi', price: '2.20', observedAt: '2026-06-01T00:00:00.000Z' },
        { retailerId: ALDI_ID, retailerName: 'Aldi', price: '2.30', observedAt: '2026-07-01T00:00:00.000Z' },
        { retailerId: ALDI_ID, retailerName: 'Aldi', price: '2.49', observedAt: '2026-08-20T00:00:00.000Z' },
        { retailerId: COLES_ID, retailerName: 'Coles', price: '4.00', observedAt: '2026-06-01T00:00:00.000Z' },
        { retailerId: COLES_ID, retailerName: 'Coles', price: '4.00', observedAt: '2026-07-01T00:00:00.000Z' },
        { retailerId: COLES_ID, retailerName: 'Coles', price: '3.00', observedAt: '2026-08-20T00:00:00.000Z' },
    ];
    const service = createComparisonService({
        deRepository: repository,
        appRepository: appRepository(),
        listRepository: listRepository(),
        forecastClient: {
            async forecast({ currentPrice }) {
                return { predictedPrice: currentPrice, confidence: 0.75, modelVersion: 'moving-average-v1' };
            },
        },
        clock: () => NOW,
    });

    const result = await service.getProductComparison(PRODUCT_ID, { range: '3m' });

    assert.equal(result.cheapest.retailerName, 'Aldi');
    assert.equal(result.advice.type, 'compare_offers');
    assert.equal(result.advice.basis, 'current_price_comparison');
});

test('list run persists a completed immutable snapshot', async () => {
    const stored = [];
    const service = createComparisonService({
        deRepository: productRepository(),
        appRepository: appRepository(stored),
        listRepository: listRepository(),
        forecastClient: { forecast: async () => null },
        clock: () => NOW,
        uuid: () => 'run-1',
    });

    const result = await service.createListRun('list-1', 'user-1', {
        objective: 'lowest_total',
        maxRetailers: 2,
        allowStoreBrandSubstitutions: false,
    });

    assert.equal(result.id, 'run-1');
    assert.equal(result.status, 'completed');
    assert.equal(result.calculationPolicyVersion, 'comparison-v2.3');
    assert.equal(result.plans[0].coverage.found, 1);
    assert.equal(stored.length, 1);
    assert.notEqual(stored[0], result);
    assert.deepEqual(stored[0], result);
});

test('list runs persist only deterministic legacy-to-Silver mappings', async () => {
    const mappings = [];
    const repository = productRepository();
    repository.resolveListItems = async () => [
        {
            lineItemId: 'cola-line', legacyProductId: 'legacy-cola', productId: PRODUCT_ID,
            name: 'Cola 24 pack', quantity: 1, mappingMethod: 'gtin', resolutionStatus: 'resolved',
        },
        {
            lineItemId: 'banana-line', legacyProductId: 'legacy-banana', name: 'Bananas',
            quantity: 1, resolutionStatus: 'ambiguous', resolutionReason: 'ambiguous_identity',
        },
    ];
    const appRepo = appRepository();
    appRepo.persistProductMappings = async (items) => mappings.push(...items);
    const service = createComparisonService({
        deRepository: repository,
        appRepository: appRepo,
        listRepository: {
            async getList() {
                return {
                    name: 'Weekly',
                    items: [
                        { lineItemId: 'cola-line', legacyProductId: 'legacy-cola', name: 'Cola', quantity: 1 },
                        { lineItemId: 'banana-line', legacyProductId: 'legacy-banana', name: 'Bananas', quantity: 1 },
                    ],
                };
            },
        },
        forecastClient: { forecast: async () => null },
        clock: () => NOW,
        uuid: () => 'run-mapping',
    });

    const result = await service.createListRun('list-1', 'user-1', {
        objective: 'lowest_total', maxRetailers: 1, allowStoreBrandSubstitutions: false,
    });

    assert.deepEqual(mappings, [{
        sourceRef: 'legacy-cola',
        targetProductId: PRODUCT_ID,
        mappingMethod: 'gtin',
    }]);
    assert.equal(result.itemResolutions[1].resolutionStatus, 'ambiguous');
});

test('list runs return a specific partial-state error when no saved lines can be mapped', async () => {
    const repository = productRepository();
    repository.resolveListItems = async (items) => items.map((item) => ({
        ...item,
        resolutionStatus: 'unresolved',
        resolutionReason: 'no_deterministic_match',
    }));
    const service = createComparisonService({
        deRepository: repository,
        appRepository: appRepository(),
        listRepository: listRepository(),
        forecastClient: { forecast: async () => null },
    });

    await assert.rejects(
        () => service.createListRun('list-1', 'user-1', {
            objective: 'lowest_total', maxRetailers: 1, allowStoreBrandSubstitutions: false,
        }),
        (error) => error.status === 422 && error.code === 'no_mapped_items'
    );
});

test('CSV cells escape spreadsheet formulas and quotes', () => {
    assert.equal(toCsvCell('=HYPERLINK("bad")'), `"'=HYPERLINK(""bad"")"`);
    assert.equal(toCsvCell('Milk, 2 L'), '"Milk, 2 L"');
});

test('tracking validation accepts only the agreed catalogue and bounded payloads', () => {
    const valid = validateTrackingEvents([{
        name: 'comparison_viewed',
        occurredAt: NOW.toISOString(),
        properties: { mode: 'single_product' },
    }]);
    assert.equal(valid[0].name, 'comparison_viewed');
    assert.equal(validateTrackingEvents([{
        name: 'retailer_product_opened',
        occurredAt: NOW.toISOString(),
        properties: { sessionId: 'session-1' },
    }])[0].name, 'retailer_product_opened');
    assert.equal(validateTrackingEvents([{ name: 'retailer_link_failed' }])[0].name, 'retailer_link_failed');
    assert.equal(validateTrackingEvents([{ name: 'shopping_item_completed' }])[0].name, 'shopping_item_completed');
    assert.equal(validateTrackingEvents([{ name: 'shopping_session_completed' }])[0].name, 'shopping_session_completed');

    assert.throws(() => validateTrackingEvents([{ name: 'arbitrary_event' }]), /not allowed/);
    assert.throws(
        () => validateTrackingEvents(Array.from({ length: 51 }, () => ({ name: 'comparison_viewed' }))),
        /50 events/
    );
});

test('start shopping only returns allowlisted retailer URLs', async () => {
    const run = {
        id: 'run-1',
        plans: [{
            id: 'plan-1',
            items: [
                { retailerName: 'Coles', productUrl: 'https://www.coles.com.au/product/1' },
                { retailerName: 'Bad', productUrl: 'javascript:alert(1)' },
                { retailerName: 'Bad host', productUrl: 'https://evil.example/product/2' },
            ],
        }],
    };
    const repo = appRepository();
    repo.getRun = async () => run;
    const service = createComparisonService({
        deRepository: productRepository(),
        appRepository: repo,
        listRepository: listRepository(),
        forecastClient: { forecast: async () => null },
        clock: () => NOW,
    });

    const result = await service.startShopping('run-1', 'plan-1', 'user-1');
    assert.deepEqual(result.retailers, [{
        retailerName: 'Coles',
        urls: ['https://www.coles.com.au/product/1'],
    }]);
});

test('start shopping creates a persistent checklist session without mutating the run', async () => {
    const run = {
        id: 'run-1',
        plans: [{
            id: 'plan-1',
            items: [{
                lineItemId: 'milk-line',
                productId: PRODUCT_ID,
                productName: 'Milk',
                imageUrl: 'https://example.test/milk.jpg',
                quantity: 2,
                retailerId: COLES_ID,
                retailerName: 'Coles',
                price: { amount: '3.49', currency: 'AUD' },
                productUrl: 'https://www.coles.com.au/product/1',
            }],
        }],
    };
    const sessions = [];
    const repo = appRepository();
    repo.getRun = async () => structuredClone(run);
    repo.createShoppingSession = async (session) => {
        sessions.push(structuredClone(session));
        return session;
    };
    const service = createComparisonService({
        deRepository: productRepository(),
        appRepository: repo,
        listRepository: listRepository(),
        forecastClient: { forecast: async () => null },
        clock: () => NOW,
        uuid: () => 'session-1',
    });

    const result = await service.startShopping('run-1', 'plan-1', 'user-1');

    assert.equal(result.sessionId, 'session-1');
    assert.equal(result.groups[0].items[0].quantity, 2);
    assert.equal(result.groups[0].items[0].checked, false);
    assert.equal(result.groups[0].retailerCapability, 'product_page');
    assert.equal(result.groups[0].items[0].linkStatus, 'exact');
    assert.equal(result.sandbox, undefined);
    assert.equal(sessions.length, 1);
    assert.equal(run.plans[0].items[0].checked, undefined);
});

test('shopping session access is owner-scoped and checklist updates return the saved session', async () => {
    const repo = appRepository();
    repo.getShoppingSession = async (sessionId, userId) => (
        sessionId === 'session-1' && userId === 'user-1'
            ? { id: sessionId, status: 'active', groups: [] }
            : null
    );
    repo.updateShoppingSessionItem = async (sessionId, itemId, userId, checked) => ({
        id: sessionId,
        status: 'active',
        groups: [{ items: [{ id: itemId, checked }] }],
        userId,
    });
    const service = createComparisonService({
        deRepository: productRepository(),
        appRepository: repo,
        listRepository: listRepository(),
        forecastClient: { forecast: async () => null },
    });

    assert.equal((await service.getShoppingSession('session-1', 'user-1')).id, 'session-1');
    await assert.rejects(() => service.getShoppingSession('session-1', 'another-user'), /not found/i);
    const updated = await service.updateShoppingSessionItem('session-1', 'milk-line', 'user-1', true);
    assert.equal(updated.groups[0].items[0].checked, true);
});

test('applying a substitution creates a replacement run without mutating the source', async () => {
    const source = {
        id: 'run-1',
        listId: 'list-1',
        listName: 'Weekly groceries',
        objective: 'lowest_total',
        maxRetailers: 1,
        allowStoreBrandSubstitutions: true,
        items: [{ productId: PRODUCT_ID, name: 'Milk', quantity: 1 }],
        plans: [],
    };
    const stored = [];
    const decisions = [];
    const repo = appRepository(stored);
    repo.getRun = async () => structuredClone(source);
    repo.recordSubstitutionDecision = async (decision) => decisions.push(decision);
    const service = createComparisonService({
        deRepository: productRepository(),
        appRepository: repo,
        listRepository: listRepository(),
        forecastClient: { forecast: async () => null },
        clock: () => NOW,
        uuid: (() => {
            const ids = ['run-2', 'plan-2', 'decision-1'];
            return () => ids.shift();
        })(),
    });

    const replacementId = '22222222-2222-4222-8222-222222222222';
    const result = await service.applySubstitution('run-1', 'user-1', {
        originalProductId: PRODUCT_ID,
        replacementProductId: replacementId,
    });

    assert.equal(source.items[0].productId, PRODUCT_ID);
    assert.equal(result.parentRunId, 'run-1');
    assert.equal(result.items[0].productId, replacementId);
    assert.equal(stored.length, 1);
    assert.equal(decisions[0].action, 'applied');
});

test('store-brand mode returns only verified lower-unit-price suggestions', async () => {
    const deRepo = productRepository();
    deRepo.getAlternatives = async () => ({
        sameProductOtherSizes: [],
        similarProducts: [{
            productId: '22222222-2222-4222-8222-222222222222',
            name: 'Farmdale Full Cream Milk',
            brand: 'Farmdale',
            packQuantity: '2',
            packUom: 'L',
            cheapestOffer: {
                retailerName: 'Aldi',
                price: { amount: '3.19', currency: 'AUD' },
                unitPrice: '1.595',
            },
        }],
    });
    const service = createComparisonService({
        deRepository: deRepo,
        appRepository: appRepository(),
        listRepository: listRepository(),
        forecastClient: { forecast: async () => null },
        clock: () => NOW,
        uuid: (() => {
            const ids = ['run-suggestions', 'plan-suggestions', 'suggestion-1'];
            return () => ids.shift();
        })(),
    });

    const result = await service.createListRun('list-1', 'user-1', {
        objective: 'lowest_total',
        maxRetailers: 1,
        allowStoreBrandSubstitutions: true,
    });

    assert.equal(result.suggestions.length, 1);
    assert.equal(result.suggestions[0].replacement.productId, '22222222-2222-4222-8222-222222222222');
    assert.equal(result.suggestions[0].estimatedSaving.amount, '0.30');
});

test('DE failure returns the latest persisted list snapshot as an explicit stale fallback', async () => {
    const latest = {
        id: 'previous-run',
        listId: 'list-1',
        status: 'completed',
        warnings: [],
        plans: [],
    };
    const repo = appRepository();
    repo.getLatestRunForList = async () => structuredClone(latest);
    const service = createComparisonService({
        deRepository: {
            async withReadOnlySnapshot() {
                const error = new Error('DE unavailable');
                error.status = 503;
                throw error;
            },
        },
        appRepository: repo,
        listRepository: listRepository(),
        forecastClient: { forecast: async () => null },
        clock: () => NOW,
    });

    const result = await service.createListRun('list-1', 'user-1', {
        objective: 'lowest_total',
        maxRetailers: 1,
        allowStoreBrandSubstitutions: false,
    });

    assert.equal(result.id, 'previous-run');
    assert.equal(result.isStaleFallback, true);
    assert.equal(result.warnings[0].code, 'de_unavailable_stale_snapshot');
});

function productRepository() {
    const offers = [
        offer(ALDI_ID, 'Aldi', '3.49'),
        offer(COLES_ID, 'Coles', '3.90'),
    ];
    return {
        async withReadOnlySnapshot(callback) { return callback(this); },
        async getProduct() {
            return {
                id: PRODUCT_ID,
                name: 'Devondale Full Cream Milk',
                brand: 'Devondale',
                categoryName: 'Dairy',
                packQuantity: '2',
                packUom: 'L',
                imageUrl: null,
            };
        },
        async getLatestOffers() { return offers; },
        async getRetailers() {
            return [
                { retailerId: ALDI_ID, retailerName: 'Aldi' },
                { retailerId: COLES_ID, retailerName: 'Coles' },
                { retailerId: 'wwwwwwww-wwww-4www-8www-wwwwwwwwwwww', retailerName: 'Woolworths' },
                { retailerId: '11111111-aaaa-4aaa-8aaa-111111111111', retailerName: 'IGA', dataAvailable: false },
            ];
        },
        async getProductRetailerIds() { return [ALDI_ID, COLES_ID]; },
        async getOffersForProducts() { return offers; },
        async getPriceHistory() {
            return [
                { retailerId: ALDI_ID, retailerName: 'Aldi', price: '3.95', observedAt: '2026-06-01T00:00:00.000Z' },
                { retailerId: ALDI_ID, retailerName: 'Aldi', price: '3.80', observedAt: '2026-07-01T00:00:00.000Z' },
                { retailerId: ALDI_ID, retailerName: 'Aldi', price: '3.49', observedAt: '2026-08-20T00:00:00.000Z' },
                { retailerId: COLES_ID, retailerName: 'Coles', price: '4.10', observedAt: '2026-06-01T00:00:00.000Z' },
                { retailerId: COLES_ID, retailerName: 'Coles', price: '4.00', observedAt: '2026-07-01T00:00:00.000Z' },
                { retailerId: COLES_ID, retailerName: 'Coles', price: '3.90', observedAt: '2026-08-20T00:00:00.000Z' },
            ];
        },
        async getAlternatives() { return []; },
        async getWatermark() { return '2026-08-20T08:00:00.000Z'; },
        async resolveListItems(items) {
            return items.map((item) => ({ ...item, productId: PRODUCT_ID }));
        },
    };
}

function appRepository(stored = []) {
    return {
        async persistRun(snapshot) {
            stored.push(structuredClone(snapshot));
            return snapshot;
        },
        async getRun() { return null; },
        async markShoppingStarted() {},
        async recordEvents() {},
    };
}

function listRepository() {
    return {
        async getList() {
            return {
                id: 'list-1',
                name: 'Weekly groceries',
                items: [{ legacyProductId: 'legacy-1', name: 'Milk', quantity: 1 }],
            };
        },
    };
}

function offer(retailerId, retailerName, price) {
    return {
        productId: PRODUCT_ID,
        retailerId,
        retailerName,
        price,
        currency: 'AUD',
        packQuantity: '2',
        packUom: 'L',
        unitPrice: String(Number(price) / 2),
        isOnSpecial: false,
        specialText: null,
        productUrl: `https://www.${retailerName.toLowerCase()}.com.au/product/1`,
        observedAt: '2026-08-20T00:00:00.000Z',
    };
}
