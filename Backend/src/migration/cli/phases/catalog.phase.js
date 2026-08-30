const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const {
  categoryAuditPayload,
  productAuditPayload,
  transformCategoryDocument,
  transformProductDocument,
} = require('../lib/catalog-transform');

const { recordReferenceFailures } = require('../lib/reference-audit');

class MigrationSkipError extends Error {
  constructor(reason, detail = {}) {
    super(reason);
    this.name = 'MigrationSkipError';
    this.reason = reason;
    this.detail = detail;
  }
}

async function recordUnmapped(dataSource, runId, collection, sourceId, reason, payload) {
  if (!dataSource || !runId) return;

  await dataSource.query(
    `
      INSERT INTO migration.unmapped_documents (
        migration_run_id,
        source_collection,
        source_id,
        reason,
        payload
      )
      SELECT $1, $2, $3, $4, $5::jsonb
      WHERE NOT EXISTS (
        SELECT 1
        FROM migration.unmapped_documents
        WHERE source_collection = $2
          AND source_id IS NOT DISTINCT FROM $3
          AND reason = $4
          AND resolved_at IS NULL
      )
    `,
    [runId, collection, sourceId || null, reason, JSON.stringify(payload || {})],
  );
}

async function updateRunProgress(dataSource, runId, summary) {
  if (!dataSource || !runId) return;

  await dataSource.query(
    `
      UPDATE migration.runs
      SET last_scanned_source = $2,
          source_count = $3,
          target_count = $4,
          skipped_count = $5,
          failed_count = $6
      WHERE id = $1
    `,
    [
      runId,
      summary.lastScannedSource,
      summary.sourceCount,
      summary.targetCount,
      summary.skippedCount,
      summary.failedCount,
    ],
  );
}

function createProductFilter(afterId) {
  if (!afterId) return {};

  if (!ObjectId.isValid(afterId) || !/^[0-9a-fA-F]{24}$/.test(afterId)) {
    throw new Error('--after-id must be a 24-character Mongo ObjectId');
  }

  return { _id: { $gt: new ObjectId(afterId) } };
}

async function findCategoryCandidates(manager, transformed) {
  const aliases = transformed.aliases.map((alias) => ({
    identifier_type: alias.identifierType,
    identifier_value: alias.identifierValue,
  }));

  const aliasRows = await manager.query(
    `
      SELECT DISTINCT source_key.entity_id AS category_id
      FROM app.catalog_source_keys source_key
      WHERE source_key.entity_type = 'category'
        AND source_key.source_system = 'mongodb'
        AND source_key.source_collection = 'categories'
        AND (source_key.identifier_type, source_key.identifier_value) IN (
          SELECT alias.identifier_type, alias.identifier_value
          FROM jsonb_to_recordset($1::jsonb) AS alias(
            identifier_type text,
            identifier_value text
          )
        )
    `,
    [JSON.stringify(aliases)],
  );

  const nameRows = await manager.query(
    'SELECT id FROM silver.dim_categories WHERE lower(category_name) = lower($1)',
    [transformed.category.categoryName],
  );

  return new Set([
    ...aliasRows.map((row) => row.category_id),
    ...nameRows.map((row) => row.id),
  ]);
}

