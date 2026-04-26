const axios = require("axios");
const { ObjectId } = require("mongodb");

const CATEGORY_CATALOG = [
    {
        key: "alcohol",
        label: "Alcohol",
        aliases: ["alcohol", "liquor", "beer wine spirits"],
        notificationTitle: "New alcohol deals available",
    },
    {
        key: "baby-food-accessories",
        label: "Baby Food & Accessories",
        aliases: ["baby food & accessories", "baby food", "baby", "baby accessories"],
        notificationTitle: "Fresh baby product deals found",
    },
    {
        key: "bakery",
        label: "Bakery",
        aliases: ["bakery", "bread bakery"],
        notificationTitle: "New bakery deals available",
    },
    {
        key: "beverages",
        label: "Beverages",
        aliases: ["beverages", "beverage", "drinks"],
        notificationTitle: "Fresh beverage specials found",
    },
    {
        key: "continental",
        label: "Continental",
        aliases: ["continental", "continental deli"],
        notificationTitle: "Continental deals are now live",
    },
    {
        key: "convenience-food",
        label: "Convenience Food",
        aliases: ["convenience food", "ready meals", "convenience"],
        notificationTitle: "Convenience food deals available",
    },
    {
        key: "dairy-refrigerated",
        label: "Dairy & Refrigerated",
        aliases: ["dairy & refrigerated", "dairy", "dairy & eggs", "eggs", "milk cheese eggs"],
        notificationTitle: "New dairy deals available",
    },
    {
        key: "deli-chilled-meals",
        label: "Deli & Chilled Meals",
        aliases: ["deli & chilled meals", "deli", "chilled meals", "deli meals"],
        notificationTitle: "Deli and chilled meal deals found",
    },
    {
        key: "frozen-foods",
        label: "Frozen Foods",
        aliases: ["frozen foods", "frozen food", "frozen"],
        notificationTitle: "Frozen food specials are now live",
    },
    {
        key: "fruit-veg-produce",
        label: "Fruit, Veg & Produce",
        aliases: [
            "fruit, veg & produce",
            "fruit veg & produce",
            "fruit & vegetables",
            "fruit and vegetables",
            "fruit & veg",
            "produce",
            "fruit vegetables",
        ],
        notificationTitle: "Fresh specials found in Fruit, Veg & Produce",
    },
    {
        key: "health-beauty",
        label: "Health & Beauty",
        aliases: ["health & beauty", "beauty", "health and beauty"],
        notificationTitle: "Health and beauty deals available",
    },
    {
        key: "health-food-supplements",
        label: "Health Food & Supplements",
        aliases: ["health food & supplements", "health food", "supplements", "health supplements"],
        notificationTitle: "Health food deals found",
    },
    {
        key: "household-items",
        label: "Household Items",
        aliases: ["household items", "household", "cleaning", "laundry"],
        notificationTitle: "Household item deals available",
    },
    {
        key: "miscellaneous",
        label: "Miscellaneous",
        aliases: ["miscellaneous", "other"],
        notificationTitle: "New miscellaneous deals available",
    },
    {
        key: "pantry",
        label: "Pantry",
        aliases: ["pantry", "grocery", "cupboard"],
        notificationTitle: "Pantry deals are now live",
    },
    {
        key: "pet-food-accessories",
        label: "Pet Food & Accessories",
        aliases: ["pet food & accessories", "pet food", "pets", "pet accessories"],
        notificationTitle: "Pet product deals available",
    },
    {
        key: "poultry-meat-seafood",
        label: "Poultry, Meat & Seafood",
        aliases: ["poultry, meat & seafood", "meat & fish", "meat", "seafood", "poultry", "meat seafood"],
        notificationTitle: "Meat and seafood specials found",
    },
    {
        key: "seasonal",
        label: "Seasonal",
        aliases: ["seasonal", "seasonal items"],
        notificationTitle: "Seasonal deals just dropped",
    },
    {
        key: "snacks-confectionary",
        label: "Snacks & Confectionary",
        aliases: ["snacks & confectionary", "snacks", "confectionary", "snacks & confectionery", "confectionery"],
        notificationTitle: "Snack deals available now",
    },
];

