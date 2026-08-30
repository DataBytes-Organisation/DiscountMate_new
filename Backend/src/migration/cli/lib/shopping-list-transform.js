const {
  checksumDocument,
  jsonSafe,
} = require('./user-transform');

const {
  RETAILER_KEYS,
  normalizeRetailerKey,
} = require('../../shared/retailer-identity');

const ACCENTS = new Set(['emerald', 'amber', 'sky', 'violet', 'rose']);
const COMPARISON_STATUSES = new Set([
  'comparable',
  'single_retailer',
  'no_pricing',
  'unpriceable',
]);

function cleanString(value, fallback = null) {
  if (value === undefined || value === null) return fallback;

  const cleaned = String(value).trim();

  return cleaned || fallback;
}

function getSourceId(document) {
  return cleanString(document?._id, '');
}

function toDate(value, fallback = null) {
  if (!value) return fallback;

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? fallback : date;
}

function resolveCreatedAt(document, fallback = new Date()) {
  const objectIdTimestamp = document?._id && typeof document._id.getTimestamp === 'function'
    ? document._id.getTimestamp()
    : null;

  return toDate(document?.created_at || document?.createdAt || objectIdTimestamp, fallback);
}

function finiteNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;

  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function nonNegativeMoney(value, fallback = 0) {
  return Number(Math.max(0, finiteNumber(value, fallback)).toFixed(2));
}

function nonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.floor(finiteNumber(value, fallback)));
}

function normalizeRetailerPrices(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    RETAILER_KEYS.flatMap((retailerKey) => {
      const price = finiteNumber(value[retailerKey], 0);

      return price > 0 ? [[retailerKey, Number(price.toFixed(2))]] : [];
    }),
  );
}

function transformListItem(item, listSourceId, index) {
  const sourceIdentifier = cleanString(
    item?.id
      ?? item?.product_id
      ?? item?.productId
      ?? item?.product_code
      ?? item?.productCode,
  );

  const legacyProductIdentifier = sourceIdentifier
    || `mongodb:shopping_lists:${listSourceId}:item:${index}`;

  return {
    item: {
      lineNumber: index + 1,
      legacyProductIdentifier,
      productName: cleanString(item?.name ?? item?.product_name, 'Unnamed product'),
      quantity: Math.max(1, Math.floor(finiteNumber(item?.quantity, 1))),
      unitPrice: nonNegativeMoney(item?.price ?? item?.unit_price),
      selectedRetailerKey: normalizeRetailerKey(item?.store),
      imageUrl: cleanString(item?.image ?? item?.link_image),
      legacyCategoryIdentifier: cleanString(item?.categoryId ?? item?.category_id),
      categoryName: cleanString(item?.category ?? item?.category_name),
      retailerPrices: normalizeRetailerPrices(item?.retailerPrices),
      rawPayload: jsonSafe(item),
    },
    warning: sourceIdentifier
      ? null
      : {
        reason: 'list_item_missing_product_identifier',
        detail: { itemIndex: index },
      },
  };
}

function transformShoppingListDocument(document, activeSourceId = null, fallbackNow = new Date()) {
  const sourceId = getSourceId(document);
  const ownerSourceId = cleanString(document?.user_id ?? document?.userId, '');
  const errors = [];
  const warnings = [];

  if (!sourceId) errors.push('missing_mongo_id');
  if (!ownerSourceId) errors.push('missing_user_owner');

  if (errors.length) {
    return { valid: false, sourceId, ownerSourceId, errors, warnings };
  }

  const items = (Array.isArray(document?.items) ? document.items : []).map((item, index) => {
    const transformed = transformListItem(item, sourceId, index);
    if (transformed.warning) warnings.push(transformed.warning);

    return transformed.item;
  });

  const calculatedTotal = items.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0,
  );

  const createdAt = resolveCreatedAt(document, fallbackNow);
  const updatedAt = toDate(document?.updated_at || document?.updatedAt, createdAt);

  return {
    valid: true,
    sourceId,
    ownerSourceId,
    sourceChecksum: checksumDocument(document),
    errors,
    warnings,
    list: {
      name: cleanString(document?.list_name ?? document?.name, 'Untitled list'),
      description: cleanString(document?.description, ''),
      accent: ACCENTS.has(document?.accent) ? document.accent : 'emerald',
      isActive: Boolean(activeSourceId && activeSourceId === sourceId),
      total: nonNegativeMoney(document?.total, calculatedTotal),
      savings: nonNegativeMoney(document?.savings),
      createdAt,
      updatedAt,
    },
    items,
  };
}

