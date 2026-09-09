const { checksumDocument } = require('./user-transform');
const ALLOWED_EMAIL_STATUSES = new Set(['sent', 'failed', 'not_configured']);
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'application/pdf']);
const ALLOWED_STATUSES = new Set(['received', 'in_progress', 'resolved', 'closed']);
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function cleanString(value, fallback = null) {
  if (value === undefined || value === null) return fallback;

  const cleaned = String(value).trim();

  return cleaned || fallback;
}

function toDate(value, fallback = null) {
  if (!value) return fallback;

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? fallback : date;
}

function resolveCreatedAt(document, fallbackNow) {
  const objectIdTimestamp = document?._id && typeof document._id.getTimestamp === 'function'
    ? document._id.getTimestamp()
    : null;

  return toDate(document?.createdAt ?? document?.created_at ?? objectIdTimestamp, fallbackNow);
}

function decodeBase64(value) {
  const encoded = cleanString(value, '')?.replace(/\s+/g, '') || '';

  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    return null;
  }

  const data = Buffer.from(encoded, 'base64');
  const comparableSource = encoded.replace(/=+$/, '');
  const comparableDecoded = data.toString('base64').replace(/=+$/, '');

  return comparableSource === comparableDecoded ? data : null;
}

function transformAttachment(attachment) {
  if (attachment === undefined || attachment === null) {
    return { attachment: null, errors: [] };
  }

  if (typeof attachment !== 'object' || Array.isArray(attachment)) {
    return { attachment: null, errors: ['invalid_attachment_object'] };
  }

  const originalName = cleanString(attachment.originalName ?? attachment.original_name, '');
  const mimeType = cleanString(attachment.mimeType ?? attachment.mime_type, '')?.toLowerCase();
  const declaredSize = Number(attachment.size ?? attachment.sizeBytes ?? attachment.size_bytes);
  const data = decodeBase64(attachment.dataBase64 ?? attachment.data_base64);
  const errors = [];

  if (!originalName) errors.push('missing_attachment_original_name');
  if (!ALLOWED_MIME_TYPES.has(mimeType)) errors.push('unsupported_attachment_mime_type');

  if (!Number.isInteger(declaredSize) || declaredSize < 0) {
    errors.push('invalid_attachment_size');
  } else if (declaredSize > MAX_ATTACHMENT_BYTES) {
    errors.push('attachment_too_large');
  }

  if (!data) {
    errors.push('invalid_attachment_base64');
  } else if (Number.isInteger(declaredSize) && data.length !== declaredSize) {
    errors.push('attachment_size_mismatch');
  }

  return {
    attachment: errors.length
      ? null
      : {
        originalName,
        mimeType,
        sizeBytes: declaredSize,
        data,
      },
    errors,
  };
}

function transformSupportRequestDocument(document, fallbackNow = new Date()) {
  const sourceId = cleanString(document?._id, '');
  const referenceNumber = cleanString(document?.referenceNumber ?? document?.reference_number, '');
  const name = cleanString(document?.name, '');
  const email = cleanString(document?.email, '')?.toLowerCase();
  const topic = cleanString(document?.topic, '');
  const subject = cleanString(document?.subject);
  const message = cleanString(document?.message, '');
  const supportEmail = cleanString(
    document?.supportEmail ?? document?.support_email,
    '',
  )?.toLowerCase();

  const emailStatus = cleanString(
    document?.emailStatus ?? document?.email_status,
    '',
  )?.toLowerCase();

  const status = cleanString(document?.status, 'received')?.toLowerCase();
  const errors = [];

  if (!sourceId) errors.push('missing_mongo_id');
  if (!referenceNumber) errors.push('missing_reference_number');
  if (!name) errors.push('missing_name');
  if (!email) errors.push('missing_email');
  if (!topic) errors.push('missing_topic');
  if (!message) errors.push('missing_message');
  if (!supportEmail) errors.push('missing_support_email');
  if (!ALLOWED_EMAIL_STATUSES.has(emailStatus)) errors.push('invalid_email_status');
  if (!ALLOWED_STATUSES.has(status)) errors.push('invalid_support_status');

  const transformedAttachment = transformAttachment(document?.attachment);
  const warnings = transformedAttachment.errors.map((reason) => ({
    reason,
    detail: { attachmentOmitted: true },
  }));

  if (errors.length) {
    return {
      valid: false,
      sourceId,
      errors,
      warnings,
    };
  }

  const createdAt = resolveCreatedAt(document, fallbackNow);
  const updatedAt = toDate(document?.updatedAt ?? document?.updated_at, createdAt);

  return {
    valid: true,
    sourceId,
    sourceChecksum: checksumDocument(document),
    errors,
    warnings,
    request: {
      referenceNumber,
      userId: null,
      name,
      email,
      topic,
      subject,
      message,
      supportEmail,
      emailStatus,
      status,
      createdAt,
      updatedAt,
    },
    attachment: transformedAttachment.attachment,
  };
}

function supportRequestAuditPayload(document) {
  const attachment = document?.attachment;

  return {
    sourceId: cleanString(document?._id, '') || null,
    referenceNumber: cleanString(document?.referenceNumber ?? document?.reference_number),
    hasEmail: Boolean(cleanString(document?.email, '')),
    emailStatus: cleanString(document?.emailStatus ?? document?.email_status),
    status: cleanString(document?.status),
    hasAttachment: Boolean(attachment),
    attachmentMimeType: cleanString(attachment?.mimeType ?? attachment?.mime_type),
    attachmentSize: Number.isFinite(Number(attachment?.size))
      ? Number(attachment.size)
      : null,
    availableFields: Object.keys(document || {}).sort(),
  };
}

module.exports = {
  ALLOWED_EMAIL_STATUSES,
  ALLOWED_MIME_TYPES,
  ALLOWED_STATUSES,
  MAX_ATTACHMENT_BYTES,
  supportRequestAuditPayload,
  transformSupportRequestDocument,
};
