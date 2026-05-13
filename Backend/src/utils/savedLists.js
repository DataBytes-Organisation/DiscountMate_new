const { ObjectId } = require('mongodb');

const DASHBOARD_RETAILERS = {
    aldi: 'ALDI',
    coles: 'Coles',
    woolworths: 'Woolworths',
    iga: 'IGA',
};

function normalizeDashboardRetailer(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z]/g, '');

    if (normalized === 'aldi' || normalized.startsWith('aldi')) {
        return 'aldi';
    }
    if (normalized === 'coles' || normalized.startsWith('coles')) {
        return 'coles';
    }
    if (
        normalized === 'woolworths' ||
        normalized === 'woolworth' ||
        normalized.startsWith('woolworths') ||
        normalized.startsWith('woolworth')
    ) {
        return 'woolworths';
    }
    if (normalized === 'iga' || normalized.startsWith('iga')) {
        return 'iga';
    }

    return null;
}

function buildOwnershipFilter(user, email) {
    const userId = user?._id ? String(user._id) : null;
    const filters = [{ email }, { user_email: email }, { userEmail: email }];

    if (userId) {
        filters.push({ user_id: userId }, { userId: userId });

        if (ObjectId.isValid(userId)) {
            const objectId = new ObjectId(userId);
            filters.push({ user_id: objectId }, { userId: objectId });
        }
    }

    return { $or: filters };
}

function applyOwnershipFields(data, user, email) {
    return {
        ...data,
        email,
        user_email: email,
        userEmail: email,
        user_id: user?._id ? String(user._id) : undefined,
        userId: user?._id ? String(user._id) : undefined,
    };
}

function roundCurrency(value) {
    return Number(Number(value || 0).toFixed(2));
}

function getNumberValue(record, keys) {
    for (const key of keys) {
        const value = record?.[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
            return Number(value);
        }
    }

    return 0;
}

async function getBasketListItems(db, user) {
    const basketRows = await db
        .collection('basket')
        .find({ user_id: String(user._id) })
        .toArray();

    if (!basketRows.length) {
        return [];
    }

    const groupedItems = new Map();
    basketRows.forEach((row) => {
        const productId = String(row?.product_id || '').trim();
        if (!productId) {
            return;
        }

        const quantity = Math.max(1, Number(row?.quantity || 1));
        groupedItems.set(productId, (groupedItems.get(productId) || 0) + quantity);
    });

    if (groupedItems.size === 0) {
        return [];
    }

    return Array.from(groupedItems.entries()).map(([product_id, quantity]) => ({
        product_id,
        quantity,
    }));
}

async function ensureBootstrapSavedList(db, user, email) {
    const listsCollection = db.collection('saved_lists');
    const ownershipFilter = buildOwnershipFilter(user, email);
    const basketItems = await getBasketListItems(db, user);

    if (!basketItems.length) {
        return;
    }

    const now = new Date();
    const basketListFilter = {
        $and: [
            ownershipFilter,
            { source: 'basket_import' },
        ],
    };
    const existingBasketList = await listsCollection.findOne(basketListFilter);

    if (existingBasketList) {
        await listsCollection.updateOne(
            { _id: existingBasketList._id },
            {
                $set: {
                    items: basketItems,
                    updatedAt: now,
                },
            }
        );
        return;
    }

    await listsCollection.insertOne(
        applyOwnershipFields(
            {
                name: 'My Grocery List',
                source: 'basket_import',
                items: basketItems,
                createdAt: now,
                updatedAt: now,
            },
            user,
            email
        )
    );
}

function formatSavedListSummary(list) {
    return {
        id: String(list?._id || ''),
        name: String(list?.name || 'Saved List'),
        itemCount: Array.isArray(list?.items)
            ? list.items.reduce((total, item) => total + Math.max(1, Number(item?.quantity || 1)), 0)
            : 0,
        updatedAt: list?.updatedAt || list?.createdAt || new Date().toISOString(),
    };
}

async function getSavedListsForUser(db, user, email) {
    await ensureBootstrapSavedList(db, user, email);

    const ownershipFilter = buildOwnershipFilter(user, email);
    const lists = await db
        .collection('saved_lists')
        .find(ownershipFilter)
        .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
        .toArray();

    return lists;
}

async function getSavedListById(db, user, email, listId) {
    if (!listId || !ObjectId.isValid(String(listId))) {
        return null;
    }

    const ownershipFilter = buildOwnershipFilter(user, email);
    return db.collection('saved_lists').findOne({
        $and: [
            ownershipFilter,
            {
                _id: new ObjectId(String(listId)),
            },
        ],
    });
}

async function resolveProductsForListItems(db, items) {
    const productsCollection = db.collection('products');
    const resolvedItems = [];

    for (const item of items || []) {
        const productIdentifier = String(item?.product_id || '').trim();
        const quantity = Math.max(1, Number(item?.quantity || 1));

        if (!productIdentifier) {
            continue;
        }

        const query = {
            $or: [
                { product_id: productIdentifier },
                { product_code: productIdentifier },
            ],
        };

        const numberIdentifier = Number(productIdentifier);
        if (!Number.isNaN(numberIdentifier)) {
            query.$or.push({ product_code: numberIdentifier });
        }
        if (ObjectId.isValid(productIdentifier)) {
            query.$or.push({ _id: new ObjectId(productIdentifier) });
        }

        const product = await productsCollection.findOne(query, {
            projection: {
                product_id: 1,
                product_code: 1,
                product_name: 1,
                brand: 1,
                category: 1,
                sub_category_1: 1,
                sub_category_2: 1,
            },
        });

        if (!product || product?.product_code === null || product?.product_code === undefined) {
            continue;
        }

        resolvedItems.push({
            productId: String(product?.product_id || productIdentifier),
            productCode: product.product_code,
            productName: String(product?.product_name || 'DiscountMate product'),
            brand: String(product?.brand || ''),
            category:
                String(
                    product?.category ||
                        product?.sub_category_1 ||
                        product?.sub_category_2 ||
                        ''
                ),
            quantity,
        });
    }

    return resolvedItems;
}

