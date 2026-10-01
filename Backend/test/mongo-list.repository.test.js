const test = require('node:test');
const assert = require('node:assert/strict');

const { MongoListRepository } = require('../src/comparison/repositories/mongo-list.repository');

test('Mongo list input preserves line identity and enriches product matching metadata', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const listId = '507f191e810c19729de860ea';
    const productId = '507f1f77bcf86cd799439012';
    const db = {
        collection(name) {
            if (name === 'users') return { findOne: async () => ({ _id: userId }) };
            if (name === 'shopping_lists') {
                return {
                    findOne: async () => ({
                        _id: listId,
                        user_id: userId,
                        list_name: 'Weekly',
                        items: [{
                            _id: 'line-cola-24',
                            product_id: productId,
                            name: '& Cola 101 Can 375ml',
                            quantity: 1,
                            image: 'https://example.test/list-image.jpg',
                        }],
                    }),
                };
            }
            if (name === 'products') {
                return {
                    find() {
                        return {
                            toArray: async () => [{
                                _id: productId,
                                brand: '& Cola',
                                gtin: '9343496000637',
                                package_size: 24,
                                package_unit: 'pack',
                                image_url: 'https://example.test/catalogue-image.jpg',
                            }],
                        };
                    },
                };
            }
            throw new Error(`Unexpected collection ${name}`);
        },
    };
    const repository = new MongoListRepository(async () => db);

    const list = await repository.getList(listId, 'student@example.com');

    assert.equal(list.items[0].lineItemId, 'line-cola-24');
    assert.equal(list.items[0].gtin, '9343496000637');
    assert.equal(list.items[0].packQuantity, 24);
    assert.equal(list.items[0].packUom, 'pack');
    assert.equal(list.items[0].imageUrl, 'https://example.test/list-image.jpg');
});

test('Mongo list input enriches current saved-list items whose legacy product reference is stored as id', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const listId = '507f191e810c19729de860ea';
    const productId = '507f1f77bcf86cd799439099';
    let queriedProductIds = [];
    const db = {
        collection(name) {
            if (name === 'users') return { findOne: async () => ({ _id: userId }) };
            if (name === 'shopping_lists') {
                return {
                    findOne: async () => ({
                        _id: listId,
                        user_id: userId,
                        list_name: 'Current writer format',
                        items: [{
                            id: productId,
                            name: 'Devondale Full Cream Milk',
                            quantity: 1,
                        }],
                    }),
                };
            }
            if (name === 'products') {
                return {
                    find(query) {
                        queriedProductIds = query.$or[0]._id.$in.map(String);
                        return {
                            toArray: async () => [{
                                _id: productId,
                                brand: 'Devondale',
                                gtin: '9300000000001',
                                unit_per_prod: 2,
                                measurement: 'L',
                            }],
                        };
                    },
                };
            }
            throw new Error(`Unexpected collection ${name}`);
        },
    };
    const repository = new MongoListRepository(async () => db);

    const list = await repository.getList(listId, 'student@example.com');

    assert.deepEqual(queriedProductIds, [productId]);
    assert.equal(list.items[0].legacyProductId, productId);
    assert.equal(list.items[0].gtin, '9300000000001');
    assert.equal(list.items[0].packQuantity, 2);
    assert.equal(list.items[0].packUom, 'L');
});

test('Mongo list input enriches a non-ObjectId product_code reference', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const listId = '507f191e810c19729de860ea';
    const productCode = 'coles-12345';
    let lookupQuery;
    const db = {
        collection(name) {
            if (name === 'users') return { findOne: async () => ({ _id: userId }) };
            if (name === 'shopping_lists') {
                return {
                    findOne: async () => ({
                        _id: listId,
                        user_id: userId,
                        items: [{ id: productCode, name: 'Cheddar Cheese', quantity: 1 }],
                    }),
                };
            }
            if (name === 'products') {
                return {
                    find(query) {
                        lookupQuery = query;
                        return {
                            toArray: async () => [{
                                _id: '507f1f77bcf86cd799439077',
                                product_code: productCode,
                                brand: 'Coles',
                                gtin: '9300000000070',
                                unit_per_prod: 500,
                                measurement: 'g',
                            }],
                        };
                    },
                };
            }
            throw new Error(`Unexpected collection ${name}`);
        },
    };
    const repository = new MongoListRepository(async () => db);

    const list = await repository.getList(listId, 'student@example.com');

    assert.deepEqual(lookupQuery.$or[1], { product_code: { $in: [productCode] } });
    assert.equal(list.items[0].legacyProductId, productCode);
    assert.equal(list.items[0].gtin, '9300000000070');
    assert.equal(list.items[0].packQuantity, 500);
    assert.equal(list.items[0].packUom, 'g');
});
