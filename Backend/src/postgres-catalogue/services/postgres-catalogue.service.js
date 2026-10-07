const {
  mapCategoryRow,
  mapProductRow,
} = require('../mappers/postgres-catalogue-api.mapper');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_SORTS = new Set([
  'name_asc',
  'name_desc',
  'price_asc',
  'price_desc',
  'newest',
]);

class PostgresCatalogueError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = 'PostgresCatalogueError';
    this.code = code;
    this.status = status;
  }
}

function badRequest(code, message) {
  return new PostgresCatalogueError(code, message, 400);
}

function notFound(message = 'Product not found.') {
  return new PostgresCatalogueError('PRODUCT_NOT_FOUND', message, 404);
}

function requireUuid(value, fieldName) {
  const candidate = String(value || '').trim();

  if (!UUID_PATTERN.test(candidate)) {
    throw badRequest('INVALID_UUID', `${fieldName} must be a valid UUID.`);
  }

  return candidate;
}

function optionalUuid(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  return requireUuid(value, fieldName);
}

function boundedInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;

  return Math.min(parsed, maximum);
}

function booleanQuery(value) {
  return value === true || String(value || '').toLowerCase() === 'true';
}

class PostgresCatalogueService {
  constructor(repository) {
    this.repository = repository;
  }

  async getCategories() {
    const rows = await this.repository.listCategories();

    return { items: rows.map(mapCategoryRow) };
  }

  normaliseListQuery(query = {}, overrides = {}) {
    const search = String(overrides.search ?? query.search ?? '').trim();

    if (search.length > 100) {
      throw badRequest('INVALID_SEARCH', 'Search must be 100 characters or fewer.');
    }

    const sort = String(query.sort || 'name_asc');

    if (!ALLOWED_SORTS.has(sort)) {
      throw badRequest('INVALID_SORT', 'Unsupported product sort value.');
    }

    return {
      search: search || null,
      categoryId: optionalUuid(query.categoryId, 'categoryId'),
      retailerId: optionalUuid(query.retailerId, 'retailerId'),
      specialsOnly:
        overrides.specialsOnly ?? booleanQuery(query.specialsOnly),
      page: boundedInteger(query.page, 1, Number.MAX_SAFE_INTEGER),
      pageSize: boundedInteger(query.limit || query.pageSize, 24, 100),
      sort,
    };
  }

  async getProducts(query = {}, overrides = {}) {
    const options = this.normaliseListQuery(query, overrides);
    const result = await this.repository.listProducts(options);

    return {
      items: result.rows.map(mapProductRow),
      pagination: {
        page: options.page,
        pageSize: options.pageSize,
        total: result.total,
        totalPages:
          result.total === 0 ? 0 : Math.ceil(result.total / options.pageSize),
      },
    };
  }

  async getProduct(productId) {
    const id = requireUuid(productId, 'productId');
    const row = await this.repository.findProductById(id);
    if (!row) throw notFound();

    return mapProductRow(row);
  }
}

module.exports = {
  ALLOWED_SORTS,
  PostgresCatalogueError,
  PostgresCatalogueService,
  UUID_PATTERN,
  booleanQuery,
  boundedInteger,
  optionalUuid,
  requireUuid,
};
