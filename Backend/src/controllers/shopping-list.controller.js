const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const { connectToMongoDB } = require('../config/database');
const {
    applyOwnershipFields,
    calculateListPricingSnapshot,
    formatSnapshotResponse,
    normalizeDashboardRetailer,
} = require('../utils/savedLists');

const COLLECTION_NAME = 'shopping_lists';
const ACCENTS = new Set(['emerald', 'amber', 'sky', 'violet', 'rose']);

function getToken(req) {
    return req.headers.authorization && req.headers.authorization.split(' ')[1];
}

async function getAuthenticatedUser(req) {
    const token = getToken(req);
    if (!token) {
        const err = new Error('Authorization token is required');
        err.status = 401;
        throw err;
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        const err = new Error('Invalid token, please log in again');
        err.status = 401;
        throw err;
    }

    const db = await connectToMongoDB();
    const user = await db.collection('users').findOne(
        { email: decoded.email },
        { projection: { encrypted_password: 0 } }
    );

    if (!user) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
    }

    return { db, user };
}

function toObjectId(id) {
    if (!ObjectId.isValid(id)) {
        const err = new Error('Invalid shopping list id');
        err.status = 400;
        throw err;
    }
    return new ObjectId(id);
}

function numberOrZero(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function formatDateLabel(value) {
    if (!value) return 'Just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';
    return date.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function cleanRetailerPrices(retailerPrices) {
    if (!retailerPrices || typeof retailerPrices !== 'object') return undefined;

    const cleaned = {};
    ['aldi', 'coles', 'woolworths', 'iga'].forEach((retailer) => {
        const price = Number(retailerPrices[retailer]);
        if (Number.isFinite(price) && price > 0) {
            cleaned[retailer] = price;
        }
    });

    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function cleanItems(items) {
    if (!Array.isArray(items)) return [];

    return items.map((item) => {
        const id = String(
            item.id ||
            item.product_code ||
            item.productId ||
            item.product_id ||
            new ObjectId().toString()
        );

        const quantity = Math.max(1, Math.floor(numberOrZero(item.quantity) || 1));
        const price = numberOrZero(item.price || item.unit_price);
        const cleanedItem = {
            id,
            name: String(item.name || item.product_name || 'Unnamed product'),
            price,
            quantity,
        };

        if (item.store) cleanedItem.store = String(item.store);
        if (item.image || item.link_image) cleanedItem.image = String(item.image || item.link_image);
        if (item.category || item.category_name) {
            cleanedItem.category = String(item.category || item.category_name);
        }
        if (item.categoryId || item.category_id) {
            cleanedItem.categoryId = String(item.categoryId || item.category_id);
        }

        const retailerPrices = cleanRetailerPrices(item.retailerPrices);
        if (retailerPrices) cleanedItem.retailerPrices = retailerPrices;

        return cleanedItem;
    });
}

function computeListTotal(items) {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

async function getProductCategoryMap(db, docs) {
    const itemIds = docs.flatMap((doc) => cleanItems(doc.items).map((item) => item.id));
    const objectIds = itemIds
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));

    if (objectIds.length === 0 && itemIds.length === 0) return new Map();

    const products = await db.collection('products').find({
        $or: [
            ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
            { product_code: { $in: itemIds } },
        ],
    }).project({
        _id: 1,
        product_code: 1,
        category_id: 1,
        category_name: 1,
        category: 1,
    }).toArray();

    const categoryIds = products
        .map((product) => product.category_id)
        .filter((id) => id && ObjectId.isValid(String(id)))
        .map((id) => new ObjectId(String(id)));

    const categories = categoryIds.length > 0
        ? await db.collection('categories').find({ _id: { $in: categoryIds } }).project({
            _id: 1,
            category_name: 1,
        }).toArray()
        : [];

    const categoryById = new Map(
        categories.map((category) => [category._id.toString(), category.category_name])
    );
    const productCategoryByKey = new Map();

    products.forEach((product) => {
        const category =
            product.category_name ||
            product.category ||
            categoryById.get(product.category_id?.toString());

        if (!category) return;

        productCategoryByKey.set(product._id.toString(), {
            category,
            categoryId: product.category_id ? product.category_id.toString() : undefined,
        });

        if (product.product_code != null) {
            productCategoryByKey.set(String(product.product_code), {
                category,
                categoryId: product.category_id ? product.category_id.toString() : undefined,
            });
        }
    });

    return productCategoryByKey;
}

function enrichItemsWithCategories(items, productCategoryByKey) {
    return items.map((item) => {
        if (item.category) return item;

        const productCategory = productCategoryByKey.get(item.id);
        if (!productCategory) return item;

        return {
            ...item,
            category: productCategory.category,
            categoryId: item.categoryId || productCategory.categoryId,
        };
    });
}

function toApiList(doc, productCategoryByKey = new Map()) {
    const items = enrichItemsWithCategories(cleanItems(doc.items), productCategoryByKey);
    const total = typeof doc.total === 'number' ? doc.total : computeListTotal(items);

    return {
        id: doc._id.toString(),
        name: doc.list_name || doc.name || 'Untitled list',
        description: doc.description || '',
        accent: ACCENTS.has(doc.accent) ? doc.accent : 'emerald',
        createdLabel: formatDateLabel(doc.created_at || doc.createdAt),
        updatedLabel: formatDateLabel(doc.updated_at || doc.updatedAt),
        items,
        total,
        savings: numberOrZero(doc.savings),
    };
}

function buildListUpdate(payload) {
    const update = {};

    if (payload.name !== undefined || payload.list_name !== undefined) {
        const name = String(payload.name || payload.list_name || '').trim();
        update.list_name = name || 'Untitled list';
    }

    if (payload.description !== undefined) {
        update.description = String(payload.description || '').trim();
    }

    if (payload.accent !== undefined) {
        update.accent = ACCENTS.has(payload.accent) ? payload.accent : 'emerald';
    }

    if (payload.items !== undefined) {
        const items = cleanItems(payload.items);
        update.items = items;
        update.total = computeListTotal(items);
    } else if (payload.total !== undefined) {
        update.total = numberOrZero(payload.total);
    }

    if (payload.savings !== undefined) {
        update.savings = numberOrZero(payload.savings);
    }

    update.updated_at = new Date();
    return update;
}

async function getShoppingLists(req, res) {
    try {
        const { db, user } = await getAuthenticatedUser(req);
        const docs = await db.collection(COLLECTION_NAME)
            .find({ user_id: user._id.toString() })
            .sort({ is_active: -1, updated_at: -1, created_at: -1 })
            .toArray();

        const activeDoc = docs.find((doc) => doc.is_active) || docs[0] || null;
        const productCategoryByKey = await getProductCategoryMap(db, docs);

        return res.status(200).json({
            lists: docs.map((doc) => toApiList(doc, productCategoryByKey)),
            activeListId: activeDoc ? activeDoc._id.toString() : null,
        });
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message || 'Internal Server Error' });
    }
}

