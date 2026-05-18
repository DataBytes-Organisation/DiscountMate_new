const { ObjectId } = require('mongodb');

const DASHBOARD_RETAILERS = {
    aldi: 'ALDI',
    coles: 'Coles',
    woolworths: 'Woolworths',
    iga: 'IGA',
};

const DASHBOARD_COMPARISON_STATUS = {
    comparable: 'comparable',
    singleRetailer: 'single_retailer',
    noPricing: 'no_pricing',
    unpriceable: 'unpriceable',
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

function getShoppingListTotal(list) {
    const explicitTotal = Number(list?.total);
    if (Number.isFinite(explicitTotal) && explicitTotal >= 0) {
        return roundCurrency(explicitTotal);
    }

    if (!Array.isArray(list?.items)) {
        return 0;
    }

    return roundCurrency(
        list.items.reduce((sum, item) => {
            const quantity = Math.max(1, Number(item?.quantity || 1));
            const price = Number(item?.price || item?.unit_price || 0);
            return sum + (Number.isFinite(price) ? price * quantity : 0);
        }, 0)
    );
}

function formatSavedListSummary(list) {
    return {
        id: String(list?._id || ''),
        name: String(list?.list_name || list?.name || 'Saved List'),
        itemCount: Array.isArray(list?.items)
            ? list.items.reduce((total, item) => total + Math.max(1, Number(item?.quantity || 1)), 0)
            : 0,
        updatedAt: list?.updated_at || list?.updatedAt || list?.created_at || list?.createdAt || new Date().toISOString(),
    };
}

async function getSavedListsForUser(db, user, email) {
    const lists = await db
        .collection('shopping_lists')
        .find({ user_id: String(user._id) })
        .sort({ is_active: -1, updated_at: -1, created_at: -1, _id: -1 })
        .toArray();

    return lists;
}

async function getSavedListById(db, user, email, listId) {
    if (!listId || !ObjectId.isValid(String(listId))) {
        return null;
    }

    return db.collection('shopping_lists').findOne({
        _id: new ObjectId(String(listId)),
        user_id: String(user._id),
    });
}

function getListItemIdentifier(item) {
    return String(
        item?.product_id ||
        item?.productId ||
        item?.product_code ||
        item?.productCode ||
        item?.id ||
        ''
    ).trim();
}

async function resolveProductsForListItems(db, items) {
    const productsCollection = db.collection('products');
    const resolvedItems = [];

    for (const item of items || []) {
        const productIdentifier = getListItemIdentifier(item);
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
            selectedRetailer: normalizeDashboardRetailer(item?.store),
            selectedUnitPrice: Number(item?.price || item?.unit_price || 0),
            fallbackRetailerPrices:
                item?.retailerPrices && typeof item.retailerPrices === 'object'
                    ? item.retailerPrices
                    : null,
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
            const price =
                rowsByCode.get(String(item.productCode))?.[retailerKey] ||
                Number(item.fallbackRetailerPrices?.[retailerKey] || 0);
            if (typeof price === 'number' && price > 0) {
                total += price * item.quantity;
                coveredItems += 1;
            }
        });

        if (resolvedItems.length > 0 && coveredItems === resolvedItems.length) {
            retailerTotals[retailerKey] = roundCurrency(total);
        }
    });

    return retailerTotals;
}

function buildPricingRowsByCode(pricingRows) {
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

    return rowsByCode;
}

function buildItemPriceMap(item, rowsByCode) {
    const codeKey = String(item?.productCode || '');
    const dbPrices = rowsByCode.get(codeKey) || {};
    const fallbackPrices =
        item?.fallbackRetailerPrices && typeof item.fallbackRetailerPrices === 'object'
            ? item.fallbackRetailerPrices
            : {};
    const priceMap = {};

    Object.keys(DASHBOARD_RETAILERS).forEach((retailerKey) => {
        const databasePrice = Number(dbPrices?.[retailerKey] || 0);
        const fallbackPrice = Number(fallbackPrices?.[retailerKey] || 0);
        const effectivePrice = databasePrice > 0 ? databasePrice : fallbackPrice;

        if (effectivePrice > 0) {
            priceMap[retailerKey] = effectivePrice;
        }
    });

    if (
        item?.selectedRetailer &&
        Number(item?.selectedUnitPrice || 0) > 0 &&
        !priceMap[item.selectedRetailer]
    ) {
        priceMap[item.selectedRetailer] = Number(item.selectedUnitPrice);
    }

    return priceMap;
}

