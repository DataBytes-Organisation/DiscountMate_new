const crypto = require('crypto');
const {
  normalizeRetailerKey,
} = require('../../shared/retailer-identity');

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$.{53}$/;

function cleanString(value, fallback = null) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const cleaned = String(value).trim();

  return cleaned || fallback;
}

function normalizeEmail(value) {
  return cleanString(value, '')?.toLowerCase() || '';
}

function toDate(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? fallback : date;
}

function getSourceId(document) {
  if (!document?._id) {
    return '';
  }

  return String(document._id);
}

function resolveCreatedAt(document, fallback = new Date()) {
  const objectIdTimestamp = document?._id && typeof document._id.getTimestamp === 'function'
    ? document._id.getTimestamp()
    : null;

  return toDate(document?.createdAt || document?.created_at || objectIdTimestamp, fallback);
}

function resolveUpdatedAt(document, createdAt) {
  return toDate(document?.updatedAt || document?.updated_at, createdAt);
}

function normalizeRole(document) {
  if (document?.role === 'admin' || document?.role === 'user') {
    return document.role;
  }

  return document?.admin === true ? 'admin' : 'user';
}

function normalizePlan(value) {
  const plan = cleanString(value, 'free')?.toLowerCase();

  return plan === 'premium' || plan === 'family' ? plan : 'free';
}

function getBooleanAlias(record, aliases, fallback) {
  for (const alias of aliases) {
    if (typeof record?.[alias] === 'boolean') {
      return record[alias];
    }
  }

  return fallback;
}

function normalizeNotificationPreferences(value) {
  const alertTypes = value?.alert_types || value?.alertTypes || {};

  return {
    priceAlertsEnabled: getBooleanAlias(
      alertTypes,
      ['price_alerts', 'priceAlerts'],
      true,
    ),
    weeklySummaryEnabled: getBooleanAlias(
      alertTypes,
      ['weekly_summary', 'weeklySummary'],
      true,
    ),
    browserNotificationsEnabled: getBooleanAlias(
      alertTypes,
      ['in_browser_notifications', 'inBrowserNotifications', 'browserNotifications'],
      true,
    ),
  };
}

function finiteNumber(value, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function nonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.floor(finiteNumber(value, fallback)));
}

function optionalMoney(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function decodeProfileImage(profileImage) {
  if (!profileImage?.mime || !profileImage?.content) {
    return null;
  }

  let imageData = null;

  if (Buffer.isBuffer(profileImage.content)) {
    imageData = profileImage.content;
  } else if (
    profileImage.content?.type === 'Buffer'
        && Array.isArray(profileImage.content.data)
  ) {
    imageData = Buffer.from(profileImage.content.data);
  } else if (typeof profileImage.content === 'string') {
    const encoded = profileImage.content.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');

    if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
      return null;
    }
    imageData = Buffer.from(encoded, 'base64');
  }

  if (!imageData?.length) {
    return null;
  }

  return {
    mimeType: cleanString(profileImage.mime, 'application/octet-stream'),
    imageData,
  };
}

function jsonSafe(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return { type: 'Buffer', length: value.length };
  if (Array.isArray(value)) return value.map(jsonSafe);

  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return value.toHexString();

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, jsonSafe(nestedValue)]),
    );
  }

  return value;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }

  return value;
}

