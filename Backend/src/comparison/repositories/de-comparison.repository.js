const { normalizePack } = require('../domain/comparison');

const RANGE_DAYS = { '4w': 28, '3m': 90, '6m': 180, '1y': 365 };

class DeComparisonRepository {
  constructor(poolOrClient) {
    this.db = poolOrClient;
  }

  async withReadOnlySnapshot(callback) {
    this.requireDatabase();
    if (typeof this.db.connect !== 'function') return callback(this);
    const client = await this.db.connect();

    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const result = await callback(new DeComparisonRepository(client));
      await client.query('COMMIT');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      if (!error.source) error.source = 'de';
      throw error;
    } finally {
      client.release();
    }
  }

  async searchProducts(search, limit = 12) {
    this.requireDatabase();
    const query = String(search || '').trim();
    if (query.length < 2) return [];
    const result = await this.db.query(`
            SELECT product.product_id, product.product_name, product.brand_name,
                   product.category_name, product.pack_quantity, product.pack_uom,
                   product.image_url, product.source_product_id,
                   coverage.available_retailers, coverage.offer_count
            FROM silver.comparison_products product
            JOIN LATERAL (
                SELECT
                    jsonb_agg(
                        jsonb_build_object(
                            'retailerId', offer.retailer_id,
                            'retailerName', offer.retailer_name
                        )
                        ORDER BY offer.retailer_id
                    ) AS available_retailers,
                    count(*) AS offer_count
                FROM silver.comparison_latest_offers offer
                WHERE offer.product_id = product.product_id
            ) coverage ON coverage.offer_count > 0
            WHERE (product.product_name ILIKE $1 OR product.brand_name ILIKE $1 OR product.gtin = $2)
            ORDER BY
                CASE WHEN product.product_name ILIKE $3 THEN 0 ELSE 1 END,
                coverage.offer_count DESC,
                product.product_name,
                product.product_id
            LIMIT $4
        `, [`%${query}%`, query, `${query}%`, Math.min(30, Math.max(1, Number(limit) || 12))]);

    return result.rows.map(mapProduct);
  }

  async getProduct(productId) {
    this.requireDatabase();
    const direct = await this.db.query(`
            SELECT product_id, product_name, brand_name, category_id, category_name,
                   gtin, pack_quantity, pack_uom, image_url,
                   NULLIF(to_jsonb(product)->>'source_product_id', '') AS source_product_id
            FROM silver.comparison_products product
            WHERE product_id = $1::uuid
        `, [productId]);
    if (direct.rows[0]) return mapProduct(direct.rows[0]);

    const availability = await this.db.query(
      'SELECT to_regclass(\'silver.comparison_product_members\') AS relation',
    );
    if (!availability.rows[0]?.relation) return null;

    const legacy = await this.db.query(`
            SELECT product.product_id, product.product_name, product.brand_name,
                   product.category_id, product.category_name, product.gtin,
                   product.pack_quantity, product.pack_uom, product.image_url,
                   NULLIF(to_jsonb(product)->>'source_product_id', '') AS source_product_id
            FROM silver.comparison_product_members member
            JOIN silver.comparison_products product ON product.product_id = member.group_id
            WHERE member.dim_product_id = $1::uuid
            ORDER BY product.product_id
            LIMIT 1
        `, [productId]);

    return legacy.rows[0] ? mapProduct(legacy.rows[0]) : null;
  }

  async getLatestOffers(productId, retailerIds = []) {
    this.requireDatabase();
    const result = await this.db.query(`
            SELECT offer.product_id,
                   NULLIF(to_jsonb(offer)->>'retailer_product_id', '') AS retailer_product_id,
                   offer.retailer_id, offer.retailer_name, offer.price, offer.unit_price,
                   offer.pack_quantity, offer.pack_uom, offer.is_on_special, offer.special_text,
                   offer.product_url, offer.observed_at
            FROM silver.comparison_latest_offers offer
            WHERE offer.product_id = $1::uuid
              AND ($2::uuid[] IS NULL OR offer.retailer_id = ANY($2::uuid[]))
            ORDER BY offer.retailer_id
        `, [productId, retailerIds.length ? retailerIds : null]);

    return result.rows.map(mapOffer);
  }

  async getRetailers(retailerIds = []) {
    this.requireDatabase();
    const result = await this.db.query(`
      SELECT retailer.id AS retailer_id,
             retailer.retailer_name,
             EXISTS (
               SELECT 1
               FROM silver.comparison_latest_offers offer
               WHERE offer.retailer_id = retailer.id
             ) AS retailer_data_available
      FROM silver.dim_retailers retailer
      WHERE lower(retailer.retailer_name) IN ('aldi', 'coles', 'iga', 'woolworths')
        AND ($1::uuid[] IS NULL OR retailer.id = ANY($1::uuid[]))
      ORDER BY retailer.id
    `, [retailerIds.length ? retailerIds : null]);

    return result.rows.map((row) => ({
      retailerId: String(row.retailer_id),
      retailerName: row.retailer_name,
      dataAvailable: Boolean(row.retailer_data_available),
    }));
  }

  async getProductRetailerIds(productId) {
    this.requireDatabase();
    const result = await this.db.query(`
      SELECT DISTINCT retailer_id
      FROM silver.comparison_product_members
      WHERE group_id = $1::uuid
        AND is_primary
      ORDER BY retailer_id
    `, [productId]);

    return result.rows.map((row) => String(row.retailer_id));
  }

  async getRetailerCoverageDiagnostics() {
    this.requireDatabase();
    const result = await this.db.query(`
      WITH retailer_counts AS (
        SELECT retailer.id AS retailer_id,
               retailer.retailer_name,
               count(offer.product_id)::integer AS offer_count
        FROM silver.dim_retailers retailer
        LEFT JOIN silver.comparison_latest_offers offer
          ON offer.retailer_id = retailer.id
        GROUP BY retailer.id, retailer.retailer_name
      ), group_sizes AS (
        SELECT member.group_id, count(DISTINCT member.retailer_id)::integer AS retailer_count
        FROM silver.comparison_product_members member
        JOIN silver.comparison_product_groups product_group
          ON product_group.id = member.group_id
         AND product_group.status = 'active'
        WHERE member.is_primary
        GROUP BY member.group_id
      ), group_distribution AS (
        SELECT retailer_count, count(*)::integer AS group_count
        FROM group_sizes
        GROUP BY retailer_count
      )
      SELECT
        (SELECT jsonb_agg(
          jsonb_build_object(
            'retailerId', retailer_id,
            'retailerName', retailer_name,
            'offerCount', offer_count
          ) ORDER BY retailer_id
        ) FROM retailer_counts) AS retailers,
        (SELECT jsonb_object_agg(retailer_count, group_count)
         FROM group_distribution) AS group_distribution,
        (SELECT count(*)::integer
         FROM silver.comparison_match_review_queue
         WHERE status = 'pending') AS pending_review_count
    `);

    const row = result.rows[0] || {};
    const distribution = row.group_distribution || {};

    return {
      retailers: (row.retailers || []).map((retailer) => ({
        retailerId: String(retailer.retailerId ?? retailer.retailer_id),
        retailerName: retailer.retailerName ?? retailer.retailer_name,
        offerCount: Number(retailer.offerCount ?? retailer.offer_count) || 0,
      })),
      groupDistribution: {
        singleton: Number(distribution['1']) || 0,
        twoRetailers: Number(distribution['2']) || 0,
        threeRetailers: Number(distribution['3']) || 0,
        fourRetailers: Number(distribution['4']) || 0,
      },
      pendingReviewCount: Number(row.pending_review_count) || 0,
    };
  }

  async getOffersForProducts(productIds) {
    this.requireDatabase();
    if (!productIds.length) return [];
    const result = await this.db.query(`
            SELECT offer.product_id,
                   NULLIF(to_jsonb(offer)->>'retailer_product_id', '') AS retailer_product_id,
                   offer.retailer_id, offer.retailer_name, offer.price, offer.unit_price,
                   offer.pack_quantity, offer.pack_uom, offer.is_on_special, offer.special_text,
                   offer.product_url, offer.observed_at
            FROM silver.comparison_latest_offers offer
            WHERE offer.product_id = ANY($1::uuid[])
            ORDER BY offer.product_id, offer.retailer_id
        `, [productIds]);

    return result.rows.map(mapOffer);
  }

  async getPriceHistory(productId, range = '3m', retailerIds = []) {
    this.requireDatabase();
    const days = RANGE_DAYS[range] || RANGE_DAYS['3m'];
    const result = await this.db.query(`
            WITH product_history AS (
                SELECT product_id, retailer_id, retailer_name, price, observed_at
                FROM silver.comparison_price_history
                WHERE product_id = $1::uuid
                  AND ($3::uuid[] IS NULL OR retailer_id = ANY($3::uuid[]))
            ), silver_watermark AS (
                SELECT MAX(observed_at) AS observed_at
                FROM silver.comparison_price_history
            )
            SELECT history.product_id, history.retailer_id, history.retailer_name,
                   history.price, history.observed_at
            FROM product_history history
            CROSS JOIN silver_watermark watermark
            WHERE history.observed_at >= watermark.observed_at - ($2::text || ' days')::interval
            ORDER BY history.observed_at, history.retailer_id
        `, [productId, String(days), retailerIds.length ? retailerIds : null]);

    return result.rows.map((row) => ({
      productId: String(row.product_id),
      retailerId: String(row.retailer_id),
      retailerName: row.retailer_name,
      price: String(row.price),
      observedAt: new Date(row.observed_at).toISOString(),
    }));
  }

  async getAlternatives(productId) {
    this.requireDatabase();
    const product = await this.getProduct(productId);
    if (!product) return { sameProductOtherSizes: [], similarProducts: [] };
    const productPack = normalizePack(product.packQuantity, product.packUom);
    if (!productPack) return { sameProductOtherSizes: [], similarProducts: [] };
    const dimension = productPack.dimension;

    const result = await this.db.query(`
            SELECT p.product_id, p.product_name, p.brand_name, p.category_name,
                   p.pack_quantity, p.pack_uom, p.image_url,
                   o.retailer_id, o.retailer_name, o.price, o.unit_price,
                   o.product_url, o.observed_at,
                   source_offer.price AS source_price,
                   source_offer.unit_price AS source_unit_price
            FROM silver.comparison_products p
            JOIN LATERAL (
                SELECT * FROM silver.comparison_latest_offers offer
                WHERE offer.product_id = p.product_id
                ORDER BY offer.unit_price NULLS LAST, offer.price, offer.retailer_id
                LIMIT 1
            ) o ON TRUE
            JOIN LATERAL (
                SELECT offer.price, offer.unit_price
                FROM silver.comparison_latest_offers offer
                WHERE offer.product_id = $1::uuid
                ORDER BY offer.unit_price NULLS LAST, offer.price, offer.retailer_id
                LIMIT 1
            ) source_offer ON TRUE
            CROSS JOIN LATERAL (
                SELECT count(*)::integer AS shared_token_count
                FROM (
                    SELECT DISTINCT token
                    FROM regexp_split_to_table(
                        lower(regexp_replace(p.product_name, '[^a-z0-9]+', ' ', 'g')),
                        '\\s+'
                    ) AS token
                    WHERE length(token) > 1
                    INTERSECT
                    SELECT DISTINCT token
                    FROM regexp_split_to_table(
                        lower(regexp_replace($4::text, '[^a-z0-9]+', ' ', 'g')),
                        '\\s+'
                    ) AS token
                    WHERE length(token) > 1
                ) shared_tokens
            ) semantic
            WHERE p.product_id <> $1::uuid
              AND p.category_id = $2::uuid
              AND CASE
                    WHEN lower(p.pack_uom) IN ('g', 'kg') THEN 'mass'
                    WHEN lower(p.pack_uom) IN ('ml', 'l') THEN 'volume'
                    WHEN lower(p.pack_uom) IN ('ea', 'pack', 'each') THEN 'count'
                    ELSE 'other'
                  END = $3
              AND semantic.shared_token_count > 0
            ORDER BY semantic.shared_token_count DESC,
                     o.unit_price NULLS LAST, o.price, p.product_id
            LIMIT 200
        `, [productId, product.categoryId, dimension, product.name]);

    const productBase = Number(productPack.baseQuantity);
    const sourceTokens = normalizedNameTokens(product.name);
    const candidates = result.rows.map((row) => {
      const item = mapAlternative(row);
      const candidatePack = normalizePack(item.packQuantity, item.packUom);
      const candidateBase = candidatePack ? Number(candidatePack.baseQuantity) : null;
      if (!productBase || !candidateBase) return null;
      const ratio = candidateBase / productBase;
      if (ratio < 0.5 || ratio > 2) return null;

      const candidatePrice = Number(item.cheapestOffer.price.amount);
      if (!Number.isFinite(candidatePrice) || candidatePrice <= 0) return null;
      const normalizedUnitPrice = candidatePrice / candidateBase;
      item.cheapestOffer.unitPrice = normalizedUnitPrice.toFixed(4);
      item.normalizedUnitPrice = normalizedUnitPrice.toFixed(4);

      const score = tokenSimilarity(sourceTokens, normalizedNameTokens(item.name));
      const sameBrand = Boolean(
        item.brand && product.brand && item.brand.toLowerCase() === product.brand.toLowerCase(),
      );

      const differentPack = Math.abs(candidateBase - productBase) > 0.000001;

      if (sameBrand && differentPack && score >= 0.85) {
        item.matchReason = 'same_product_other_size';
        item.matchScore = score;
      } else if (score >= 0.55) {
        item.matchReason = 'compatible_similar_product';
        item.matchScore = score;
      } else {
        return null;
      }

      const sourcePrice = Number(row.source_price);
      const sourceUnitPrice = Number.isFinite(sourcePrice) && sourcePrice > 0
        ? sourcePrice / productBase
        : validPositiveNumber(row.source_unit_price);
      item.verifiedSaving = sourceUnitPrice && sourceUnitPrice > normalizedUnitPrice
        ? { amount: (sourceUnitPrice - normalizedUnitPrice).toFixed(2), currency: 'AUD' }
        : null;
      item.packRatio = ratio;

      return item;
    }).filter(Boolean);

    const ranked = candidates.sort((left, right) => (
      right.matchScore - left.matchScore ||
      Number(right.verifiedSaving?.amount || 0) - Number(left.verifiedSaving?.amount || 0) ||
      Math.abs(1 - left.packRatio) - Math.abs(1 - right.packRatio) ||
      left.productId.localeCompare(right.productId)
    ));

    const sameProductOtherSizes = ranked.filter((item) => item.matchReason === 'same_product_other_size');
    const similarProducts = ranked.filter((item) => item.matchReason === 'compatible_similar_product');

    return {
      sameProductOtherSizes: sameProductOtherSizes.slice(0, 3),
      similarProducts: similarProducts.slice(0, 3),
    };
  }

  async resolveListItems(items) {
    this.requireDatabase();
    const resolved = await Promise.all(items.map(async (item) => {
      const directId = item.deProductId || item.productId;

      if (isUuid(directId)) {
        const product = await this.getProduct(directId);

        return product ? {
          ...item,
          productId: product.id,
          name: product.name,
          imageUrl: item.imageUrl || item.image || product.imageUrl,
          resolutionStatus: 'resolved',
          mappingMethod: 'de_product_id',
        } : { ...item, resolutionStatus: 'unresolved', resolutionReason: 'de_product_not_found' };
      }

      const name = String(item.name || item.productName || '').trim();
      if (!name) return { ...item, resolutionStatus: 'unresolved', resolutionReason: 'missing_name' };

      const gtin = String(item.gtin || '').trim();

      if (gtin) {
        const gtinResult = await this.db.query(`
                    SELECT product_id, product_name, brand_name, gtin,
                           pack_quantity, pack_uom, image_url
                    FROM silver.comparison_products
                    WHERE gtin = $1
                    ORDER BY product_id
                `, [gtin]);

        if (gtinResult.rows.length === 1) {
          return resolvedListItem(item, gtinResult.rows[0], 'gtin');
        }

        if (gtinResult.rows.length > 1) {
          return { ...item, resolutionStatus: 'ambiguous', resolutionReason: 'duplicate_gtin' };
        }
      }

      const requestedBrand = String(item.brand || '').trim() || null;
      const requestedCategoryId = isUuid(item.categoryId) ? String(item.categoryId) : null;
      const result = await this.db.query(`
                SELECT product_id, product_name, brand_name, category_id, gtin,
                       pack_quantity, pack_uom, image_url
                FROM silver.comparison_products
                WHERE lower(regexp_replace(product_name, '[^a-z0-9]+', ' ', 'g')) =
                      lower(regexp_replace($1, '[^a-z0-9]+', ' ', 'g'))
                   OR ($2::text IS NOT NULL AND lower(brand_name) = lower($2::text))
                   OR ($3::uuid IS NOT NULL AND category_id = $3::uuid)
                ORDER BY product_id
                LIMIT 200
            `, [name, requestedBrand, requestedCategoryId]);

      const requestedTokens = normalizedNameTokens(name);
      const candidates = result.rows.map((row) => ({
        ...row,
        name_score: tokenSimilarity(requestedTokens, normalizedNameTokens(row.product_name)),
      }));

      const compatible = candidates.filter((row) => listCandidateMatches(item, row));

      if (compatible.length === 1) return resolvedListItem(item, compatible[0], 'exact_identity');

      return {
        ...item,
        resolutionStatus: compatible.length > 1 ? 'ambiguous' : 'unresolved',
        resolutionReason: compatible.length > 1 ? 'ambiguous_identity' : 'no_deterministic_match',
      };
    }));

    return resolved;
  }

  async getWatermark() {
    this.requireDatabase();
    const result = await this.db.query('SELECT MAX(observed_at) AS watermark FROM silver.comparison_latest_offers');

    return result.rows[0]?.watermark ? new Date(result.rows[0].watermark).toISOString() : null;
  }

  requireDatabase() {
    if (!this.db) {
      const error = new Error('DE comparison database is not configured');
      error.status = 503;
      error.source = 'de';
      throw error;
    }
  }
}

