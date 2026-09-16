const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DeComparisonRepository,
    mapOffer,
} = require('../src/comparison/repositories/de-comparison.repository');

test('offer mapping normalizes unit prices from shelf price and pack metadata', () => {
    const offer = mapOffer({
        product_id: '10000000-0000-4000-8000-000000000001',
        retailer_id: '30000000-0000-4000-8000-000000000001',
        retailer_name: 'ALDI',
        price: '2.49',
        unit_price: '1.0000',
        pack_quantity: '250',
        pack_uom: 'g',
        observed_at: '2026-05-04T00:00:00.000Z',
    });

    assert.equal(offer.unitPrice, '9.9600');
});

test('product search returns comparison identity and retailer coverage', async () => {
    const db = {
        async query(sql) {
            assert.match(sql, /available_retailers/);
            assert.match(sql, /offer_count/);
            return { rows: [{
                product_id: '10000000-0000-4000-8000-000000000001',
                source_product_id: '10000000-0000-4000-8000-000000000099',
                product_name: 'Macro Fresh Lettuce',
                brand_name: 'Macro',
                category_name: 'FRUIT, VEG & PRODUCE',
                pack_quantity: '1',
                pack_uom: 'ea',
                image_url: null,
                available_retailers: [
                    { retailerId: '30000000-0000-4000-8000-000000000001', retailerName: 'woolworths' },
                ],
                offer_count: '1',
            }] };
        },
    };

    const [product] = await new DeComparisonRepository(db).searchProducts('lettuce');

    assert.equal(product.comparisonProductId, '10000000-0000-4000-8000-000000000001');
    assert.equal(product.sourceProductId, '10000000-0000-4000-8000-000000000099');
    assert.equal(product.offerCount, 1);
    assert.deepEqual(product.availableRetailers, [{
        retailerId: '30000000-0000-4000-8000-000000000001',
        retailerName: 'woolworths',
    }]);
});

test('retailer coverage diagnostics expose positive offers and group-size distribution', async () => {
    const db = {
        async query(sql) {
            assert.match(sql, /comparison_match_review_queue/);
            return { rows: [{
                retailers: [{ retailerId: 'aldi-id', retailerName: 'aldi', offerCount: 2801 }],
                group_distribution: { 1: 100, 2: 20, 3: 4, 4: 1 },
                pending_review_count: '7',
            }] };
        },
    };

    const result = await new DeComparisonRepository(db).getRetailerCoverageDiagnostics();

    assert.deepEqual(result.retailers[0], {
        retailerId: 'aldi-id', retailerName: 'aldi', offerCount: 2801,
    });
    assert.deepEqual(result.groupDistribution, { singleton: 100, twoRetailers: 20, threeRetailers: 4, fourRetailers: 1 });
    assert.equal(result.pendingReviewCount, 7);
});

test('retailer discovery retains supported retailers whose current data load is unavailable', async () => {
    const db = {
        async query(sql) {
            assert.match(sql, /FROM silver\.dim_retailers retailer/);
            assert.match(sql, /retailer_data_available/);
            return { rows: [
                {
                    retailer_id: '30000000-0000-4000-8000-000000000001',
                    retailer_name: 'ALDI',
                    retailer_data_available: false,
                },
                {
                    retailer_id: '30000000-0000-4000-8000-000000000002',
                    retailer_name: 'Woolworths',
                    retailer_data_available: true,
                },
            ] };
        },
    };

    const retailers = await new DeComparisonRepository(db).getRetailers();

    assert.deepEqual(retailers, [
        {
            retailerId: '30000000-0000-4000-8000-000000000001',
            retailerName: 'ALDI',
            dataAvailable: false,
        },
        {
            retailerId: '30000000-0000-4000-8000-000000000002',
            retailerName: 'Woolworths',
            dataAvailable: true,
        },
    ]);
});

