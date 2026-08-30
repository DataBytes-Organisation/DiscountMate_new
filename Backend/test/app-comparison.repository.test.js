const test = require('node:test');
const assert = require('node:assert/strict');

const { AppComparisonRepository } = require('../src/comparison/repositories/app-comparison.repository');

test('shopping sessions persist their grouped item snapshots transactionally', async () => {
    const queries = [];
    const client = {
        async query(sql, params) {
            queries.push({ sql: String(sql), params });
            return { rows: [] };
        },
        release() {},
    };
    const repository = new AppComparisonRepository({ connect: async () => client });
    const session = {
        id: '11111111-1111-4111-8111-111111111111',
        runId: '22222222-2222-4222-8222-222222222222',
        planId: '33333333-3333-4333-8333-333333333333',
        userId: 'student@example.com',
        status: 'active',
        createdAt: '2026-08-22T00:00:00.000Z',
        groups: [{
            retailerName: 'Coles',
            items: [{
                lineItemId: 'milk-line',
                productId: '44444444-4444-4444-8444-444444444444',
                productName: 'Milk',
                quantity: 2,
                retailerId: '55555555-5555-4555-8555-555555555555',
                retailerName: 'Coles',
                price: { amount: '3.49', currency: 'AUD' },
                checked: false,
            }],
        }],
    };

    const result = await repository.createShoppingSession(session);

    assert.equal(result.id, session.id);
    assert.match(queries[1].sql, /INSERT INTO app\.shopping_sessions/);
    assert.match(queries[2].sql, /INSERT INTO app\.shopping_session_items/);
    assert.match(queries.at(-1).sql, /COMMIT/);
});

test('shopping session hydration preserves retailer capability and link status snapshots', async () => {
    const pool = {
        async query(sql) {
            if (/FROM app\.shopping_sessions/.test(String(sql))) {
                return { rows: [{
                    snapshot_json: {
                        id: 'session-1',
                        groups: [{ retailerName: 'ALDI', retailerCapability: 'catalogue_only', items: [] }],
                    },
                    status: 'active',
                    created_at: '2026-08-22T00:00:00.000Z',
                    updated_at: '2026-08-22T00:00:00.000Z',
                }] };
            }
            return { rows: [{
                line_item_id: 'maple-line',
                de_product_id: '44444444-4444-4444-8444-444444444444',
                product_name: 'Pure Maple Syrup', image_url: null, quantity: 1,
                retailer_id: '55555555-5555-4555-8555-555555555555', retailer_name: 'ALDI',
                price_amount: '6.99', currency: 'AUD', product_url: null, checked: false, position: 0,
                snapshot_json: { retailerCapability: 'catalogue_only', linkStatus: 'unsupported' },
            }] };
        },
    };

    const session = await new AppComparisonRepository(pool).getShoppingSession('session-1', 'student@example.com');

    assert.equal(session.groups[0].retailerCapability, 'catalogue_only');
    assert.equal(session.groups[0].items[0].retailerCapability, 'catalogue_only');
    assert.equal(session.groups[0].items[0].linkStatus, 'unsupported');
});

test('comparison snapshots persist unavailable savings without fabricating verified savings', async () => {
    const client = {
        async query(sql) {
            if (/RETURNING id/.test(String(sql))) {
                return { rows: [{ id: '66666666-6666-4666-8666-666666666666' }] };
            }
            return { rows: [] };
        },
        release() {},
    };
    const repository = new AppComparisonRepository({ connect: async () => client });
    const snapshot = {
        id: '11111111-1111-4111-8111-111111111111',
        parentRunId: null,
        userId: 'student@example.com',
        listId: 'legacy-list',
        listName: 'Weekly',
        status: 'completed',
        objective: 'lowest_total',
        maxRetailers: 1,
        allowStoreBrandSubstitutions: false,
        calculationPolicyVersion: 'comparison-v2.2',
        dataWatermark: '2026-05-04T00:00:00.000Z',
        warnings: [],
        createdAt: '2026-08-22T00:00:00.000Z',
        retailerResults: [{
            retailerId: '22222222-2222-4222-8222-222222222222',
            retailerName: 'Coles',
            total: { amount: '3.49', currency: 'AUD' },
            savings: null,
            coverage: { found: 1, total: 1 },
            substitutions: 0,
            rankEligible: true,
            itemResults: [],
        }],
        plans: [{
            id: '33333333-3333-4333-8333-333333333333',
            total: { amount: '3.49', currency: 'AUD' },
            savings: null,
            coverage: { found: 1, total: 1 },
            retailers: [{ retailerId: '22222222-2222-4222-8222-222222222222' }],
            substitutions: 0,
            items: [],
        }],
    };

    await assert.doesNotReject(() => repository.persistRun(snapshot));
});

test('comparison persistence keys repeated products by saved-list line identity', async () => {
    const itemQueries = [];
    const client = {
        async query(sql, params) {
            if (/INSERT INTO app\.comparison_item_results/.test(String(sql))) itemQueries.push({ sql: String(sql), params });
            if (/RETURNING id/.test(String(sql))) return { rows: [{ id: '66666666-6666-4666-8666-666666666666' }] };
            return { rows: [] };
        },
        release() {},
    };
    const repository = new AppComparisonRepository({ connect: async () => client });
    const item = (lineItemId) => ({
        lineItemId,
        productId: '44444444-4444-4444-8444-444444444444',
        productName: 'Donation',
        quantity: 1,
        retailerId: '55555555-5555-4555-8555-555555555555',
        retailerName: 'Coles',
        price: { amount: '2.00', currency: 'AUD' },
        observedAt: '2026-05-04T00:00:00.000Z',
    });
    const snapshot = {
        id: '11111111-1111-4111-8111-111111111111', userId: 'student@example.com',
        listId: 'legacy-list', listName: 'Weekly', status: 'completed', objective: 'lowest_total',
        maxRetailers: 1, allowStoreBrandSubstitutions: false, calculationPolicyVersion: 'comparison-v2.2',
        dataWatermark: '2026-05-04T00:00:00.000Z', warnings: [], createdAt: '2026-08-22T00:00:00.000Z',
        retailerResults: [{
            retailerId: '55555555-5555-4555-8555-555555555555', retailerName: 'Coles',
            total: { amount: '4.00', currency: 'AUD' }, savings: null,
            coverage: { found: 2, total: 2 }, substitutions: 0, rankEligible: true,
            itemResults: [item('donation-redkite'), item('donation-secondbite')],
        }],
        plans: [],
    };

    await repository.persistRun(snapshot);

    assert.equal(itemQueries.length, 2);
    assert.match(itemQueries[0].sql, /line_item_id/);
    assert.notEqual(itemQueries[0].params[2], itemQueries[1].params[2]);
});

test('App PostgreSQL connection failures are classified for actionable API errors', async () => {
    const repository = new AppComparisonRepository({
        async connect() { throw new Error('connection refused'); },
    });

    await assert.rejects(
        repository.persistRun({}),
        (error) => error.source === 'app' && /connection refused/.test(error.message),
    );
});