function resolvedListItem(item, row, mappingMethod) {
  return {
    ...item,
    productId: String(row.product_id),
    name: row.product_name,
    brand: row.brand_name || item.brand || null,
    gtin: row.gtin || item.gtin || null,
    packQuantity: row.pack_quantity || item.packQuantity || null,
    packUom: row.pack_uom || item.packUom || null,
    imageUrl: item.imageUrl || item.image || row.image_url || null,
    resolutionStatus: 'resolved',
    mappingMethod,
  };
}

function listCandidateMatches(item, row) {
  const requestedBrand = String(item.brand || '').trim().toLowerCase();
  const candidateBrand = String(row.brand_name || '').trim().toLowerCase();
  if (requestedBrand && requestedBrand !== candidateBrand) return false;
  if (item.categoryId && row.category_id && String(item.categoryId) !== String(row.category_id)) return false;
  if (Number(row.name_score) < 0.90) return false;

  if (item.packQuantity && item.packUom && row.pack_quantity && row.pack_uom) {
    const requested = normalizePack(item.packQuantity, item.packUom);
    const candidate = normalizePack(row.pack_quantity, row.pack_uom);
    if (
      !requested ||
      !candidate ||
      requested.dimension !== candidate.dimension ||
      requested.baseQuantity !== candidate.baseQuantity
    ) return false;
  }

  return true;
}