async function createShoppingList(req, res) {
    try {
        const { db, user } = await getAuthenticatedUser(req);
        const now = new Date();
        const existingCount = await db.collection(COLLECTION_NAME).countDocuments({
            user_id: user._id.toString(),
        });
        const items = cleanItems(req.body.items);
        const shouldBeActive = existingCount === 0 || Boolean(req.body.isActive || req.body.is_active);

        if (shouldBeActive) {
            await db.collection(COLLECTION_NAME).updateMany(
                { user_id: user._id.toString() },
                { $set: { is_active: false, updated_at: now } }
            );
        }

        const doc = {
            user_id: user._id.toString(),
            list_name: String(req.body.name || req.body.list_name || 'Untitled list').trim() || 'Untitled list',
            description: String(req.body.description || '').trim(),
            accent: ACCENTS.has(req.body.accent) ? req.body.accent : 'emerald',
            is_active: shouldBeActive,
            items,
            total: computeListTotal(items),
            savings: numberOrZero(req.body.savings),
            created_at: now,
            updated_at: now,
        };

        const result = await db.collection(COLLECTION_NAME).insertOne(doc);
        return res.status(201).json({
            list: toApiList({ ...doc, _id: result.insertedId }),
            activeListId: shouldBeActive ? result.insertedId.toString() : null,
        });
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message || 'Internal Server Error' });
    }
}

async function updateShoppingList(req, res) {
    try {
        const { db, user } = await getAuthenticatedUser(req);
        const _id = toObjectId(req.params.id);
        const update = buildListUpdate(req.body);

        const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
            { _id, user_id: user._id.toString() },
            { $set: update },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ message: 'Shopping list not found' });
        }

        return res.status(200).json({ list: toApiList(result) });
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message || 'Internal Server Error' });
    }
}

