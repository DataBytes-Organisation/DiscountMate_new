const { CATEGORY_CATALOG, getCatalogEntryByKey } = require('../../../utils/alertSegments');
const { checksumDocument } = require('./user-transform');
const CATEGORY_KEY_BY_LABEL = new Map(
  CATEGORY_CATALOG.map((category) => [category.label.toLowerCase(), category.key]),
);

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

function getOwner(document) {
  return {
    ownerSourceId: cleanString(document?.user_id ?? document?.userId, ''),
    ownerEmail: cleanString(
      document?.email ?? document?.user_email ?? document?.userEmail,
      '',
    ).toLowerCase(),
  };
}

function normalizeStringArray(value, { unique = false } = {}) {
  const values = Array.isArray(value)
    ? value
    : value === undefined || value === null
      ? []
      : [value];

  const normalized = values.map((item) => cleanString(item, '')).filter(Boolean);

  return unique ? Array.from(new Set(normalized)) : normalized;
}

function resolveCategory(document) {
  const sourceKey = cleanString(document?.category_key ?? document?.categoryKey, '');
  const sourceLabel = cleanString(document?.category_label ?? document?.categoryLabel, '');
  const keyFromLabel = sourceLabel ? CATEGORY_KEY_BY_LABEL.get(sourceLabel.toLowerCase()) : null;
  const categoryKey = sourceKey || keyFromLabel || '';
  const catalogEntry = getCatalogEntryByKey(categoryKey);

  return {
    categoryKey,
    categoryLabel: catalogEntry?.label || sourceLabel || categoryKey,
    catalogEntry,
  };
}

function transformAlertSegmentDocument(document, fallbackNow = new Date()) {
  const sourceId = getSourceId(document);
  const { ownerSourceId, ownerEmail } = getOwner(document);
  const { categoryKey, categoryLabel, catalogEntry } = resolveCategory(document);
  const errors = [];
  const warnings = [];

  if (!sourceId) errors.push('missing_mongo_id');
  if (!ownerSourceId && !ownerEmail) errors.push('missing_user_owner');
  if (!categoryKey) errors.push('missing_category_key');

  if (categoryKey && !catalogEntry) {
    warnings.push({
      reason: 'alert_category_not_in_frontend_catalog',
      detail: { categoryKey, categoryLabel },
    });
  }

  if (errors.length) {
    return {
      valid: false,
      sourceId,
      ownerSourceId,
      ownerEmail,
      errors,
      warnings,
    };
  }

  const createdAt = resolveCreatedAt(document, fallbackNow);
  const updatedAt = toDate(document?.updated_at || document?.updatedAt, createdAt);

  return {
    valid: true,
    sourceId,
    ownerSourceId,
    ownerEmail,
    sourceChecksum: checksumDocument(document),
    errors,
    warnings,
    segment: {
      categoryKey,
      categoryLabel,
      active: Boolean(document?.active),
      createdAt,
      updatedAt,
    },
  };
}

function transformNotificationDocument(document, fallbackNow = new Date()) {
  const sourceId = getSourceId(document);
  const { ownerSourceId, ownerEmail } = getOwner(document);
  const { categoryKey, categoryLabel, catalogEntry } = resolveCategory(document);
  const errors = [];
  const warnings = [];

  if (!sourceId) errors.push('missing_mongo_id');
  if (!ownerSourceId && !ownerEmail) errors.push('missing_user_owner');

  if (categoryKey && !catalogEntry) {
    warnings.push({
      reason: 'notification_category_not_in_frontend_catalog',
      detail: { categoryKey, categoryLabel },
    });
  }

  for (const [field, value] of [
    ['type', document?.type],
    ['title', document?.title ?? document?.subject],
    ['message', document?.message ?? document?.body],
  ]) {
    if (!cleanString(value, '')) {
      warnings.push({
        reason: 'notification_optional_text_defaulted',
        detail: { field },
      });
    }
  }

  if (errors.length) {
    return {
      valid: false,
      sourceId,
      ownerSourceId,
      ownerEmail,
      errors,
      warnings,
    };
  }

  const createdAt = resolveCreatedAt(document, fallbackNow);
  const updatedAt = toDate(document?.updated_at || document?.updatedAt, createdAt);

  return {
    valid: true,
    sourceId,
    ownerSourceId,
    ownerEmail,
    sourceChecksum: checksumDocument(document),
    errors,
    warnings,
    notification: {
      type: cleanString(document?.type, 'general'),
      title: cleanString(document?.title ?? document?.subject, 'Notification'),
      message: cleanString(document?.message ?? document?.body, ''),
      isRead: Boolean(document?.read),
      categoryKey: categoryKey || null,
      categoryLabel: categoryLabel || null,
      ctaRoute: cleanString(document?.cta_route ?? document?.ctaRoute),
      dealKey: cleanString(document?.deal_key ?? document?.dealKey),
      sourceTypes: normalizeStringArray(
        document?.source_types ?? document?.sourceTypes,
        { unique: true },
      ),
      relatedProductIdentifiers: normalizeStringArray(
        document?.related_product_ids ?? document?.relatedProductIds,
      ),
      createdAt,
      updatedAt,
    },
  };
}

function alertSegmentAuditPayload(document) {
  const { ownerSourceId, ownerEmail } = getOwner(document);
  const { categoryKey } = resolveCategory(document);

  return {
    sourceId: getSourceId(document),
    ownerSourceId: ownerSourceId || null,
    hasOwnerEmail: Boolean(ownerEmail),
    categoryKey: categoryKey || null,
    availableFields: Object.keys(document || {}).sort(),
  };
}

function notificationAuditPayload(document) {
  const { ownerSourceId, ownerEmail } = getOwner(document);
  const { categoryKey } = resolveCategory(document);
  const relatedProductIdentifiers = normalizeStringArray(
    document?.related_product_ids ?? document?.relatedProductIds,
  );

  return {
    sourceId: getSourceId(document),
    ownerSourceId: ownerSourceId || null,
    hasOwnerEmail: Boolean(ownerEmail),
    categoryKey: categoryKey || null,
    relatedProductCount: relatedProductIdentifiers.length,
    availableFields: Object.keys(document || {}).sort(),
  };
}

module.exports = {
  alertSegmentAuditPayload,
  normalizeStringArray,
  notificationAuditPayload,
  transformAlertSegmentDocument,
  transformNotificationDocument,
};