function normalizeComparisonStatus(document, availableRetailers) {
  const explicit = cleanString(document?.comparison_status, '');
  if (COMPARISON_STATUSES.has(explicit)) return explicit;

  const comparableCount = nonNegativeInteger(
    document?.comparable_retailer_count,
    availableRetailers.length,
  );
  if (comparableCount >= 2) return 'comparable';
  if (comparableCount === 1 || availableRetailers.length === 1) return 'single_retailer';

  return nonNegativeInteger(document?.item_count) > 0 ? 'no_pricing' : 'unpriceable';
}

function transformPricingSnapshotDocument(document, fallbackNow = new Date()) {
  const sourceId = getSourceId(document);
  const listSourceId = cleanString(
    document?.shopping_list_id ?? document?.saved_list_id,
    '',
  );

  const ownerSourceId = cleanString(document?.user_id ?? document?.userId, '');
  const ownerEmail = cleanString(
    document?.email ?? document?.user_email ?? document?.userEmail,
    '',
  ).toLowerCase();

  const errors = [];

  if (!sourceId) errors.push('missing_mongo_id');
  if (!listSourceId) errors.push('missing_shopping_list_reference');
  if (!ownerSourceId && !ownerEmail) errors.push('missing_user_owner');

  if (errors.length) {
    return {
      valid: false,
      sourceId,
      listSourceId,
      ownerSourceId,
      ownerEmail,
      errors,
      warnings: [],
    };
  }

  const retailerTotals = normalizeRetailerPrices(document?.retailer_totals);
  const explicitAvailable = Array.isArray(document?.available_retailers)
    ? document.available_retailers.map(normalizeRetailerKey).filter(Boolean)
    : [];

  const availableRetailers = Array.from(new Set([
    ...explicitAvailable,
    ...Object.keys(retailerTotals),
  ]));

  const selectedRetailerKey = normalizeRetailerKey(document?.selected_retailer);
  const cheapestRetailerKey = normalizeRetailerKey(document?.cheapest_retailer);
  const highestRetailerKey = normalizeRetailerKey(document?.highest_retailer);
  const comparisonStatus = normalizeComparisonStatus(document, availableRetailers);
  const createdAt = resolveCreatedAt(document, fallbackNow);
  const updatedAt = toDate(document?.updatedAt || document?.updated_at, createdAt);

  return {
    valid: true,
    sourceId,
    listSourceId,
    ownerSourceId,
    ownerEmail,
    sourceChecksum: checksumDocument(document),
    errors,
    warnings: [],
    snapshot: {
      listName: cleanString(
        document?.shopping_list_name ?? document?.saved_list_name,
        'Shopping List',
      ),
      selectedRetailerKey,
      retailerTotals,
      comparisonStatus,
      comparableRetailerCount: nonNegativeInteger(
        document?.comparable_retailer_count,
        availableRetailers.length,
      ),
      availableRetailers,
      cheapestRetailerKey,
      cheapestTotal: nonNegativeMoney(document?.cheapest_total),
      highestRetailerKey,
      highestTotal: nonNegativeMoney(document?.highest_total),
      selectedTotal: nonNegativeMoney(document?.selected_total),
      totalSaved: comparisonStatus === 'comparable'
        ? nonNegativeMoney(document?.total_saved)
        : 0,
      savingsRate: comparisonStatus === 'comparable'
        ? nonNegativeMoney(document?.savings_rate)
        : 0,
      comparisonLabel: comparisonStatus === 'comparable'
        ? cleanString(document?.comparison_label, 'Cheapest vs highest retailer')
        : 'Comparison unavailable',
      itemCount: nonNegativeInteger(document?.item_count),
      source: cleanString(document?.source, 'legacy_mongodb'),
      rawPayload: jsonSafe(document),
      createdAt,
      updatedAt,
    },
  };
}

function shoppingListAuditPayload(document) {
  return {
    sourceId: getSourceId(document),
    ownerSourceId: cleanString(document?.user_id ?? document?.userId),
    availableFields: Object.keys(document || {}).sort(),
    itemCount: Array.isArray(document?.items) ? document.items.length : 0,
  };
}

function pricingSnapshotAuditPayload(document) {
  return {
    sourceId: getSourceId(document),
    listSourceId: cleanString(document?.shopping_list_id ?? document?.saved_list_id),
    ownerSourceId: cleanString(document?.user_id ?? document?.userId),
    hasOwnerEmail: Boolean(document?.email || document?.user_email || document?.userEmail),
    availableFields: Object.keys(document || {}).sort(),
  };
}

module.exports = {
  normalizeRetailerKey,
  normalizeRetailerPrices,
  pricingSnapshotAuditPayload,
  shoppingListAuditPayload,
  transformListItem,
  transformPricingSnapshotDocument,
  transformShoppingListDocument,
};