test('alternatives use the latest available offer without an age cutoff', async () => {
    const queries = [];
    const db = {
        async query(sql, params) {
            queries.push({ sql, params });
            if (queries.length === 1) {
                return {
                    rows: [{
                        product_id: '10000000-0000-4000-8000-000000000001',
                        product_name: 'Example Milk',
                        brand_name: 'Example',
                        category_id: '20000000-0000-4000-8000-000000000001',
                        category_name: 'DAIRY & REFRIGERATED',
                        gtin: null,
                        pack_quantity: '1',
                        pack_uom: 'L',
                        image_url: null,
                    }],
                };
            }

            return { rows: [] };
        },
    };
    const repository = new DeComparisonRepository(db);

    await repository.getAlternatives('10000000-0000-4000-8000-000000000001');

    assert.equal(queries.length, 2);
    assert.match(queries[1].sql, /comparison_latest_offers/);
    assert.doesNotMatch(queries[1].sql, /CURRENT_TIMESTAMP|INTERVAL\s+'8 days'/);
});

test('history ranges are anchored to the Silver data watermark', async () => {
    const queries = [];
    const db = {
        async query(sql, params) {
            queries.push({ sql, params });

            return { rows: [] };
        },
    };
    const repository = new DeComparisonRepository(db);

    await repository.getPriceHistory(
        '10000000-0000-4000-8000-000000000001',
        '3m'
    );

    assert.equal(queries[0].params[1], '90');
    assert.match(queries[0].sql, /FROM silver\.comparison_price_history\s*\n\s*\)/);
    assert.doesNotMatch(queries[0].sql, /CURRENT_TIMESTAMP/);
});

test('offer loading supports older Silver views without retailer_product_id', async () => {
    const queries = [];
    const db = {
        async query(sql) {
            queries.push(sql);
            if (/SELECT\s+product_id,\s*retailer_product_id/.test(sql)) {
                const error = new Error('column "retailer_product_id" does not exist');
                error.code = '42703';
                throw error;
            }
            return { rows: [] };
        },
    };
    const repository = new DeComparisonRepository(db);

    await repository.getOffersForProducts(['10000000-0000-4000-8000-000000000001']);

    assert.equal(queries.length, 1);
    assert.match(queries[0], /to_jsonb\(offer\).*retailer_product_id/);
});

test('product lookup accepts a comparison group id or a legacy Silver product id', async () => {
    const queries = [];
    const db = { async query(sql) {
        queries.push(sql);
        if (/to_regclass/.test(sql)) return { rows: [{ relation: 'silver.comparison_product_members' }] };
        return { rows: [] };
    } };
    const repository = new DeComparisonRepository(db);

    await repository.getProduct('10000000-0000-4000-8000-000000000001');

    assert.match(queries[0], /comparison_products/);
    assert.match(queries.at(-1), /comparison_product_members/);
    assert.match(queries.at(-1), /dim_product_id/);
});

test('direct product lookup works when comparison_product_members is not deployed', async () => {
    const db = {
        async query(sql) {
            if (/comparison_product_members/.test(sql)) {
                const error = new Error('relation "silver.comparison_product_members" does not exist');
                error.code = '42P01';
                throw error;
            }
            if (/FROM silver\.comparison_products/.test(sql)) {
                return { rows: [{
                    product_id: '10000000-0000-4000-8000-000000000001',
                    product_name: 'Milk', brand_name: 'Example', category_name: 'Dairy',
                    category_id: '20000000-0000-4000-8000-000000000001',
                    pack_quantity: '1', pack_uom: 'L', source_product_id: null,
                }] };
            }
            return { rows: [] };
        },
    };
    const repository = new DeComparisonRepository(db);

    const product = await repository.getProduct('10000000-0000-4000-8000-000000000001');

    assert.equal(product.id, '10000000-0000-4000-8000-000000000001');
    assert.equal(product.name, 'Milk');
});