async function deleteShoppingList(req, res) {
    try {
        const { db, user } = await getAuthenticatedUser(req);
        const _id = toObjectId(req.params.id);
        const collection = db.collection(COLLECTION_NAME);
        const list = await collection.findOne({ _id, user_id: user._id.toString() });

        if (!list) {
            return res.status(404).json({ message: 'Shopping list not found' });
        }

        await collection.deleteOne({ _id, user_id: user._id.toString() });

        let activeListId = null;
        if (list.is_active) {
            const nextActive = await collection.findOne(
                { user_id: user._id.toString() },
                { sort: { updated_at: -1, created_at: -1 } }
            );

            if (nextActive) {
                await collection.updateOne(
                    { _id: nextActive._id, user_id: user._id.toString() },
                    { $set: { is_active: true, updated_at: new Date() } }
                );
                activeListId = nextActive._id.toString();
            }
        }

        return res.status(200).json({ message: 'Shopping list deleted', activeListId });
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message || 'Internal Server Error' });
    }
}

async function setActiveShoppingList(req, res) {
    try {
        const { db, user } = await getAuthenticatedUser(req);
        const _id = toObjectId(req.params.id);
        const collection = db.collection(COLLECTION_NAME);
        const list = await collection.findOne({ _id, user_id: user._id.toString() });

        if (!list) {
            return res.status(404).json({ message: 'Shopping list not found' });
        }

        const now = new Date();
        await collection.updateMany(
            { user_id: user._id.toString() },
            { $set: { is_active: false, updated_at: now } }
        );
        await collection.updateOne(
            { _id, user_id: user._id.toString() },
            { $set: { is_active: true, updated_at: now } }
        );

        return res.status(200).json({ activeListId: req.params.id });
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message || 'Internal Server Error' });
    }
}

async function repriceShoppingList(req, res) {
    try {
        const { db, user } = await getAuthenticatedUser(req);
        const _id = toObjectId(req.params.id);
        const list = await db.collection(COLLECTION_NAME).findOne({
            _id,
            user_id: user._id.toString(),
        });

        if (!list) {
            return res.status(404).json({ message: 'Shopping list not found' });
        }

        const selectedRetailer =
            normalizeDashboardRetailer(req.body?.selectedRetailer) ||
            normalizeDashboardRetailer(user?.dashboard_preferences?.selected_dashboard_retailer) ||
            'coles';
        const pricingSummary = await calculateListPricingSnapshot(db, list, selectedRetailer);

        const now = new Date();
        const email = String(user.email || '').trim().toLowerCase();
        const listName = list.list_name || list.name || 'Shopping List';
        const snapshotDocument = applyOwnershipFields(
            {
                shopping_list_id: String(list._id),
                shopping_list_name: listName,
                saved_list_id: String(list._id),
                saved_list_name: listName,
                selected_retailer: pricingSummary.selectedRetailer,
                retailer_totals: pricingSummary.retailerTotals,
                comparison_status: pricingSummary.comparisonStatus,
                comparable_retailer_count: pricingSummary.comparableRetailerCount,
                available_retailers: pricingSummary.availableRetailers,
                cheapest_retailer: pricingSummary.cheapestRetailer,
                cheapest_total: pricingSummary.cheapestTotal,
                highest_retailer: pricingSummary.highestRetailer,
                highest_total: pricingSummary.highestTotal,
                selected_total: pricingSummary.selectedTotal,
                total_saved: pricingSummary.totalSaved,
                savings_rate: pricingSummary.savingsRate,
                comparison_label: pricingSummary.comparisonLabel,
                item_count: pricingSummary.itemCount,
                source: 'shopping_list_pricing',
                createdAt: now,
                updatedAt: now,
            },
            user,
            email
        );

        const insertResult = await db
            .collection('list_pricing_snapshots')
            .insertOne(snapshotDocument);

        await db.collection('users').updateOne(
            { _id: user._id },
            {
                $set: {
                    dashboard_preferences: {
                        selected_dashboard_list_id: String(list._id),
                        selected_dashboard_retailer: pricingSummary.selectedRetailer,
                        updatedAt: now,
                    },
                    shoppingLists: await db.collection(COLLECTION_NAME).countDocuments({
                        user_id: user._id.toString(),
                    }),
                    updatedAt: now,
                },
            }
        );

        return res.status(200).json({
            message: 'Shopping list repriced successfully',
            snapshot: formatSnapshotResponse({
                ...snapshotDocument,
                _id: insertResult.insertedId,
            }),
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || 'Failed to reprice shopping list',
        });
    }
}

module.exports = {
    getShoppingLists,
    createShoppingList,
    updateShoppingList,
    deleteShoppingList,
    setActiveShoppingList,
    repriceShoppingList,
};