const CATEGORY_BY_KEY = CATEGORY_CATALOG.reduce((accumulator, category) => {
    accumulator[category.key] = category;
    return accumulator;
}, {});

function normalizeComparableValue(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getCatalogEntryByKey(categoryKey) {
    return CATEGORY_BY_KEY[String(categoryKey || "").trim()] || null;
}

function findCatalogEntryByName(value) {
    const comparableValue = normalizeComparableValue(value);
    if (!comparableValue) {
        return null;
    }

    return (
        CATEGORY_CATALOG.find((category) =>
            category.aliases.some((alias) => normalizeComparableValue(alias) === comparableValue)
        ) ||
        CATEGORY_CATALOG.find((category) =>
            normalizeComparableValue(category.label) === comparableValue
        ) ||
        CATEGORY_CATALOG.find((category) =>
            category.aliases.some((alias) => comparableValue.includes(normalizeComparableValue(alias)))
        ) ||
        null
    );
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

function applyOwnershipFields(document, user, email) {
    const userId = user?._id ? String(user._id) : null;

    return {
        ...document,
        email,
        user_email: email,
        userId: userId || undefined,
        user_id: userId || undefined,
    };
}

async function getCollectionIfExists(db, name) {
    const exists = await db.listCollections({ name }).hasNext();
    if (!exists) {
        return null;
    }

    return db.collection(name);
}

async function getEnabledSegments(db, user, email) {
    const ownershipFilter = buildOwnershipFilter(user, email);
    const segments = await db
        .collection("alert_segments")
        .find({
            $and: [ownershipFilter, { active: true }],
        })
        .project({ category_key: 1, category_label: 1, active: 1 })
        .toArray();

    return segments
        .map((segment) => {
            const categoryKey = String(segment?.category_key || "").trim();
            const catalogEntry = getCatalogEntryByKey(categoryKey);
            if (!catalogEntry) {
                return null;
            }

            return {
                key: catalogEntry.key,
                label: catalogEntry.label,
            };
        })
        .filter(Boolean);
}

async function fetchPricingCandidates(db) {
    const pricingCollection = await getCollectionIfExists(db, "product_pricings");
    const productsCollection = await getCollectionIfExists(db, "products");
    const categoriesCollection = await getCollectionIfExists(db, "categories");

    if (!pricingCollection || !productsCollection || !categoriesCollection) {
        return [];
    }

    const pricingRows = await pricingCollection
        .aggregate([
            {
                $match: {
                    product_code: { $exists: true, $ne: null },
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
                    _id: "$product_code",
                    latestPricing: { $first: "$$ROOT" },
                },
            },
            {
                $replaceRoot: {
                    newRoot: "$latestPricing",
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
                $limit: 120,
            },
        ])
        .toArray();

    if (pricingRows.length === 0) {
        return [];
    }

    const productCodeValues = pricingRows
        .map((row) => row?.product_code)
        .filter((value) => value !== null && value !== undefined);
    const productCodeStrings = Array.from(
        new Set(productCodeValues.map((value) => String(value)))
    );
    const productCodeNumbers = Array.from(
        new Set(
            productCodeValues
                .map((value) => Number(value))
                .filter((value) => !Number.isNaN(value))
        )
    );

    const products = await productsCollection
        .find({
            $or: [
                { product_code: { $in: productCodeValues } },
                { product_code: { $in: productCodeStrings } },
                { product_code: { $in: productCodeNumbers } },
            ],
        })
        .project({
            product_code: 1,
            product_id: 1,
            product_name: 1,
            category_id: 1,
            category: 1,
            sub_category_1: 1,
            sub_category_2: 1,
        })
        .toArray();

    const productsByCode = new Map();
    products.forEach((product) => {
        const key = String(product?.product_code);
        if (!productsByCode.has(key)) {
            productsByCode.set(key, product);
        }
    });

    const categoryIds = Array.from(
        new Set(
            products
                .map((product) => product?.category_id)
                .filter((value) => value)
                .map((value) => String(value))
        )
    )
        .filter((value) => ObjectId.isValid(value))
        .map((value) => new ObjectId(value));

    const categories = categoryIds.length
        ? await categoriesCollection
            .find({ _id: { $in: categoryIds } })
            .project({ category_name: 1 })
            .toArray()
        : [];

    const categoriesById = new Map();
    categories.forEach((category) => {
        categoriesById.set(String(category._id), category);
    });

    return pricingRows
        .map((pricingRow) => {
            const product = productsByCode.get(String(pricingRow?.product_code));
            if (!product) {
                return null;
            }

            const currentPrice = Number(pricingRow?.price || 0);
            const bestPrice = Number(pricingRow?.best_price || 0);
            const hasDiscount =
                !Number.isNaN(currentPrice) &&
                !Number.isNaN(bestPrice) &&
                currentPrice > 0 &&
                bestPrice > currentPrice;
            const isOnSpecial = pricingRow?.is_on_special === true;

            if (!isOnSpecial && !hasDiscount) {
                return null;
            }

            const categoryName =
                categoriesById.get(String(product?.category_id))?.category_name ||
                product?.category ||
                product?.sub_category_1 ||
                product?.sub_category_2 ||
                "";

            const catalogEntry = findCatalogEntryByName(categoryName);
            if (!catalogEntry) {
                return null;
            }

            return {
                categoryKey: catalogEntry.key,
                categoryLabel: catalogEntry.label,
                productCode: String(product?.product_code || ""),
                productId: String(product?.product_id || product?.product_code || ""),
                productName: String(product?.product_name || "DiscountMate product"),
                source: "pricing",
                eventDate:
                    pricingRow?.date ||
                    pricingRow?.created_at ||
                    new Date().toISOString(),
            };
        })
        .filter(Boolean);
}

async function fetchMlCandidates() {
    const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";

    try {
        const response = await axios.get(`${ML_SERVICE_URL}/api/weekly-specials`, {
            params: { limit: 100 },
            timeout: 8000,
        });

        if (!response?.data?.success || !Array.isArray(response.data.data)) {
            return [];
        }

        return response.data.data
            .map((item) => {
                const catalogEntry = findCatalogEntryByName(item?.category);
                if (!catalogEntry) {
                    return null;
                }

                return {
                    categoryKey: catalogEntry.key,
                    categoryLabel: catalogEntry.label,
                    productCode: String(item?.product_id || item?.id || item?.product_name || ""),
                    productId: String(item?.product_id || item?.id || item?.product_name || ""),
                    productName: String(item?.product_name || "DiscountMate special"),
                    source: "ml",
                    eventDate: item?.week || new Date().toISOString(),
                };
            })
            .filter(Boolean);
    } catch (error) {
        return [];
    }
}

function buildCategoryNotificationMessage(label, items) {
    const previewNames = Array.from(new Set(items.map((item) => item.productName))).slice(0, 3);

    if (previewNames.length === 0) {
        return `We found fresh discounted items in ${label}.`;
    }

    if (previewNames.length === 1) {
        return `We found a fresh deal in ${label}: ${previewNames[0]}.`;
    }

    if (previewNames.length === 2) {
        return `We found fresh deals in ${label}, including ${previewNames[0]} and ${previewNames[1]}.`;
    }

    return `We found fresh deals in ${label}, including ${previewNames[0]}, ${previewNames[1]}, and ${previewNames[2]}.`;
}

function buildCandidateBuckets(enabledSegments, pricingCandidates, mlCandidates) {
    const enabledKeys = new Set(enabledSegments.map((segment) => segment.key));
    const buckets = new Map();

    [...pricingCandidates, ...mlCandidates].forEach((candidate) => {
        if (!candidate || !enabledKeys.has(candidate.categoryKey)) {
            return;
        }

        if (!buckets.has(candidate.categoryKey)) {
            buckets.set(candidate.categoryKey, []);
        }

        buckets.get(candidate.categoryKey).push(candidate);
    });

    return buckets;
}

async function syncCategoryAlertNotifications(db, user, email) {
    const notificationPreferences = user?.notification_preferences?.alert_types || {};
    const browserNotificationsEnabled =
        notificationPreferences.in_browser_notifications !== false &&
        notificationPreferences.inBrowserNotifications !== false &&
        notificationPreferences.browserNotifications !== false;
    const priceAlertsEnabled =
        notificationPreferences.price_alerts !== false &&
        notificationPreferences.priceAlerts !== false;

    if (!browserNotificationsEnabled || !priceAlertsEnabled) {
        return { insertedCount: 0 };
    }

    const activeSegments = await getEnabledSegments(db, user, email);
    if (activeSegments.length === 0) {
        return { insertedCount: 0 };
    }

    const [pricingCandidates, mlCandidates] = await Promise.all([
        fetchPricingCandidates(db),
        fetchMlCandidates(),
    ]);

    const buckets = buildCandidateBuckets(activeSegments, pricingCandidates, mlCandidates);
    const notificationsCol = db.collection("notifications");
    const ownershipFilter = buildOwnershipFilter(user, email);
    let insertedCount = 0;

    for (const activeSegment of activeSegments) {
        const items = buckets.get(activeSegment.key) || [];
        if (items.length === 0) {
            continue;
        }

        const uniqueSignature = Array.from(
            new Set(
                items
                    .map((item) => `${item.source}:${item.productId}`)
                    .filter(Boolean)
            )
        )
            .sort()
            .slice(0, 8)
            .join("|");

        const dealKey = `category:${activeSegment.key}:${uniqueSignature}`;
        if (!uniqueSignature) {
            continue;
        }

        const existing = await notificationsCol.findOne({
            $and: [
                ownershipFilter,
                {
                    type: "category_alert",
                    category_key: activeSegment.key,
                    deal_key: dealKey,
                },
            ],
        });

        if (existing) {
            continue;
        }

        const catalogEntry = getCatalogEntryByKey(activeSegment.key);
        await notificationsCol.insertOne(
            applyOwnershipFields(
                {
                    type: "category_alert",
                    title: catalogEntry?.notificationTitle || `New deals in ${activeSegment.label}`,
                    message: buildCategoryNotificationMessage(activeSegment.label, items),
                    read: false,
                    category_key: activeSegment.key,
                    category_label: activeSegment.label,
                    related_product_ids: items.map((item) => item.productId).filter(Boolean),
                    source_types: Array.from(new Set(items.map((item) => item.source))),
                    cta_route: "/(tabs)/alert-segments",
                    deal_key: dealKey,
                    created_at: new Date(),
                    updated_at: new Date(),
                },
                user,
                email
            )
        );
        insertedCount += 1;
    }

    return { insertedCount };
}

async function getTriggeredCountsByCategory(db, user, email) {
    const notificationsCollection = await getCollectionIfExists(db, "notifications");
    if (!notificationsCollection) {
        return new Map();
    }

    const ownershipFilter = buildOwnershipFilter(user, email);
    const rows = await notificationsCollection
        .aggregate([
            {
                $match: {
                    $and: [
                        ownershipFilter,
                        { type: "category_alert" },
                        { read: { $ne: true } },
                        { category_key: { $exists: true, $ne: null } },
                    ],
                },
            },
            {
                $group: {
                    _id: "$category_key",
                    count: { $sum: 1 },
                },
            },
        ])
        .toArray();

    const counts = new Map();
    rows.forEach((row) => {
        counts.set(String(row._id), Number(row.count || 0));
    });
    return counts;
}

module.exports = {
    CATEGORY_CATALOG,
    getCatalogEntryByKey,
    findCatalogEntryByName,
    buildOwnershipFilter,
    syncCategoryAlertNotifications,
    getTriggeredCountsByCategory,
};
