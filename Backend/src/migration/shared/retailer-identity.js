const RETAILER_KEYS = Object.freeze(['aldi', 'coles', 'woolworths', 'iga']);
const RETAILER_DISPLAY_NAMES = Object.freeze({
  aldi: 'ALDI',
  coles: 'Coles',
  iga: 'IGA',
  woolworths: 'Woolworths',
});

function normalizeRetailerKey(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');

  if (normalized.startsWith('woolworth')) return 'woolworths';
  if (normalized.startsWith('coles')) return 'coles';
  if (normalized.startsWith('aldi')) return 'aldi';
  if (normalized.startsWith('iga')) return 'iga';

  return null;
}

function retailerDisplayName(value) {
  const key = normalizeRetailerKey(value);

  return key ? RETAILER_DISPLAY_NAMES[key] : null;
}

module.exports = {
  RETAILER_DISPLAY_NAMES,
  RETAILER_KEYS,
  normalizeRetailerKey,
  retailerDisplayName,
};