function inferSnapshotComparisonStatus(snapshot) {
    const explicitStatus = String(snapshot?.comparison_status || '').trim();
    if (
        explicitStatus === DASHBOARD_COMPARISON_STATUS.comparable ||
        explicitStatus === DASHBOARD_COMPARISON_STATUS.singleRetailer ||
        explicitStatus === DASHBOARD_COMPARISON_STATUS.noPricing ||
        explicitStatus === DASHBOARD_COMPARISON_STATUS.unpriceable
    ) {
        return explicitStatus;
    }

    const availableRetailers = Object.keys(snapshot?.retailer_totals || {});
    const comparableRetailerCount = Number(
        snapshot?.comparable_retailer_count || availableRetailers.length || 0
    );

    if (comparableRetailerCount >= 2) {
        return DASHBOARD_COMPARISON_STATUS.comparable;
    }
    if (comparableRetailerCount === 1) {
        return DASHBOARD_COMPARISON_STATUS.singleRetailer;
    }

    const itemCount = Number(snapshot?.item_count || 0);
    return itemCount > 0
        ? DASHBOARD_COMPARISON_STATUS.noPricing
        : DASHBOARD_COMPARISON_STATUS.unpriceable;
}

function getSnapshotRetailerTotal(snapshot, retailerKey) {
    if (!retailerKey) {
        return 0;
    }

    const explicitTotal =
        retailerKey === snapshot?.cheapest_retailer
            ? snapshot?.cheapest_total
            : retailerKey === snapshot?.highest_retailer
                ? snapshot?.highest_total
                : undefined;
    const normalizedExplicitTotal = Number(explicitTotal || 0);
    if (normalizedExplicitTotal > 0) {
        return normalizedExplicitTotal;
    }

    return Number(snapshot?.retailer_totals?.[retailerKey] || 0);
}

async function calculateListPricingSnapshot(db, list, selectedRetailer) {
    const listTotal = getShoppingListTotal(list);
    const resolvedItems = await resolveProductsForListItems(db, list?.items || []);
    const preferredRetailer = normalizeDashboardRetailer(selectedRetailer);

    if (!resolvedItems.length) {
        return {
            selectedRetailer: preferredRetailer || 'coles',
            retailerTotals: {},
            availableRetailers: [],
            comparableRetailerCount: 0,
            comparisonStatus: DASHBOARD_COMPARISON_STATUS.unpriceable,
            cheapestRetailer: null,
            cheapestTotal: 0,
            highestRetailer: null,
            highestTotal: 0,
            selectedTotal: roundCurrency(listTotal),
            totalSaved: 0,
            savingsRate: 0,
            comparisonLabel: 'Comparison unavailable',
            itemCount: 0,
        };
    }

    const pricingRows = await fetchLatestPricingRows(
        db,
        resolvedItems.map((item) => item.productCode)
    );
    const rowsByCode = buildPricingRowsByCode(pricingRows);
    const retailerTotals = buildRetailerTotals(resolvedItems, pricingRows);
    const availableRetailers = Object.keys(retailerTotals);
    const comparableRetailerCount = availableRetailers.length;
    const effectiveRetailer = retailerTotals[preferredRetailer]
        ? preferredRetailer
        : preferredRetailer ||
          (availableRetailers.includes('coles')
              ? 'coles'
              : availableRetailers[0] || 'coles');

    const selectedTotal = listTotal;
    let itemLevelHighestTotal = 0;
    let itemLevelLowestTotal = 0;
    let comparableItems = 0;
    const unionRetailers = new Set();

    resolvedItems.forEach((item) => {
        const itemPriceMap = buildItemPriceMap(item, rowsByCode);
        const itemPrices = Object.values(itemPriceMap).filter(
            (price) => typeof price === 'number' && Number.isFinite(price) && price > 0
        );

        if (!itemPrices.length) {
            const selectedUnitPrice = Number(item?.selectedUnitPrice || 0);
            if (selectedUnitPrice > 0) {
                itemLevelHighestTotal += selectedUnitPrice * item.quantity;
                itemLevelLowestTotal += selectedUnitPrice * item.quantity;
            }
            return;
        }

        Object.keys(itemPriceMap).forEach((retailerKey) => unionRetailers.add(retailerKey));
        itemLevelHighestTotal += Math.max(...itemPrices) * item.quantity;
        itemLevelLowestTotal += Math.min(...itemPrices) * item.quantity;

        if (itemPrices.length >= 2) {
            comparableItems += 1;
        }
    });

    const comparisonStatus =
        comparableItems > 0
            ? DASHBOARD_COMPARISON_STATUS.comparable
            : unionRetailers.size > 0 || availableRetailers.length > 0
                ? DASHBOARD_COMPARISON_STATUS.singleRetailer
                : DASHBOARD_COMPARISON_STATUS.noPricing;
    const cheapestRetailer = null;
    const highestRetailer = null;
    const cheapestTotal =
        comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
            ? roundCurrency(itemLevelLowestTotal)
            : 0;
    const highestTotal =
        comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
            ? roundCurrency(itemLevelHighestTotal)
            : 0;
    const totalSaved =
        comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
            ? Math.max(0, roundCurrency(highestTotal - selectedTotal))
            : 0;
    const savingsRate =
        comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable && highestTotal > 0
            ? Number(((totalSaved / highestTotal) * 100).toFixed(2))
            : 0;

    return {
        selectedRetailer: effectiveRetailer,
        retailerTotals,
        availableRetailers:
            comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
                ? Array.from(unionRetailers)
                : availableRetailers,
        comparableRetailerCount:
            comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
                ? comparableItems
                : comparableRetailerCount,
        comparisonStatus,
        cheapestRetailer,
        cheapestTotal: roundCurrency(cheapestTotal),
        highestRetailer,
        highestTotal: roundCurrency(highestTotal),
        selectedTotal: roundCurrency(selectedTotal),
        totalSaved,
        savingsRate,
        comparisonLabel:
            comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
                ? 'Current selection vs highest available prices'
                : 'Comparison unavailable',
        itemCount: resolvedItems.reduce((total, item) => total + item.quantity, 0),
    };
}