test('list resolution prefers exact GTIN and refuses ambiguous name-only matches', async () => {
    const db = {
        async query(sql, params) {
            if (/WHERE product_id = \$1/.test(sql)) return { rows: [] };
            if (/gtin = \$1/.test(sql)) {
                if (params[0] === '9343496000637') {
                    return { rows: [{
                        product_id: '10000000-0000-4000-8000-000000000024',
                        product_name: '& Cola 101 Can 375ml 24 pack',
                        brand_name: '& Cola',
                        gtin: '9343496000637',
                        pack_quantity: '24',
                        pack_uom: 'pack',
                        image_url: 'https://example.test/cola-24.jpg',
                    }] };
                }
                return { rows: [] };
            }
            if (/FROM silver\.comparison_products/.test(sql)) {
                return { rows: [
                    { product_id: 'banana-candy', product_name: 'Bananas', brand_name: 'Life Savers', name_score: 1 },
                    { product_id: 'banana-fruit', product_name: 'Bananas', brand_name: null, name_score: 1 },
                ] };
            }
            return { rows: [] };
        },
    };
    const repository = new DeComparisonRepository(db);

    const resolved = await repository.resolveListItems([
        {
            lineItemId: 'cola-24',
            legacyProductId: 'legacy-cola-24',
            name: '& Cola 101 Can 375ml',
            gtin: '9343496000637',
            quantity: 1,
        },
        { lineItemId: 'bananas', legacyProductId: 'custom-bananas', name: 'Bananas', quantity: 1 },
    ]);

    assert.equal(resolved[0].productId, '10000000-0000-4000-8000-000000000024');
    assert.equal(resolved[0].mappingMethod, 'gtin');
    assert.equal(resolved[0].imageUrl, 'https://example.test/cola-24.jpg');
    assert.equal(resolved[1].resolutionStatus, 'ambiguous');
    assert.equal(resolved[1].productId, undefined);
});

test('list resolution accepts one high-confidence normalized name, brand, category and pack match', async () => {
    const db = {
        async query(sql) {
            if (/FROM silver\.comparison_products/.test(sql)) return { rows: [{
                product_id: '10000000-0000-4000-8000-000000000025',
                product_name: 'Fantastic Chicken Flavour Brown Rice Noodles',
                brand_name: 'Fantastic',
                category_id: '20000000-0000-4000-8000-000000000001',
                pack_quantity: '210',
                pack_uom: 'g',
                name_score: 0.94,
            }] };
            return { rows: [] };
        },
    };
    const repository = new DeComparisonRepository(db);

    const [resolved] = await repository.resolveListItems([{
        lineItemId: 'noodles', name: 'Fantastic Chicken Brown-Rice Noodles',
        brand: 'Fantastic', categoryId: '20000000-0000-4000-8000-000000000001',
        packQuantity: '210', packUom: 'g', quantity: 1,
    }]);

    assert.equal(resolved.resolutionStatus, 'resolved');
    assert.equal(resolved.mappingMethod, 'exact_identity');
});

