const RETAILER_DISPLAY_NAMES = new Map([
  ['aldi', 'Aldi'],
  ['coles', 'Coles'],
  ['iga', 'IGA'],
  ['woolworths', 'Woolworths'],
]);

const PACK_UOM_DISPLAY_NAMES = new Map([
  ['ea', 'each'],
  ['g', 'gram'],
  ['kg', 'kilogram'],
  ['ml', 'millilitre'],
  ['l', 'litre'],
  ['m', 'metre'],
  ['pack', 'pack'],
]);

function resolvePackUnit(packUom, packDisplayUnit) {
  const canonicalUom = typeof packUom === 'string'
    ? packUom.trim().toLowerCase()
    : '';

  const adaptedUom = PACK_UOM_DISPLAY_NAMES.get(canonicalUom);
  const rawFallback = typeof packDisplayUnit === 'string'
    ? packDisplayUnit.trim()
    : '';

  const resolvedUnit = adaptedUom || rawFallback;

  return resolvedUnit ? ` ${resolvedUnit}` : null;
}

function nullableNumber(value, { positiveOnly = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (positiveOnly && parsed <= 0)) return null;

  return parsed;
}

function formatUnitPriceValue(value) {
  return value
    .toFixed(4)
    .replace(/0+$/, '')
    .replace(/\.$/, '');
}

function isoTimestamp(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function retailerDisplayName(value) {
  const sourceName = String(value || '').trim();
  if (!sourceName) return 'Unknown retailer';

  return RETAILER_DISPLAY_NAMES.get(sourceName.toLowerCase()) || sourceName;
}

function mapRetailerPrice(price) {
  const amount = nullableNumber(price.price, { positiveOnly: true });

  return {
    retailer: {
      id: String(price.retailerId),
      name: retailerDisplayName(price.retailerName),
      websiteUrl: price.websiteUrl || null,
    },
    price: amount,
    unitPrice: nullableNumber(price.unitPrice, { positiveOnly: true }),
    unitPriceLabel:
      amount !== null && typeof price.unitPriceLabel === 'string'
        ? price.unitPriceLabel.trim() || null
        : null,
    available: amount !== null,
    isOnSpecial: amount !== null && price.isOnSpecial === true,
    specialText: amount !== null ? price.specialText || null : null,
    productUrl: amount !== null ? price.productUrl || null : null,
    recordedAt: amount !== null ? isoTimestamp(price.recordedAt) : null,
  };
}

function mapProductRow(row) {
  const prices = parseJsonArray(row.prices).map(mapRetailerPrice);
  const currentPrices = prices
    .map((entry) => entry.price)
    .filter((price) => typeof price === 'number');

  return {
    id: String(row.id),
    name: row.product_name || 'Unnamed product',
    brand: row.brand_name || null,
    description: row.description || null,
    category: {
      id: row.category_id ? String(row.category_id) : null,
      name: row.category_name || null,
    },
    pack: {
      quantity: nullableNumber(row.pack_quantity),
      unit: resolvePackUnit(row.pack_uom, row.pack_display_unit),
    },
    gtin: row.gtin || null,
    images: {
      primary: row.image_link_primary || null,
      side: row.image_link_side || null,
      back: row.image_link_back || null,
    },
    currentPrice: currentPrices.length > 0 ? Math.min(...currentPrices) : null,
    prices,
    isOnSpecial: prices.some((entry) => entry.isOnSpecial),
    predictions: {
      prophetPrice: nullableNumber(row.prophet_price_pred),
      prophetOnSale: row.prophet_on_sale_pred ?? null,
      xgboostPrice: nullableNumber(row.xgboost_price_pred),
      trueValueClassification: row.true_value_classification || null,
    },
    createdAt: isoTimestamp(row.created_at),
    updatedAt: isoTimestamp(row.updated_at),
  };
}

function mapCategoryRow(row) {
  return {
    id: String(row.id),
    name: row.category_name,
    description: row.description || null,
    iconUrl: row.icon_url || null,
    displayOrder: nullableNumber(row.display_order),
    productCount: Number(row.product_count || 0),
  };
}

module.exports = {
  formatUnitPriceValue,
  isoTimestamp,
  mapCategoryRow,
  mapProductRow,
  mapRetailerPrice,
  nullableNumber,
  resolvePackUnit,
  retailerDisplayName,
};