function formatSnapshotResponse(snapshot) {
    const listId = String(snapshot?.shopping_list_id || snapshot?.saved_list_id || '');
    const comparisonStatus = inferSnapshotComparisonStatus(snapshot);
    const availableRetailers = Array.isArray(snapshot?.available_retailers)
        ? snapshot.available_retailers.map((value) => String(value))
        : Object.keys(snapshot?.retailer_totals || {});

    return {
        id: String(snapshot?._id || ''),
        savedListId: listId,
        selectedRetailer: snapshot?.selected_retailer || null,
        retailerTotals: snapshot?.retailer_totals || {},
        comparisonStatus,
        comparableRetailerCount: Number(
            snapshot?.comparable_retailer_count || availableRetailers.length || 0
        ),
        availableRetailers,
        cheapestRetailer:
            comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
                ? snapshot?.cheapest_retailer || null
                : null,
        cheapestTotal:
            comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
                ? getSnapshotRetailerTotal(
                      snapshot,
                      snapshot?.cheapest_retailer || null
                  )
                : 0,
        highestRetailer:
            comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
                ? snapshot?.highest_retailer || null
                : null,
        highestTotal:
            comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
                ? getSnapshotRetailerTotal(
                      snapshot,
                      snapshot?.highest_retailer || null
                  )
                : 0,
        selectedTotal: Number(snapshot?.selected_total || 0),
        totalSaved:
            comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
                ? Number(
                      snapshot?.total_saved ||
                          Math.max(
                              0,
                              getSnapshotRetailerTotal(
                                  snapshot,
                                  snapshot?.highest_retailer || null
                              ) -
                                  getSnapshotRetailerTotal(
                                      snapshot,
                                      snapshot?.cheapest_retailer || null
                                  )
                          )
                  )
                : 0,
        savingsRate: Number(snapshot?.savings_rate || 0),
        comparisonLabel:
            comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
                ? snapshot?.comparison_label || 'Cheapest vs highest retailer'
                : 'Comparison unavailable',
        itemCount: Number(snapshot?.item_count || 0),
        createdAt: snapshot?.createdAt || snapshot?.created_at || new Date().toISOString(),
    };
}

module.exports = {
    DASHBOARD_RETAILERS,
    normalizeDashboardRetailer,
    buildOwnershipFilter,
    applyOwnershipFields,
    getSavedListsForUser,
    getSavedListById,
    getShoppingListTotal,
    formatSavedListSummary,
    calculateListPricingSnapshot,
    formatSnapshotResponse,
    inferSnapshotComparisonStatus,
    DASHBOARD_COMPARISON_STATUS,
};
