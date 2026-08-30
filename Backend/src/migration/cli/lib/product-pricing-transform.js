const { checksumDocument } = require('./user-transform');
const {
  normalizeRetailerKey,
} = require('../../shared/retailer-identity');

function cleanString(value, fallback = null) {
  if (value === undefined || value === null) return fallback;

  const cleaned = String(value).trim();

  return cleaned || fallback;
}

function getSourceId(document) {
  return cleanString(document?._id, '');
}

function toDate(value) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeMoney(value) {
  if (value === undefined || value === null || value === '') return null;

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || Math.abs(parsed) > 99999999.99) return null;

  return Number(parsed.toFixed(2));
}

function normalizeNumericUnitPrice(value) {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'string' && !/^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || Math.abs(parsed) > 99999999.9999) return null;

  return Number(parsed.toFixed(4));
}

function transformProductPricingDocument(document) {
  const sourceId = getSourceId(document);
  const sourceProductId = cleanString(document?.product_id ?? document?.productId);
  const productCode = cleanString(document?.product_code ?? document?.productCode);
  const rawStoreChain = cleanString(
    document?.store_chain ?? document?.storeChain ?? document?.retailer,
  );

  const retailerKey = normalizeRetailerKey(rawStoreChain);
  const recordedAt = toDate(document?.date ?? document?.recorded_at ?? document?.recordedAt);
  const price = normalizeMoney(document?.price);
  const bestPrice = normalizeMoney(document?.best_price ?? document?.bestPrice);
  const rawUnitPrice = cleanString(document?.unit_price ?? document?.unitPrice);
  const rawBestUnitPrice = cleanString(
    document?.best_unit_price ?? document?.bestUnitPrice,
  );

  const errors = [];
  const warnings = [];

  if (!sourceId) errors.push('missing_mongo_id');
  if (!sourceProductId && !productCode) errors.push('missing_product_reference');
  if (!rawStoreChain) errors.push('missing_store_chain');
  else if (!retailerKey) errors.push('unsupported_store_chain');
  if (!recordedAt) errors.push('missing_or_invalid_recorded_at');
  if (price === null) errors.push('missing_or_invalid_price');

  if (price !== null && price <= 0) {
    errors.push('product_pricing_non_positive_price');
  }

  const rawBestPrice = document?.best_price ?? document?.bestPrice;

  if (rawBestPrice !== undefined && rawBestPrice !== null && bestPrice === null) {
    warnings.push({
      reason: 'product_pricing_invalid_best_price',
      detail: { hasBestPrice: true },
    });
  }

  if (errors.length) {
    return {
      valid: false,
      sourceId,
      sourceProductId,
      productCode,
      retailerKey,
      errors,
      warnings,
    };
  }

  const sourceCreatedAt = toDate(document?.created_at ?? document?.createdAt);
  const sourceUpdatedAt = toDate(document?.updated_at ?? document?.updatedAt);

  return {
    valid: true,
    sourceId,
    sourceProductId,
    productCode,
    retailerKey,
    sourceChecksum: checksumDocument(document),
    errors,
    warnings,
    price: {
      recordedAt,
      price,
      bestPrice,
      unitPrice: normalizeNumericUnitPrice(document?.unit_price ?? document?.unitPrice),
      rawUnitPrice,
      rawBestUnitPrice,
      isOnSpecial: typeof document?.is_on_special === 'boolean'
        ? document.is_on_special
        : typeof document?.isOnSpecial === 'boolean'
          ? document.isOnSpecial
          : null,
      rawStoreChain,
      sourceName: cleanString(document?.source),
      sourceCreatedAt,
      sourceUpdatedAt,
    },
  };
}

function productPricingAuditPayload(document) {
  return {
    sourceId: getSourceId(document),
    sourceProductId: cleanString(document?.product_id ?? document?.productId),
    productCode: cleanString(document?.product_code ?? document?.productCode),
    storeChain: cleanString(
      document?.store_chain ?? document?.storeChain ?? document?.retailer,
    ),
    hasPrice: document?.price !== undefined && document?.price !== null,
    availableFields: Object.keys(document || {}).sort(),
  };
}

module.exports = {
  normalizeMoney,
  normalizeNumericUnitPrice,
  normalizeRetailerKey,
  productPricingAuditPayload,
  transformProductPricingDocument,
};