test('list resolution does not require the optional pg_trgm extension', async () => {
    const queries = [];
    const db = {
        async query(sql) {
            queries.push(sql);
            if (/similarity\(/.test(sql)) {
                const error = new Error('function similarity(text, text) does not exist');
                error.code = '42883';
                throw error;
            }
            if (/FROM silver\.comparison_products/.test(sql)) {
                return { rows: [{
                    product_id: '10000000-0000-4000-8000-000000000025',
                    product_name: 'Fantastic Chicken Flavour Brown Rice Noodles',
                    brand_name: 'Fantastic',
                    category_id: '20000000-0000-4000-8000-000000000001',
                    pack_quantity: '210',
                    pack_uom: 'g',
                }] };
            }
            return { rows: [] };
        },
    };
    const repository = new DeComparisonRepository(db);

    const [resolved] = await repository.resolveListItems([{
        lineItemId: 'noodles', name: 'Fantastic Chicken Brown-Rice Noodles',
        brand: 'Fantastic', categoryId: '20000000-0000-4000-8000-000000000001',
        packQuantity: '210', packUom: 'g', quantity: 1,
    }]);

    assert.equal(resolved.resolutionStatus, 'resolved');
    assert.equal(resolved.mappingMethod, 'exact_identity');
    assert.equal(queries.some((sql) => /similarity\(/.test(sql)), false);
});

test('alternatives exclude unrelated pantry products and recompute missing normalized unit prices', async () => {
    const db = {
        async query(sql) {
            if (/WHERE product_id = \$1::uuid/.test(sql) && !/product_id <>/.test(sql)) {
                return { rows: [{
                    product_id: '10000000-0000-4000-8000-000000000001',
                    product_name: 'Chicken Flavour Brown Rice Noodles',
                    brand_name: 'Fantastic',
                    category_id: '20000000-0000-4000-8000-000000000001',
                    category_name: 'PANTRY',
                    gtin: null,
                    pack_quantity: '210',
                    pack_uom: 'g',
                    image_url: null,
                }] };
            }

            return { rows: [
                alternativeRow({
                    id: '10000000-0000-4000-8000-000000000002',
                    name: 'Pancake & Pikelet Mix', brand: 'White Wings', quantity: '350',
                    price: '3.00', unitPrice: '0.0000',
                }),
                alternativeRow({
                    id: '10000000-0000-4000-8000-000000000003',
                    name: 'Chicken Flavour Brown Rice Noodles', brand: 'Fantastic', quantity: '420',
                    price: '6.00', unitPrice: null,
                }),
                alternativeRow({
                    id: '10000000-0000-4000-8000-000000000004',
                    name: 'Brown Rice Noodles Chicken', brand: 'Trident', quantity: '200',
                    price: '4.00', unitPrice: '20.0000',
                }),
            ] };
        },
    };
    const repository = new DeComparisonRepository(db);

    const alternatives = await repository.getAlternatives('10000000-0000-4000-8000-000000000001');

    assert.deepEqual(alternatives.sameProductOtherSizes.map((item) => item.name), [
        'Chicken Flavour Brown Rice Noodles',
    ]);
    assert.equal(alternatives.sameProductOtherSizes[0].cheapestOffer.unitPrice, '14.2857');
    assert.equal(alternatives.sameProductOtherSizes[0].matchReason, 'same_product_other_size');
    assert.deepEqual(alternatives.similarProducts.map((item) => item.name), [
        'Brown Rice Noodles Chicken',
    ]);
    assert.ok(alternatives.similarProducts[0].matchScore >= 0.55);
});

test('alternatives preselect semantically related names before applying the candidate limit', async () => {
    const queries = [];
    const db = {
        async query(sql, params) {
            queries.push({ sql, params });
            if (/WHERE product_id = \$1::uuid/.test(sql) && !/product_id <>/.test(sql)) {
                return { rows: [{
                    product_id: '10000000-0000-4000-8000-000000000001',
                    product_name: 'Apple Sauce',
                    brand_name: 'Three Threes',
                    category_id: '20000000-0000-4000-8000-000000000001',
                    category_name: 'PANTRY',
                    gtin: null,
                    pack_quantity: '250',
                    pack_uom: 'g',
                    image_url: null,
                }] };
            }
            return { rows: [] };
        },
    };

    await new DeComparisonRepository(db).getAlternatives(
        '10000000-0000-4000-8000-000000000001'
    );

    const candidateQuery = queries[1];
    assert.equal(candidateQuery.params[3], 'Apple Sauce');
    assert.match(candidateQuery.sql, /shared_token_count/);
    assert.match(candidateQuery.sql, /shared_token_count\s+DESC/);
});

test('product search ranks stronger retailer coverage ahead of equally relevant names', async () => {
    const queries = [];
    const db = {
        async query(sql, params) {
            queries.push({ sql, params });
            return { rows: [] };
        },
    };

    await new DeComparisonRepository(db).searchProducts('apple');

    assert.match(queries[0].sql, /coverage\.offer_count\s+DESC/);
});

function alternativeRow({ id, name, brand, quantity, price, unitPrice }) {
    return {
        product_id: id,
        product_name: name,
        brand_name: brand,
        category_name: 'PANTRY',
        pack_quantity: quantity,
        pack_uom: 'g',
        image_url: null,
        retailer_id: '30000000-0000-4000-8000-000000000001',
        retailer_name: 'Coles',
        price,
        unit_price: unitPrice,
        product_url: 'https://www.coles.com.au/product/example',
        observed_at: '2026-05-04T08:00:00.000Z',
    };
}
