// Keys that could be used for MongoDB injection or prototype pollution.
const BLOCKED_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

const MAX_INPUT_DEPTH = 10;
const MAX_ARRAY_ITEMS = 500;

/**
 * Recursively checks user-controlled input for unsafe structures.
 *
 * This rejects dangerous input instead of silently changing it, making
 * suspicious requests easier to identify and preventing unexpected data.
 */
function findUnsafeInput(value, location = 'request', depth = 0) {
  // Block heavily nested objects.
  if (depth > MAX_INPUT_DEPTH) {
    return `${location} exceeds the maximum nesting depth`;
  }

  // Null bytes should not appear in normal DiscountMate input.
  if (typeof value === 'string' && value.includes('\0')) {
    return `${location} contains a null character`;
  }

  // Check arrays and limit the number of submitted items.
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) {
      return `${location} contains too many array items`;
    }

    for (let index = 0; index < value.length; index += 1) {
      const issue = findUnsafeInput(
        value[index],
        `${location}[${index}]`,
        depth + 1
      );

      if (issue) {
        return issue;
      }
    }

    return null;
  }

  // Check object keys and their child values.
  if (value !== null && typeof value === 'object') {
    for (const [key, childValue] of Object.entries(value)) {
      /*
       * MongoDB operators begin with $.
       * Dots can be used to reference nested database fields.
       * Prototype-related keys can cause unsafe object behaviour.
       */
      if (
        key.startsWith('$') ||
        key.includes('.') ||
        BLOCKED_KEYS.has(key)
      ) {
        return `${location}.${key} contains a prohibited key`;
      }

      const issue = findUnsafeInput(
        childValue,
        `${location}.${key}`,
        depth + 1
      );

      if (issue) {
        return issue;
      }
    }
  }

  return null;
}

/**
 * Checks JSON bodies and query-string input before requests reach controllers.
 */
function inputSanitisation(req, res, next) {
  const inputLocations = [
    ['body', req.body],
    ['query', req.query],
  ];

  for (const [location, value] of inputLocations) {
    const issue = findUnsafeInput(value, location);

    if (issue) {
      console.warn('Unsafe request input blocked', {
        issue,
        ip: req.ip,
        method: req.method,
        path: req.originalUrl,
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid request input.',
      });
    }
  }

  next();
}

module.exports = inputSanitisation;