function checksumDocument(document) {
  const serialized = JSON.stringify(stableValue(jsonSafe(document)));

  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function transformReceipt(receipt, sourceUserId, index, fallbackDate) {
  const storeName = cleanString(receipt?.store_name || receipt?.storeName, '');

  if (!storeName) {
    return {
      warning: {
        reason: 'receipt_missing_store_name',
        detail: { receiptIndex: index },
      },
    };
  }

  const rawItems = Array.isArray(receipt?.items) ? receipt.items : [];
  const retailerKey = normalizeRetailerKey(storeName);
  const items = rawItems.map((item, itemIndex) => ({
    lineNumber: itemIndex + 1,
    itemName: cleanString(item?.item || item?.name || item?.product_name),
    quantity: Math.max(0.001, finiteNumber(item?.quantity, 1)),
    unitPrice: optionalMoney(item?.unit_price ?? item?.unitPrice),
    lineTotal: optionalMoney(item?.price ?? item?.line_total ?? item?.lineTotal),
    rawPayload: jsonSafe(item),
  }));

  return {
    receipt: {
      sourceReceiptKey: `mongodb:users:${sourceUserId}:receipt:${index}`,
      retailerKey,
      storeName,
      receiptNumber: cleanString(receipt?.receipt_number || receipt?.receiptNumber),
      purchasedAt: toDate(receipt?.purchased_at || receipt?.purchasedAt),
      uploadedAt: toDate(receipt?.uploaded_at || receipt?.uploadedAt, fallbackDate),
      subtotal: optionalMoney(receipt?.subtotal),
      total: optionalMoney(receipt?.total),
      savings: optionalMoney(receipt?.savings),
      source: cleanString(receipt?.source, 'legacy_mongodb'),
      rawPayload: jsonSafe(receipt),
      items,
    },
    warning: retailerKey
      ? null
      : {
        reason: 'receipt_retailer_unrecognized',
        detail: { receiptIndex: index },
      },
  };
}

function transformUserDocument(document, fallbackNow = new Date()) {
  const sourceId = getSourceId(document);
  const email = normalizeEmail(document?.email || document?.account_user_name);
  const passwordHash = cleanString(document?.encrypted_password, '');
  const errors = [];
  const warnings = [];

  if (!sourceId) errors.push('missing_mongo_id');
  if (!email) errors.push('missing_email');
  if (!BCRYPT_HASH_REGEX.test(passwordHash)) errors.push('missing_or_invalid_bcrypt_hash');

  if (errors.length) {
    return { valid: false, sourceId, email, errors, warnings };
  }

  const createdAt = resolveCreatedAt(document, fallbackNow);
  const updatedAt = resolveUpdatedAt(document, createdAt);
  const phoneNumber = cleanString(document?.phone_number);
  const explicitEmailVerified = document?.email_verified;
  const explicitPhoneVerified = document?.phone_verified;
  const postcodeValue = cleanString(document?.postcode);
  const postcode = postcodeValue && /^\d{4}$/.test(postcodeValue) ? postcodeValue : null;

  if (postcodeValue && !postcode) {
    warnings.push({ reason: 'invalid_postcode_omitted', detail: { postcode: postcodeValue } });
  }

  const profileImage = decodeProfileImage(document?.profile_image);

  if (document?.profile_image?.content && !profileImage) {
    warnings.push({ reason: 'invalid_profile_image_omitted', detail: {} });
  }

  const dashboardPreferences = document?.dashboard_preferences || {};
  const subscriptionUpdatedAt = toDate(document?.subscription?.updatedAt, updatedAt);
  const receipts = [];

  for (const [index, receipt] of (Array.isArray(document?.receipt_history)
    ? document.receipt_history
    : []).entries()) {
    const transformed = transformReceipt(receipt, sourceId, index, createdAt);
    if (transformed.warning) warnings.push(transformed.warning);
    if (transformed.receipt) receipts.push(transformed.receipt);
  }

  return {
    valid: true,
    sourceId,
    sourceChecksum: checksumDocument(document),
    errors,
    warnings,
    user: {
      email,
      passwordHash,
      role: normalizeRole(document),
      status: 'active',
      emailVerifiedAt:
                explicitEmailVerified === false ? null : createdAt,
      phoneVerifiedAt:
                explicitPhoneVerified === false || (!phoneNumber && explicitPhoneVerified !== true)
                  ? null
                  : createdAt,
      createdAt,
      updatedAt,
    },
    profile: {
      firstName: cleanString(document?.user_fname || document?.firstName),
      lastName: cleanString(document?.user_lname || document?.lastName),
      phoneNumber,
      address: cleanString(document?.address),
      postcode,
      dateOfBirth: toDate(document?.dob),
      bio: cleanString(document?.bio),
      legacyProfileId: cleanString(document?.profileID),
      createdAt,
      updatedAt,
    },
    profileImage,
    notificationPreferences: normalizeNotificationPreferences(
      document?.notification_preferences,
    ),
    dashboardPreferences: {
      legacySelectedListId: cleanString(
        dashboardPreferences?.selected_dashboard_list_id,
      ),
      selectedRetailerKey: normalizeRetailerKey(
        dashboardPreferences?.selected_dashboard_retailer,
      ) || 'coles',
      createdAt,
      updatedAt: toDate(dashboardPreferences?.updatedAt, updatedAt),
    },
    legacyMetrics: {
      totalSaved: nonNegativeNumber(document?.totalSaved),
      shoppingTrips: nonNegativeInteger(document?.shoppingTrips),
      shoppingListsCount: nonNegativeInteger(document?.shoppingLists),
      updatedAt,
    },
    subscription: {
      planCode: normalizePlan(
        document?.subscription?.plan || document?.subscriptionPlan,
      ),
      startedAt: subscriptionUpdatedAt || createdAt,
      updatedAt: subscriptionUpdatedAt || updatedAt,
    },
    receipts,
  };
}

function auditPayload(document) {
  return {
    sourceId: getSourceId(document),
    email: normalizeEmail(document?.email || document?.account_user_name) || null,
    availableFields: Object.keys(document || {}).sort(),
    receiptCount: Array.isArray(document?.receipt_history)
      ? document.receipt_history.length
      : 0,
    hasProfileImage: Boolean(document?.profile_image?.content),
  };
}

module.exports = {
  BCRYPT_HASH_REGEX,
  auditPayload,
  checksumDocument,
  decodeProfileImage,
  jsonSafe,
  normalizeEmail,
  normalizeNotificationPreferences,
  normalizePlan,
  normalizeRetailerKey,
  transformReceipt,
  transformUserDocument,
};