async function fetchLatestPricingRows(db, productCodes) {
    const pricingCollection = db.collection('product_pricings');
    const stringCodes = Array.from(new Set(productCodes.map((value) => String(value))));
    const numericCodes = Array.from(
        new Set(
            productCodes
                .map((value) => Number(value))
                .filter((value) => !Number.isNaN(value))
        )
    );

    const matchOr = [];
    if (stringCodes.length) {
        matchOr.push({ product_code: { $in: stringCodes } });
    }
    if (numericCodes.length) {
        matchOr.push({ product_code: { $in: numericCodes } });
    }

    if (!matchOr.length) {
        return [];
    }

    return pricingCollection
        .aggregate([
            {
                $match: {
                    $or: matchOr,
                },
            },
            {
                $sort: {
                    date: -1,
                    created_at: -1,
                    _id: -1,
                },
            },
            {
                $group: {
                    _id: {
                        product_code: '$product_code',
                        store_chain: '$store_chain',
                    },
                    latest: { $first: '$$ROOT' },
                },
            },
            {
                $replaceRoot: {
                    newRoot: '$latest',
                },
            },
        ], { allowDiskUse: true })
        .toArray();
}

function buildRetailerTotals(resolvedItems, pricingRows) {
    const rowsByCode = new Map();

    pricingRows.forEach((row) => {
        const codeKey = String(row?.product_code);
        const retailerKey = normalizeDashboardRetailer(row?.store_chain || row?.retailer);
        const price = getNumberValue(row, ['price', 'current_price', 'best_price']);

        if (!retailerKey || price <= 0) {
            return;
        }

        if (!rowsByCode.has(codeKey)) {
            rowsByCode.set(codeKey, {});
        }

        rowsByCode.get(codeKey)[retailerKey] = price;
    });

    const retailerTotals = {};

    Object.keys(DASHBOARD_RETAILERS).forEach((retailerKey) => {
        let total = 0;
        let coveredItems = 0;

        resolvedItems.forEach((item) => {
            const price = rowsByCode.get(String(item.productCode))?.[retailerKey];
            if (typeof price === 'number' && price > 0) {
                total += price * item.quantity;
                coveredItems += 1;
            }
        });

        if (coveredItems > 0) {
            retailerTotals[retailerKey] = roundCurrency(total);
        }
    });

    return retailerTotals;
}

async function calculateListPricingSnapshot(db, list, selectedRetailer) {
    const resolvedItems = await resolveProductsForListItems(db, list?.items || []);

    if (!resolvedItems.length) {
        return {
            error: 'This saved list does not have any priceable products yet.',
        };
    }

    const pricingRows = await fetchLatestPricingRows(
        db,
        resolvedItems.map((item) => item.productCode)
    );
    const retailerTotals = buildRetailerTotals(resolvedItems, pricingRows);
    const availableRetailers = Object.keys(retailerTotals);

    if (!availableRetailers.length) {
        return {
            error: 'No complete retailer pricing is available for this saved list yet.',
        };
    }

    const preferredRetailer = normalizeDashboardRetailer(selectedRetailer);
    const effectiveRetailer = retailerTotals[preferredRetailer]
        ? preferredRetailer
        : availableRetailers.includes('coles')
            ? 'coles'
            : availableRetailers[0];

    const sortedRetailers = availableRetailers
        .map((key) => ({
            key,
            total: retailerTotals[key],
        }))
        .sort((a, b) => a.total - b.total);

    const cheapestRetailer = sortedRetailers[0]?.key || effectiveRetailer;
    const cheapestTotal = retailerTotals[cheapestRetailer] || 0;
    const selectedTotal = retailerTotals[effectiveRetailer] || 0;
    const totalSaved = Math.max(0, roundCurrency(selectedTotal - cheapestTotal));
    const savingsRate =
        selectedTotal > 0
            ? Number(((totalSaved / selectedTotal) * 100).toFixed(2))
            : 0;

    return {
        selectedRetailer: effectiveRetailer,
        retailerTotals,
        cheapestRetailer,
        cheapestTotal: roundCurrency(cheapestTotal),
        selectedTotal: roundCurrency(selectedTotal),
        totalSaved,
        savingsRate,
        itemCount: resolvedItems.reduce((total, item) => total + item.quantity, 0),
    };
}

function formatSnapshotResponse(snapshot) {
    return {
        id: String(snapshot?._id || ''),
        savedListId: String(snapshot?.saved_list_id || ''),
        selectedRetailer: snapshot?.selected_retailer || null,
        retailerTotals: snapshot?.retailer_totals || {},
        cheapestRetailer: snapshot?.cheapest_retailer || null,
        cheapestTotal: Number(snapshot?.cheapest_total || 0),
        selectedTotal: Number(snapshot?.selected_total || 0),
        totalSaved: Number(snapshot?.total_saved || 0),
        savingsRate: Number(snapshot?.savings_rate || 0),
        itemCount: Number(snapshot?.item_count || 0),
        createdAt: snapshot?.createdAt || snapshot?.created_at || new Date().toISOString(),
    };
}

module.exports = {
    DASHBOARD_RETAILERS,
    normalizeDashboardRetailer,
    buildOwnershipFilter,
    applyOwnershipFields,
    ensureBootstrapSavedList,
    getSavedListsForUser,
    getSavedListById,
    formatSavedListSummary,
    calculateListPricingSnapshot,
    formatSnapshotResponse,
};
