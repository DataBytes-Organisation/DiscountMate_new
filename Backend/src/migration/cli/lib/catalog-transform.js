const { checksumDocument } = require('./user-transform');
const PACK_UOM_ALIASES = new Map([
  ['g', 'g'],
  ['gram', 'g'],
  ['grams', 'g'],
  ['kg', 'kg'],
  ['kilogram', 'kg'],
  ['kilograms', 'kg'],
  ['ml', 'ml'],
  ['millilitre', 'ml'],
  ['millilitres', 'ml'],
  ['l', 'l'],
  ['litre', 'l'],
  ['litres', 'l'],
  ['ea', 'ea'],
  ['each', 'ea'],
  ['pack', 'pack'],
  ['m', 'm'],
  ['metre', 'm'],
  ['metres', 'm'],
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

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') return null;

  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : null;
}

function normalizePositiveNumber(value) {
  if (value === undefined || value === null || value === '') return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0
    ? Number(parsed.toFixed(3))
    : null;
}

function normalizeGtin(value) {
  const gtin = cleanString(value);

  if (!gtin || !/^\d{8,14}$/.test(gtin)) return null;

  return gtin;
}

function normalizePackUom(value) {
  const raw = cleanString(value, '')?.toLowerCase();

  return raw ? PACK_UOM_ALIASES.get(raw) || null : null;
}

function categoryAliases(sourceId, categoryCode) {
  return [
    { identifierType: 'mongo_id', identifierValue: sourceId },
    ...(categoryCode
      ? [{ identifierType: 'category_code', identifierValue: categoryCode }]
      : []),
  ];
}

function productAliases(sourceId, productCode, sourceProductId, gtin) {
  return [
    { identifierType: 'mongo_id', identifierValue: sourceId },
    ...(productCode
      ? [{ identifierType: 'product_code', identifierValue: productCode }]
      : []),
    ...(sourceProductId
      ? [{ identifierType: 'product_id', identifierValue: sourceProductId }]
      : []),
    ...(gtin ? [{ identifierType: 'gtin', identifierValue: gtin }] : []),
  ];
}

function transformCategoryDocument(document, fallbackNow = new Date()) {
  const sourceId = getSourceId(document);
  const categoryName = cleanString(document?.category_name ?? document?.categoryName, '');
  const categoryCode = cleanString(document?.category_code ?? document?.categoryCode);
  const errors = [];

  if (!sourceId) errors.push('missing_mongo_id');
  if (!categoryName) errors.push('missing_category_name');

  if (errors.length) {
    return { valid: false, sourceId, errors, warnings: [] };
  }

  const createdAt = resolveCreatedAt(document, fallbackNow);
  const updatedAt = toDate(document?.updated_at || document?.updatedAt, createdAt);

  return {
    valid: true,
    sourceId,
    sourceChecksum: checksumDocument(document),
    errors,
    warnings: [],
    aliases: categoryAliases(sourceId, categoryCode),
    category: {
      categoryName,
      categoryCode,
      description: cleanString(document?.description),
      iconUrl: cleanString(document?.icon_url ?? document?.iconUrl),
      displayOrder: normalizeOptionalInteger(
        document?.display_order ?? document?.displayOrder,
      ),
      isActive: document?.is_active !== false && document?.isActive !== false,
      createdAt,
      updatedAt,
    },
  };
}

function transformProductDocument(document, fallbackNow = new Date()) {
  const sourceId = getSourceId(document);
  const categorySourceId = cleanString(document?.category_id ?? document?.categoryId, '');
  const productName = cleanString(
    document?.product_name ?? document?.name ?? document?.item_name,
    '',
  );

  const productCode = cleanString(document?.product_code ?? document?.productCode, '');
  const sourceProductId = cleanString(document?.product_id ?? document?.productId);
  const rawGtin = cleanString(document?.gtin);
  const gtin = normalizeGtin(rawGtin);
  const rawMeasurement = cleanString(document?.measurement ?? document?.pack_uom);
  const packUom = normalizePackUom(rawMeasurement);
  const rawPackQuantity = document?.unit_per_prod ?? document?.pack_quantity;
  const packQuantity = normalizePositiveNumber(rawPackQuantity);
  const errors = [];
  const warnings = [];

  if (!sourceId) errors.push('missing_mongo_id');
  if (!categorySourceId) errors.push('missing_category_reference');
  if (!productName) errors.push('missing_product_name');
  if (!productCode) errors.push('missing_product_code');

  if (rawGtin && !gtin) {
    warnings.push({
      reason: 'catalog_product_invalid_gtin',
      detail: { gtinLength: rawGtin.length },
    });
  }

  if (rawMeasurement && !packUom) {
    warnings.push({
      reason: 'catalog_product_unsupported_pack_uom',
      detail: { rawMeasurement: rawMeasurement.toLowerCase() },
    });
  }

  if (rawPackQuantity !== undefined && rawPackQuantity !== null && !packQuantity) {
    warnings.push({
      reason: 'catalog_product_invalid_pack_quantity',
      detail: { hasPackQuantity: true },
    });
  }

  if (errors.length) {
    return {
      valid: false,
      sourceId,
      categorySourceId,
      errors,
      warnings,
    };
  }

  const createdAt = resolveCreatedAt(document, fallbackNow);
  const updatedAt = toDate(document?.updated_at || document?.updatedAt, createdAt);

  return {
    valid: true,
    sourceId,
    categorySourceId,
    sourceChecksum: checksumDocument(document),
    errors,
    warnings,
    aliases: productAliases(sourceId, productCode, sourceProductId, gtin),
    canonicalKey: {
      brandName: cleanString(document?.brand ?? document?.brand_name, '')
        .toLowerCase(),
      productName: productName.toLowerCase(),
      packQuantity,
      packUom,
    },
    product: {
      productName,
      brandName: cleanString(document?.brand ?? document?.brand_name),
      gtin,
      packQuantity,
      packUom,
      description: cleanString(document?.description),
      imageLinkPrimary: cleanString(document?.link_image ?? document?.image),
      imageLinkSide: cleanString(document?.image_link_side),
      imageLinkBack: cleanString(document?.image_link_back),
      sourceAttributes: {
        rawGtin: rawGtin && !gtin ? rawGtin : null,
        rawMeasurement,
      },
      createdAt,
      updatedAt,
    },
  };
}

function categoryAuditPayload(document) {
  return {
    sourceId: getSourceId(document),
    categoryCode: cleanString(document?.category_code ?? document?.categoryCode),
    availableFields: Object.keys(document || {}).sort(),
  };
}

function productAuditPayload(document) {
  return {
    sourceId: getSourceId(document),
    categorySourceId: cleanString(document?.category_id ?? document?.categoryId),
    hasProductCode: Boolean(document?.product_code ?? document?.productCode),
    hasGtin: Boolean(document?.gtin),
    availableFields: Object.keys(document || {}).sort(),
  };
}

module.exports = {
  categoryAuditPayload,
  normalizeGtin,
  normalizePackUom,
  productAuditPayload,
  transformCategoryDocument,
  transformProductDocument,
};