function mapProduct(row) {
  const availableRetailers = Array.isArray(row.available_retailers)
    ? row.available_retailers.map((retailer) => ({
      retailerId: String(retailer.retailerId ?? retailer.retailer_id),
      retailerName: retailer.retailerName ?? retailer.retailer_name,
    }))
    : [];

  return {
    id: String(row.product_id),
    comparisonProductId: String(row.product_id),
    sourceProductId: row.source_product_id ? String(row.source_product_id) : String(row.product_id),
    name: row.product_name,
    brand: row.brand_name,
    categoryId: row.category_id ? String(row.category_id) : null,
    categoryName: row.category_name,
    gtin: row.gtin,
    packQuantity: row.pack_quantity == null ? null : String(row.pack_quantity),
    packUom: row.pack_uom,
    imageUrl: row.image_url,
    availableRetailers,
    offerCount: Number(row.offer_count) || availableRetailers.length,
  };
}

function mapOffer(row) {
  const price = validPositiveNumber(row.price);
  const offerPack = normalizePack(row.pack_quantity, row.pack_uom);
  const baseQuantity = offerPack ? Number(offerPack.baseQuantity) : null;
  const normalizedUnitPrice = price && baseQuantity
    ? price / baseQuantity
    : validPositiveNumber(row.unit_price);

  return {
    productId: String(row.product_id),
    sourceProductId: row.retailer_product_id ? String(row.retailer_product_id) : String(row.product_id),
    retailerId: String(row.retailer_id),
    retailerName: row.retailer_name,
    price: String(row.price),
    currency: 'AUD',
    unitPrice: normalizedUnitPrice == null ? null : normalizedUnitPrice.toFixed(4),
    packQuantity: row.pack_quantity == null ? null : String(row.pack_quantity),
    packUom: row.pack_uom,
    isOnSpecial: Boolean(row.is_on_special),
    specialText: row.special_text,
    productUrl: row.product_url,
    observedAt: new Date(row.observed_at).toISOString(),
  };
}

function mapAlternative(row) {
  return {
    productId: String(row.product_id),
    name: row.product_name,
    brand: row.brand_name,
    categoryName: row.category_name,
    packQuantity: String(row.pack_quantity),
    packUom: row.pack_uom,
    imageUrl: row.image_url,
    cheapestOffer: {
      retailerId: String(row.retailer_id),
      retailerName: row.retailer_name,
      price: { amount: String(row.price), currency: 'AUD' },
      unitPrice: row.unit_price == null ? null : String(row.unit_price),
      productUrl: row.product_url,
      observedAt: new Date(row.observed_at).toISOString(),
    },
  };
}

function validPositiveNumber(value) {
  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizedNameTokens(value) {
  return new Set(String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1));
}

function tokenSimilarity(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;

  return (2 * intersection) / (left.size + right.size);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

module.exports = { DeComparisonRepository, isUuid, mapOffer, mapProduct };