async function persistCategory(dataSource, transformed) {
  return dataSource.transaction(async (manager) => {
    const candidates = await findCategoryCandidates(manager, transformed);

    if (candidates.size > 1) {
      throw new MigrationSkipError('catalog_category_identity_conflict', {
        candidateCategoryIds: Array.from(candidates),
      });
    }

    const categoryId = Array.from(candidates)[0] || crypto.randomUUID();
    const { category } = transformed;
    const aliases = transformed.aliases.map((alias) => ({
      identifier_type: alias.identifierType,
      identifier_value: alias.identifierValue,
    }));

    await manager.query(
      `
        INSERT INTO silver.dim_categories (
          id,
          category_name,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          category_name = EXCLUDED.category_name,
          updated_at = EXCLUDED.updated_at
      `,
      [
        categoryId,
        category.categoryName,
        category.createdAt,
        category.updatedAt,
      ],
    );

    await manager.query(
      `
        INSERT INTO app.category_api_compatibility (
          category_id,
          description,
          icon_url,
          display_order,
          is_active,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (category_id) DO UPDATE SET
          description = EXCLUDED.description,
          icon_url = EXCLUDED.icon_url,
          display_order = EXCLUDED.display_order,
          is_active = EXCLUDED.is_active,
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        categoryId,
        category.description,
        category.iconUrl,
        category.displayOrder,
        category.isActive,
      ],
    );

    await manager.query(
      `
        INSERT INTO app.catalog_source_keys (
          entity_type,
          source_system,
          source_collection,
          identifier_type,
          identifier_value,
          entity_id,
          source_checksum,
          updated_at
        )
        SELECT
          'category',
          'mongodb',
          'categories',
          alias.identifier_type,
          alias.identifier_value,
          $2,
          $3,
          CURRENT_TIMESTAMP
        FROM jsonb_to_recordset($1::jsonb) AS alias(
          identifier_type text,
          identifier_value text
        )
        ON CONFLICT (
          entity_type,
          source_system,
          source_collection,
          identifier_type,
          identifier_value
        ) DO UPDATE SET
          entity_id = EXCLUDED.entity_id,
          source_checksum = EXCLUDED.source_checksum,
          updated_at = CURRENT_TIMESTAMP
      `,
      [JSON.stringify(aliases), categoryId, transformed.sourceChecksum],
    );

    return { categoryId, matchedExisting: candidates.size === 1 };
  });
}

async function loadCategoryMap(dataSource) {
  const rows = await dataSource.query(`
    SELECT identifier_value, entity_id AS category_id
    FROM app.catalog_source_keys
    WHERE entity_type = 'category'
      AND source_system = 'mongodb'
      AND source_collection = 'categories'
      AND identifier_type = 'mongo_id'
  `);

  return new Map(rows.map((row) => [String(row.identifier_value), row.category_id]));
}

function buildProductMatchInput(transformedProducts) {
  return transformedProducts.map((transformed) => ({
    source_id: transformed.sourceId,
    gtin: transformed.product.gtin,
    brand_name: transformed.canonicalKey.brandName,
    product_name: transformed.canonicalKey.productName,
    pack_quantity: transformed.canonicalKey.packQuantity,
    pack_uom: transformed.canonicalKey.packUom,
  }));
}

function buildAliasInput(transformedProducts) {
  return transformedProducts.flatMap((transformed) => transformed.aliases.map((alias) => ({
    source_id: transformed.sourceId,
    identifier_type: alias.identifierType,
    identifier_value: alias.identifierValue,
  })));
}

async function loadProductCandidates(manager, transformedProducts) {
  const candidates = new Map(
    transformedProducts.map((transformed) => [transformed.sourceId, new Set()]),
  );

  const aliases = buildAliasInput(transformedProducts);
  const aliasRows = await manager.query(
    `
      SELECT input.source_id, source_key.entity_id AS product_id
      FROM jsonb_to_recordset($1::jsonb) AS input(
        source_id text,
        identifier_type text,
        identifier_value text
      )
      JOIN app.catalog_source_keys source_key
        ON source_key.entity_type = 'product'
       AND source_key.source_system = 'mongodb'
       AND source_key.source_collection = 'products'
       AND source_key.identifier_type = input.identifier_type
       AND source_key.identifier_value = input.identifier_value
    `,
    [JSON.stringify(aliases)],
  );

  for (const row of aliasRows) {
    candidates.get(row.source_id)?.add(row.product_id);
  }

  const unmatchedProducts = transformedProducts.filter(
    (transformed) => candidates.get(transformed.sourceId)?.size === 0,
  );

  if (!unmatchedProducts.length) return candidates;

  const matchInput = buildProductMatchInput(unmatchedProducts);
  const directRows = await manager.query(
    `
      WITH input AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS row(
          source_id text,
          gtin text,
          brand_name text,
          product_name text,
          pack_quantity numeric,
          pack_uom text
        )
      )
      SELECT input.source_id, product.id AS product_id
      FROM input
      JOIN silver.dim_products product
        ON input.gtin IS NOT NULL AND product.gtin = input.gtin
      UNION
      SELECT input.source_id, product.id AS product_id
      FROM input
      JOIN silver.dim_products product
        ON COALESCE(lower(product.brand_name), '') = input.brand_name
       AND lower(product.product_name) = input.product_name
       AND product.pack_quantity IS NOT DISTINCT FROM input.pack_quantity
       AND COALESCE(lower(product.pack_uom), '') = COALESCE(input.pack_uom, '')
    `,
    [JSON.stringify(matchInput)],
  );

  for (const row of directRows) candidates.get(row.source_id)?.add(row.product_id);

  return candidates;
}

function identityKeys(transformed) {
  const canonical = transformed.canonicalKey;

  return [
    ...(transformed.product.gtin ? [`gtin:${transformed.product.gtin}`] : []),
    `canonical:${canonical.brandName}|${canonical.productName}|${canonical.packQuantity ?? ''}|${canonical.packUom || ''}`,
  ];
}

function assignProductIds(transformedProducts, candidates) {
  const assignedIdentity = new Map();
  const successes = [];
  const skips = [];

  for (const transformed of transformedProducts) {
    const candidateIds = candidates.get(transformed.sourceId) || new Set();
    const keys = identityKeys(transformed);

    for (const key of keys) {
      const assignedId = assignedIdentity.get(key);
      if (assignedId) candidateIds.add(assignedId);
    }

    if (candidateIds.size > 1) {
      skips.push({
        transformed,
        reason: 'catalog_product_identity_conflict',
        detail: { candidateProductIds: Array.from(candidateIds) },
      });
      continue;
    }

    const matchedExisting = candidateIds.size === 1;
    const productId = Array.from(candidateIds)[0] || crypto.randomUUID();

    for (const key of keys) assignedIdentity.set(key, productId);
    successes.push({ transformed, productId, matchedExisting });
  }

  return { successes, skips };
}

function buildProductRows(successes, categoryBySourceId) {
  const rowsByProductId = new Map();
  const skips = [];

  for (const success of successes) {
    const categoryId = categoryBySourceId.get(success.transformed.categorySourceId);

    if (!categoryId) {
      skips.push({
        transformed: success.transformed,
        reason: 'catalog_product_category_not_migrated',
        detail: { categorySourceId: success.transformed.categorySourceId },
      });
      continue;
    }

    const product = success.transformed.product;

    if (!rowsByProductId.has(success.productId)) {
      rowsByProductId.set(success.productId, {
        id: success.productId,
        category_id: categoryId,
        product_name: product.productName,
        brand_name: product.brandName,
        gtin: product.gtin,
        pack_quantity: product.packQuantity,
        pack_uom: product.packUom,
        description: product.description,
        image_link_primary: product.imageLinkPrimary,
        image_link_side: product.imageLinkSide || product.imageLinkPrimary,
        image_link_back: product.imageLinkBack,
        legacy_gtin: product.sourceAttributes.rawGtin,
        legacy_measurement: product.sourceAttributes.rawMeasurement,
        created_at: product.createdAt,
        updated_at: product.updatedAt,
      });
    }
  }

  const skippedIds = new Set(skips.map((skip) => skip.transformed.sourceId));

  return {
    rows: Array.from(rowsByProductId.values()),
    successes: successes.filter((success) => !skippedIds.has(success.transformed.sourceId)),
    skips,
  };
}

async function upsertProductRows(manager, rows) {
  if (!rows.length) return;

  await manager.query(
    `
      INSERT INTO silver.dim_products (
        id,
        category_id,
        product_name,
        brand_name,
        gtin,
        pack_quantity,
        pack_uom,
        image_link_side,
        image_link_back,
        created_at,
        updated_at
      )
      SELECT
        input.id,
        input.category_id,
        input.product_name,
        input.brand_name,
        input.gtin,
        input.pack_quantity,
        input.pack_uom,
        input.image_link_side,
        input.image_link_back,
        input.created_at,
        input.updated_at
      FROM jsonb_to_recordset($1::jsonb) AS input(
        id uuid,
        category_id uuid,
        product_name text,
        brand_name text,
        gtin varchar(14),
        pack_quantity numeric,
        pack_uom text,
        image_link_side text,
        image_link_back text,
        created_at timestamptz,
        updated_at timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        category_id = EXCLUDED.category_id,
        product_name = EXCLUDED.product_name,
        brand_name = EXCLUDED.brand_name,
        gtin = EXCLUDED.gtin,
        pack_quantity = EXCLUDED.pack_quantity,
        pack_uom = EXCLUDED.pack_uom,
        image_link_side = EXCLUDED.image_link_side,
        image_link_back = EXCLUDED.image_link_back,
        updated_at = EXCLUDED.updated_at
    `,
    [JSON.stringify(rows)],
  );

  await manager.query(
    `
      INSERT INTO app.product_api_compatibility (
        product_id,
        description,
        image_link_primary,
        legacy_gtin,
        legacy_measurement,
        updated_at
      )
      SELECT
        input.id,
        input.description,
        input.image_link_primary,
        input.legacy_gtin,
        input.legacy_measurement,
        CURRENT_TIMESTAMP
      FROM jsonb_to_recordset($1::jsonb) AS input(
        id uuid,
        description text,
        image_link_primary text,
        legacy_gtin text,
        legacy_measurement text
      )
      ON CONFLICT (product_id) DO UPDATE SET
        description = EXCLUDED.description,
        image_link_primary = EXCLUDED.image_link_primary,
        legacy_gtin = EXCLUDED.legacy_gtin,
        legacy_measurement = EXCLUDED.legacy_measurement,
        updated_at = CURRENT_TIMESTAMP
    `,
    [JSON.stringify(rows)],
  );
}

async function upsertProductSourceKeys(manager, successes) {
  const rows = successes.flatMap((success) => success.transformed.aliases.map((alias) => ({
    identifier_type: alias.identifierType,
    identifier_value: alias.identifierValue,
    entity_id: success.productId,
    source_checksum: success.transformed.sourceChecksum,
  })));

  if (!rows.length) return;

  await manager.query(
    `
      INSERT INTO app.catalog_source_keys (
        entity_type,
        source_system,
        source_collection,
        identifier_type,
        identifier_value,
        entity_id,
        source_checksum,
        updated_at
      )
      SELECT
        'product',
        'mongodb',
        'products',
        input.identifier_type,
        input.identifier_value,
        input.entity_id,
        input.source_checksum,
        CURRENT_TIMESTAMP
      FROM jsonb_to_recordset($1::jsonb) AS input(
        identifier_type text,
        identifier_value text,
        entity_id uuid,
        source_checksum text
      )
      ON CONFLICT (
        entity_type,
        source_system,
        source_collection,
        identifier_type,
        identifier_value
      ) DO UPDATE SET
        entity_id = EXCLUDED.entity_id,
        source_checksum = EXCLUDED.source_checksum,
        updated_at = CURRENT_TIMESTAMP
    `,
    [JSON.stringify(rows)],
  );
}

async function persistProductBatch(dataSource, transformedProducts, categoryBySourceId) {
  return dataSource.transaction(async (manager) => {
    const candidates = await loadProductCandidates(manager, transformedProducts);
    const assigned = assignProductIds(transformedProducts, candidates);
    const prepared = buildProductRows(assigned.successes, categoryBySourceId);
    const successes = prepared.successes;

    await upsertProductRows(manager, prepared.rows);
    await upsertProductSourceKeys(manager, successes);

    return {
      successes,
      skips: [...assigned.skips, ...prepared.skips],
      matchedExistingCount: successes.filter((success) => success.matchedExisting).length,
      insertedCount: successes.filter((success) => !success.matchedExisting).length,
    };
  });
}

async function recordWarnings(dataSource, runId, collection, transformed) {
  for (const warning of transformed.warnings) {
    await recordUnmapped(
      dataSource,
      runId,
      collection,
      transformed.sourceId,
      warning.reason,
      warning.detail,
    );
  }
}

function createSummary(categorySourceCount, productSourceCount, options) {
  return {
    sourceCount: categorySourceCount + productSourceCount,
    categorySourceCount,
    productSourceCount,
    scannedCount: 0,
    validCount: 0,
    targetCount: 0,
    targetCategoryCount: 0,
    targetProductCount: 0,
    skippedCount: 0,
    failedCount: 0,
    warningCount: 0,
    matchedExistingCategoryCount: 0,
    matchedExistingProductCount: 0,
    insertedProductCount: 0,
    expectedCategoryAliasCount: 0,
    expectedProductAliasCount: 0,
    lastScannedSource: options.afterId ? `products:${options.afterId}` : null,
    partial: Boolean(options.afterId),
    scanOnly: options.scanOnly,
  };
}

async function runCategoryDocuments(context, documents) {
  const { dataSource, runId, options, summary } = context;

  for (const document of documents) {
    summary.scannedCount += 1;
    summary.lastScannedSource = `categories:${document._id}`;
    const transformed = transformCategoryDocument(document);

    if (!transformed.valid) {
      summary.skippedCount += 1;
      await recordUnmapped(
        dataSource,
        runId,
        'categories',
        transformed.sourceId,
        transformed.errors.join(','),
        categoryAuditPayload(document),
      );
      continue;
    }

    summary.validCount += 1;
    summary.expectedCategoryAliasCount += transformed.aliases.length;

    if (options.scanOnly) {
      summary.targetCount += 1;
      summary.targetCategoryCount += 1;
      continue;
    }

    try {
      const persisted = await persistCategory(dataSource, transformed);
      summary.targetCount += 1;
      summary.targetCategoryCount += 1;
      if (persisted.matchedExisting) summary.matchedExistingCategoryCount += 1;
    } catch (error) {
      if (error instanceof MigrationSkipError) {
        summary.skippedCount += 1;
        await recordUnmapped(
          dataSource,
          runId,
          'categories',
          transformed.sourceId,
          error.reason,
          error.detail,
        );
      } else {
        summary.failedCount += 1;
        await recordUnmapped(
          dataSource,
          runId,
          'categories',
          transformed.sourceId,
          'unexpected_migration_error',
          { name: error.name, message: error.message },
        );
        if (options.failFast) throw error;
      }
    }
  }
}

async function applyProductBatch(context, batch) {
  const { dataSource, runId, options, summary, categoryBySourceId } = context;
  const valid = [];

  for (const document of batch) {
    summary.scannedCount += 1;
    summary.lastScannedSource = `products:${document._id}`;
    const transformed = transformProductDocument(document);

    if (!transformed.valid) {
      summary.skippedCount += 1;
      await recordUnmapped(
        dataSource,
        runId,
        'products',
        transformed.sourceId,
        transformed.errors.join(','),
        productAuditPayload(document),
      );
      continue;
    }

    summary.validCount += 1;
    summary.warningCount += transformed.warnings.length;
    summary.expectedProductAliasCount += transformed.aliases.length;
    valid.push(transformed);
  }

  if (options.scanOnly) {
    summary.targetCount += valid.length;
    summary.targetProductCount += valid.length;

    return;
  }

  try {
    const persisted = await persistProductBatch(dataSource, valid, categoryBySourceId);
    summary.targetCount += persisted.successes.length;
    summary.targetProductCount += persisted.successes.length;
    summary.matchedExistingProductCount += persisted.matchedExistingCount;
    summary.insertedProductCount += persisted.insertedCount;

    for (const success of persisted.successes) {
      await recordWarnings(dataSource, runId, 'products', success.transformed);
    }

    for (const skip of persisted.skips) {
      summary.skippedCount += 1;
      await recordReferenceFailures(dataSource, runId, [{
        sourceCollection: 'products',
        sourceId: skip.transformed.sourceId,
        sourceField: skip.reason === 'catalog_product_category_not_migrated'
          ? 'category_id'
          : 'product_identity',
        sourceValue: skip.reason === 'catalog_product_category_not_migrated'
          ? skip.transformed.categorySourceId
          : skip.transformed.sourceId,
        targetSchema: 'silver',
        targetTable: skip.reason === 'catalog_product_category_not_migrated'
          ? 'dim_categories'
          : 'dim_products',
        reason: skip.reason,
        required: true,
        details: skip.detail,
      }]);
      await recordUnmapped(
        dataSource,
        runId,
        'products',
        skip.transformed.sourceId,
        skip.reason,
        skip.detail,
      );
    }
  } catch (error) {
    summary.failedCount += valid.length;

    for (const transformed of valid) {
      await recordUnmapped(
        dataSource,
        runId,
        'products',
        transformed.sourceId,
        'unexpected_migration_error',
        { name: error.name, message: error.message },
      );
    }

    if (options.failFast) throw error;
  }
}

async function runCatalogPhase({ mongoDb, dataSource, runId, options, onProgress }) {
  const productFilter = createProductFilter(options.afterId);
  const categories = mongoDb.collection('categories');
  const products = mongoDb.collection('products');
  const [categoryDocuments, productSourceCount] = await Promise.all([
    categories.find({}).sort({ _id: 1 }).toArray(),
    products.countDocuments(productFilter),
  ]);

  const summary = createSummary(categoryDocuments.length, productSourceCount, options);
  const context = {
    dataSource,
    runId,
    options,
    summary,
    categoryBySourceId: null,
  };

  await runCategoryDocuments(context, categoryDocuments);

  if (!options.scanOnly) {
    context.categoryBySourceId = await loadCategoryMap(dataSource);
  }

  const cursor = products.find(productFilter).sort({ _id: 1 }).batchSize(options.batchSize);
  let batch = [];

  for await (const document of cursor) {
    batch.push(document);

    if (batch.length >= options.batchSize) {
      await applyProductBatch(context, batch);
      batch = [];
      await updateRunProgress(dataSource, runId, summary);
      onProgress?.(summary);
    }
  }

  if (batch.length) await applyProductBatch(context, batch);

  await updateRunProgress(dataSource, runId, summary);
  onProgress?.(summary);

  return summary;
}

async function insertReconciliationResult(dataSource, runId, result) {
  await dataSource.query(
    `
      INSERT INTO migration.reconciliation_results (
        migration_run_id,
        entity_type,
        check_name,
        source_value,
        target_value,
        passed,
        details
      ) VALUES ($1, 'catalog', $2, $3::jsonb, $4::jsonb, $5, $6::jsonb)
    `,
    [
      runId,
      result.checkName,
      JSON.stringify(result.sourceValue),
      JSON.stringify(result.targetValue),
      result.passed,
      JSON.stringify(result.details || {}),
    ],
  );
}

async function reconcileCatalog({ dataSource, runId, sourceSummary }) {
  const [categoryRows, productRows, aliasRows, integrityRows, duplicateRows] = await Promise.all([
    dataSource.query(`
      SELECT
        count(*) FILTER (WHERE identifier_type = 'mongo_id')::integer AS mongo_id_count,
        count(*) FILTER (WHERE identifier_type = 'category_code')::integer AS code_count,
        count(DISTINCT entity_id)::integer AS category_count
      FROM app.catalog_source_keys
      WHERE entity_type = 'category'
        AND source_system = 'mongodb'
        AND source_collection = 'categories'
    `),
    dataSource.query(`
      SELECT
        count(*) FILTER (WHERE identifier_type = 'mongo_id')::integer AS mongo_id_count,
        count(*) FILTER (WHERE identifier_type = 'product_code')::integer AS code_count,
        count(DISTINCT entity_id)::integer AS product_count
      FROM app.catalog_source_keys
      WHERE entity_type = 'product'
        AND source_system = 'mongodb'
        AND source_collection = 'products'
    `),
    dataSource.query(`
      SELECT
        (SELECT count(*)::integer FROM app.catalog_source_keys WHERE entity_type = 'category' AND source_system = 'mongodb' AND source_collection = 'categories') AS category_alias_count,
        (SELECT count(*)::integer FROM app.catalog_source_keys WHERE entity_type = 'product' AND source_system = 'mongodb' AND source_collection = 'products') AS product_alias_count
    `),
    dataSource.query(`
      SELECT (
        (SELECT count(*) FROM app.catalog_source_keys source_key LEFT JOIN silver.dim_categories category ON category.id = source_key.entity_id WHERE source_key.entity_type = 'category' AND category.id IS NULL)
        + (SELECT count(*) FROM app.catalog_source_keys source_key LEFT JOIN silver.dim_products product ON product.id = source_key.entity_id WHERE source_key.entity_type = 'product' AND product.id IS NULL)
        + (SELECT count(*) FROM app.category_api_compatibility compatibility LEFT JOIN silver.dim_categories category ON category.id = compatibility.category_id WHERE category.id IS NULL)
        + (SELECT count(*) FROM app.product_api_compatibility compatibility LEFT JOIN silver.dim_products product ON product.id = compatibility.product_id WHERE product.id IS NULL)
        + (SELECT count(*) FROM silver.dim_products product LEFT JOIN silver.dim_categories category ON category.id = product.category_id WHERE category.id IS NULL)
      )::integer AS dangling_reference_count
    `),
    dataSource.query(`
      SELECT
        (SELECT count(*) FROM (SELECT gtin FROM silver.dim_products WHERE gtin IS NOT NULL GROUP BY gtin HAVING count(*) > 1) rows)::integer AS duplicate_gtin_groups,
        (SELECT count(*) FROM (
          SELECT lower(product_name), COALESCE(lower(brand_name), ''), COALESCE(pack_quantity, -1), COALESCE(lower(pack_uom), '')
          FROM silver.dim_products
          GROUP BY lower(product_name), COALESCE(lower(brand_name), ''), COALESCE(pack_quantity, -1), COALESCE(lower(pack_uom), '')
          HAVING count(*) > 1
        ) rows)::integer AS duplicate_canonical_groups
    `),
  ]);

  const categoryMongoIds = Number(categoryRows[0]?.mongo_id_count || 0);
  const categoryCodes = Number(categoryRows[0]?.code_count || 0);
  const mappedCategories = Number(categoryRows[0]?.category_count || 0);
  const productMongoIds = Number(productRows[0]?.mongo_id_count || 0);
  const productCodes = Number(productRows[0]?.code_count || 0);
  const mappedProducts = Number(productRows[0]?.product_count || 0);
  const categoryAliases = Number(aliasRows[0]?.category_alias_count || 0);
  const productAliases = Number(aliasRows[0]?.product_alias_count || 0);
  const danglingReferenceCount = Number(
    integrityRows[0]?.dangling_reference_count || 0,
  );
  const duplicateGtinGroups = Number(duplicateRows[0]?.duplicate_gtin_groups || 0);
  const duplicateCanonicalGroups = Number(
    duplicateRows[0]?.duplicate_canonical_groups || 0,
  );

  const results = [
    {
      checkName: 'all_catalog_source_keys_resolve',
      sourceValue: { expectedDanglingReferences: 0 },
      targetValue: { danglingReferenceCount },
      passed: danglingReferenceCount === 0,
    },
    {
      checkName: 'catalog_gtins_remain_unique',
      sourceValue: { expectedDuplicateGroups: 0 },
      targetValue: { duplicateGtinGroups },
      passed: duplicateGtinGroups === 0,
    },
    {
      checkName: 'catalog_canonical_keys_remain_unique',
      sourceValue: { expectedDuplicateGroups: 0 },
      targetValue: { duplicateCanonicalGroups },
      passed: duplicateCanonicalGroups === 0,
    },
  ];

  if (!sourceSummary.partial) {
    results.push(
      {
        checkName: 'source_category_count_matches',
        sourceValue: { categories: sourceSummary.categorySourceCount },
        targetValue: { mongoIds: categoryMongoIds, categories: mappedCategories },
        passed: sourceSummary.categorySourceCount === categoryMongoIds,
      },
      {
        checkName: 'source_product_count_matches',
        sourceValue: { products: sourceSummary.productSourceCount },
        targetValue: { mongoIds: productMongoIds, products: mappedProducts },
        passed: sourceSummary.productSourceCount === productMongoIds,
      },
      {
        checkName: 'frontend_catalog_aliases_preserved',
        sourceValue: {
          categoryCodes: sourceSummary.categorySourceCount,
          productCodes: sourceSummary.productSourceCount,
        },
        targetValue: { categoryCodes, productCodes },
        passed: sourceSummary.categorySourceCount === categoryCodes
          && sourceSummary.productSourceCount === productCodes,
      },
      {
        checkName: 'catalog_alias_counts_match',
        sourceValue: {
          categoryAliases: sourceSummary.expectedCategoryAliasCount,
          productAliases: sourceSummary.expectedProductAliasCount,
        },
        targetValue: { categoryAliases, productAliases },
        passed: sourceSummary.expectedCategoryAliasCount === categoryAliases
          && sourceSummary.expectedProductAliasCount === productAliases,
      },
    );
  }

  for (const result of results) await insertReconciliationResult(dataSource, runId, result);

  return { passed: results.every((result) => result.passed), results };
}

module.exports = {
  MigrationSkipError,
  reconcileCatalog,
  runCatalogPhase,
};
