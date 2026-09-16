const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const {
  productPricingAuditPayload,
  transformProductPricingDocument,
} = require('../lib/product-pricing-transform');

const { recordReferenceFailures } = require('../lib/reference-audit');
const {
  recordBlocked,
  recordFailed,
  recordMigratedBatch,
  recordRejected,
  updateRunProgress,
} = require('../lib/migration-audit');

function createFilter(afterId) {
  if (!afterId) return {};

  if (!ObjectId.isValid(afterId) || !/^[0-9a-fA-F]{24}$/.test(afterId)) {
    throw new Error('--after-id must be a 24-character Mongo ObjectId');
  }

  return { _id: { $gt: new ObjectId(afterId) } };
}

function productAliasKey(identifierType, identifierValue) {
  return `${identifierType}:${identifierValue}`;
}

async function loadReferenceMaps(dataSource) {
  const [productRows, retailerRows] = await Promise.all([
    dataSource.query(`
      SELECT
        source_key.identifier_type,
        source_key.identifier_value,
        product.id AS product_id,
        product.category_id,
        product.product_name
      FROM app.catalog_source_keys source_key
      JOIN silver.dim_products product ON product.id = source_key.entity_id
      WHERE source_key.entity_type = 'product'
        AND source_key.source_system = 'mongodb'
        AND source_key.source_collection = 'products'
    `),
    dataSource.query('SELECT id, lower(retailer_name) AS retailer_key FROM silver.dim_retailers'),
  ]);

  return {
    productByAlias: new Map(productRows.map((row) => [
      productAliasKey(row.identifier_type, row.identifier_value),
      {
        productId: row.product_id,
        categoryId: row.category_id,
        productName: row.product_name,
      },
    ])),
    retailerByKey: new Map(
      retailerRows.map((row) => [String(row.retailer_key), row.id]),
    ),
  };
}

function findProductCandidates(transformed, references) {
  const candidates = new Map();

  const addCandidate = (identifierType, identifierValue) => {
    if (!identifierValue) return;

    const candidate = references.productByAlias.get(
      productAliasKey(identifierType, identifierValue),
    );

    if (candidate) candidates.set(candidate.productId, candidate);
  };

  addCandidate('mongo_id', transformed.sourceProductId);
  addCandidate('product_id', transformed.sourceProductId);
  addCandidate('product_code', transformed.sourceProductId);
  addCandidate('product_code', transformed.productCode);

  return Array.from(candidates.values());
}

function resolvePricingRow(transformed, references) {
  const candidates = findProductCandidates(transformed, references);

  if (!candidates.length) {
    return {
      skip: {
        reason: 'product_pricing_product_not_migrated',
        detail: {
          sourceProductId: transformed.sourceProductId,
          productCode: transformed.productCode,
        },
      },
    };
  }

  if (candidates.length > 1) {
    return {
      skip: {
        reason: 'product_pricing_product_identity_conflict',
        detail: { candidateProductIds: candidates.map((candidate) => candidate.productId) },
      },
    };
  }

  const retailerId = references.retailerByKey.get(transformed.retailerKey);

  if (!retailerId) {
    return {
      skip: {
        reason: 'product_pricing_retailer_not_migrated',
        detail: { retailerKey: transformed.retailerKey },
      },
    };
  }

  const product = candidates[0];

  return {
    row: {
      fact_id: crypto.randomUUID(),
      source_id: transformed.sourceId,
      recorded_at: transformed.price.recordedAt,
      product_id: product.productId,
      category_id: product.categoryId,
      retailer_id: retailerId,
      item_name: product.productName,
      price: transformed.price.price,
      unit_price: transformed.price.unitPrice,
      is_on_special: transformed.price.isOnSpecial,
      best_price: transformed.price.bestPrice,
      raw_unit_price: transformed.price.rawUnitPrice,
      raw_best_unit_price: transformed.price.rawBestUnitPrice,
      raw_store_chain: transformed.price.rawStoreChain,
      source_name: transformed.price.sourceName,
      source_checksum: transformed.sourceChecksum,
      source_created_at: transformed.price.sourceCreatedAt,
      source_updated_at: transformed.price.sourceUpdatedAt,
    },
  };
}

async function persistPricingRows(dataSource, runId, rows, transformedDocuments) {
  if (!rows.length) return 0;

  return dataSource.transaction(async (manager) => {
    await manager.query(
      `
        WITH input AS (
          SELECT *
          FROM jsonb_to_recordset($1::jsonb) AS row(
            source_id text,
            recorded_at timestamptz
          )
        )
        DELETE FROM silver.fct_product_prices fact
        USING app.product_price_source_records source_record, input
        WHERE source_record.source_system = 'mongodb'
          AND source_record.source_collection = 'product_pricings'
          AND source_record.source_record_id = input.source_id
          AND fact.id = source_record.price_fact_id
          AND fact.recorded_at = source_record.price_recorded_at
          AND source_record.price_recorded_at IS DISTINCT FROM input.recorded_at
      `,
      [JSON.stringify(rows)],
    );

    const written = await manager.query(
      `
        INSERT INTO silver.fct_product_prices (
          id,
          recorded_at,
          product_id,
          category_id,
          retailer_id,
          item_name,
          special_text,
          product_url,
          price,
          unit_price,
          is_on_special
        )
        SELECT
          COALESCE(source_record.price_fact_id, input.fact_id),
          input.recorded_at,
          input.product_id,
          input.category_id,
          input.retailer_id,
          input.item_name,
          NULL,
          NULL,
          input.price,
          input.unit_price,
          input.is_on_special
        FROM jsonb_to_recordset($1::jsonb) AS input(
          fact_id uuid,
          source_id text,
          recorded_at timestamptz,
          product_id uuid,
          category_id uuid,
          retailer_id uuid,
          item_name text,
          price numeric,
          unit_price numeric,
          is_on_special boolean
        )
        LEFT JOIN app.product_price_source_records source_record
          ON source_record.source_system = 'mongodb'
         AND source_record.source_collection = 'product_pricings'
         AND source_record.source_record_id = input.source_id
        WHERE true
        ON CONFLICT (id, recorded_at) DO UPDATE SET
          product_id = EXCLUDED.product_id,
          category_id = EXCLUDED.category_id,
          retailer_id = EXCLUDED.retailer_id,
          item_name = EXCLUDED.item_name,
          special_text = EXCLUDED.special_text,
          product_url = EXCLUDED.product_url,
          price = EXCLUDED.price,
          unit_price = EXCLUDED.unit_price,
          is_on_special = EXCLUDED.is_on_special
        RETURNING id
      `,
      [JSON.stringify(rows)],
    );

    await manager.query(
      `
        INSERT INTO app.product_price_source_records (
          source_system,
          source_collection,
          source_record_id,
          price_fact_id,
          price_recorded_at,
          best_price,
          raw_unit_price,
          raw_best_unit_price,
          raw_store_chain,
          source_name,
          source_checksum,
          source_created_at,
          source_updated_at,
          updated_at
        )
        SELECT
          'mongodb',
          'product_pricings',
          input.source_id,
          COALESCE(source_record.price_fact_id, input.fact_id),
          input.recorded_at,
          input.best_price,
          input.raw_unit_price,
          input.raw_best_unit_price,
          input.raw_store_chain,
          input.source_name,
          input.source_checksum,
          input.source_created_at,
          input.source_updated_at,
          CURRENT_TIMESTAMP
        FROM jsonb_to_recordset($1::jsonb) AS input(
          fact_id uuid,
          source_id text,
          recorded_at timestamptz,
          best_price numeric,
          raw_unit_price text,
          raw_best_unit_price text,
          raw_store_chain text,
          source_name text,
          source_checksum text,
          source_created_at timestamptz,
          source_updated_at timestamptz
        )
        LEFT JOIN app.product_price_source_records source_record
          ON source_record.source_system = 'mongodb'
         AND source_record.source_collection = 'product_pricings'
         AND source_record.source_record_id = input.source_id
        WHERE true
        ON CONFLICT (
          source_system,
          source_collection,
          source_record_id
        ) DO UPDATE SET
          price_fact_id = EXCLUDED.price_fact_id,
          price_recorded_at = EXCLUDED.price_recorded_at,
          best_price = EXCLUDED.best_price,
          raw_unit_price = EXCLUDED.raw_unit_price,
          raw_best_unit_price = EXCLUDED.raw_best_unit_price,
          raw_store_chain = EXCLUDED.raw_store_chain,
          source_name = EXCLUDED.source_name,
          source_checksum = EXCLUDED.source_checksum,
          source_created_at = EXCLUDED.source_created_at,
          source_updated_at = EXCLUDED.source_updated_at,
          updated_at = CURRENT_TIMESTAMP
      `,
      [JSON.stringify(rows)],
    );

    const sourceMappings = await manager.query(
      `
        SELECT source_record_id, price_fact_id
        FROM app.product_price_source_records
        WHERE source_system = 'mongodb'
          AND source_collection = 'product_pricings'
          AND source_record_id = ANY($1::text[])
      `,
      [transformedDocuments.map((transformed) => transformed.sourceId)],
    );

    const targetIdBySourceId = new Map(
      sourceMappings.map((mapping) => [mapping.source_record_id, mapping.price_fact_id]),
    );

    await recordMigratedBatch(
      manager,
      runId,
      transformedDocuments.map((transformed) => ({
        sourceCollection: 'product_pricings',
        sourceId: transformed.sourceId,
        sourceChecksum: transformed.sourceChecksum,
        targetSchema: 'silver',
        targetTable: 'fct_product_prices',
        targetId: targetIdBySourceId.get(transformed.sourceId),
        warnings: transformed.warnings,
      })),
    );

    return written.length;
  });
}

async function refreshProductPriceSnapshots(dataSource) {
  await dataSource.transaction(async (manager) => {
    await manager.query('SET LOCAL max_parallel_workers_per_gather = 0');
    await manager.query(`
      UPDATE silver.dim_products
      SET price_current_coles = NULL,
          price_last_coles = NULL,
          price_current_woolworths = NULL,
          price_last_woolworths = NULL,
          price_current_aldi = NULL,
          price_last_aldi = NULL,
          price_current_iga = NULL,
          price_last_iga = NULL,
          unit_price_current_coles = NULL,
          unit_price_last_coles = NULL,
          unit_price_current_woolworths = NULL,
          unit_price_last_woolworths = NULL,
          unit_price_current_aldi = NULL,
          unit_price_last_aldi = NULL,
          unit_price_current_iga = NULL,
          unit_price_last_iga = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE price_current_coles IS NOT NULL
         OR price_last_coles IS NOT NULL
         OR price_current_woolworths IS NOT NULL
         OR price_last_woolworths IS NOT NULL
         OR price_current_aldi IS NOT NULL
         OR price_last_aldi IS NOT NULL
         OR price_current_iga IS NOT NULL
         OR price_last_iga IS NOT NULL
         OR unit_price_current_coles IS NOT NULL
         OR unit_price_last_coles IS NOT NULL
         OR unit_price_current_woolworths IS NOT NULL
         OR unit_price_last_woolworths IS NOT NULL
         OR unit_price_current_aldi IS NOT NULL
         OR unit_price_last_aldi IS NOT NULL
         OR unit_price_current_iga IS NOT NULL
         OR unit_price_last_iga IS NOT NULL
    `);
    await manager.query(`
    WITH ranked AS (
      SELECT
        fact.product_id,
        lower(retailer.retailer_name) AS retailer_key,
        fact.price,
        fact.unit_price,
        row_number() OVER (
          PARTITION BY fact.product_id, lower(retailer.retailer_name)
          ORDER BY fact.recorded_at DESC, fact.created_at DESC, fact.id DESC
        ) AS price_rank
      FROM silver.fct_product_prices fact
      JOIN silver.dim_retailers retailer ON retailer.id = fact.retailer_id
      WHERE fact.price >= 0
    ),
    snapshots AS (
      SELECT
        product_id,
        max(price) FILTER (WHERE retailer_key = 'coles' AND price_rank = 1) AS price_current_coles,
        max(price) FILTER (WHERE retailer_key = 'coles' AND price_rank = 2) AS price_last_coles,
        max(price) FILTER (WHERE retailer_key = 'woolworths' AND price_rank = 1) AS price_current_woolworths,
        max(price) FILTER (WHERE retailer_key = 'woolworths' AND price_rank = 2) AS price_last_woolworths,
        max(price) FILTER (WHERE retailer_key = 'aldi' AND price_rank = 1) AS price_current_aldi,
        max(price) FILTER (WHERE retailer_key = 'aldi' AND price_rank = 2) AS price_last_aldi,
        max(price) FILTER (WHERE retailer_key = 'iga' AND price_rank = 1) AS price_current_iga,
        max(price) FILTER (WHERE retailer_key = 'iga' AND price_rank = 2) AS price_last_iga,
        max(unit_price) FILTER (WHERE retailer_key = 'coles' AND price_rank = 1) AS unit_price_current_coles,
        max(unit_price) FILTER (WHERE retailer_key = 'coles' AND price_rank = 2) AS unit_price_last_coles,
        max(unit_price) FILTER (WHERE retailer_key = 'woolworths' AND price_rank = 1) AS unit_price_current_woolworths,
        max(unit_price) FILTER (WHERE retailer_key = 'woolworths' AND price_rank = 2) AS unit_price_last_woolworths,
        max(unit_price) FILTER (WHERE retailer_key = 'aldi' AND price_rank = 1) AS unit_price_current_aldi,
        max(unit_price) FILTER (WHERE retailer_key = 'aldi' AND price_rank = 2) AS unit_price_last_aldi,
        max(unit_price) FILTER (WHERE retailer_key = 'iga' AND price_rank = 1) AS unit_price_current_iga,
        max(unit_price) FILTER (WHERE retailer_key = 'iga' AND price_rank = 2) AS unit_price_last_iga
      FROM ranked
      WHERE price_rank <= 2
      GROUP BY product_id
    )
    UPDATE silver.dim_products product
    SET price_current_coles = snapshot.price_current_coles,
        price_last_coles = snapshot.price_last_coles,
        price_current_woolworths = snapshot.price_current_woolworths,
        price_last_woolworths = snapshot.price_last_woolworths,
        price_current_aldi = snapshot.price_current_aldi,
        price_last_aldi = snapshot.price_last_aldi,
        price_current_iga = snapshot.price_current_iga,
        price_last_iga = snapshot.price_last_iga,
        unit_price_current_coles = snapshot.unit_price_current_coles,
        unit_price_last_coles = snapshot.unit_price_last_coles,
        unit_price_current_woolworths = snapshot.unit_price_current_woolworths,
        unit_price_last_woolworths = snapshot.unit_price_last_woolworths,
        unit_price_current_aldi = snapshot.unit_price_current_aldi,
        unit_price_last_aldi = snapshot.unit_price_last_aldi,
        unit_price_current_iga = snapshot.unit_price_current_iga,
        unit_price_last_iga = snapshot.unit_price_last_iga,
        updated_at = CURRENT_TIMESTAMP
    FROM snapshots snapshot
    WHERE product.id = snapshot.product_id
    `);
  });
}

function createSummary(sourceCount, options) {
  return {
    sourceCount,
    scannedCount: 0,
    validCount: 0,
    migratedCount: 0,
    rejectedCount: 0,
    blockedCount: 0,
    failedCount: 0,
    warningCount: 0,
    expectedPriceCents: 0,
    expectedOnSpecialCount: 0,
    expectedRawUnitPriceCount: 0,
    expectedZeroPriceCount: 0,
    expectedRetailerCounts: {},
    lastScannedSource: options.afterId,
    partial: Boolean(options.afterId),
    scanOnly: options.scanOnly,
  };
}

function updateExpectedMetrics(summary, transformed) {
  summary.expectedPriceCents += Math.round(transformed.price.price * 100);
  if (transformed.price.isOnSpecial === true) summary.expectedOnSpecialCount += 1;
  if (transformed.price.rawUnitPrice !== null) summary.expectedRawUnitPriceCount += 1;
  if (transformed.price.price === 0) summary.expectedZeroPriceCount += 1;
  summary.expectedRetailerCounts[transformed.retailerKey] = (
    summary.expectedRetailerCounts[transformed.retailerKey] || 0
  ) + 1;
}

async function removePreviouslyMigratedPricingFact(dataSource, sourceId) {
  await dataSource.transaction(async (manager) => {
    await manager.query(
      `
        WITH migrated_fact AS MATERIALIZED (
          SELECT
            source_record.price_fact_id,
            source_record.price_recorded_at
          FROM app.product_price_source_records source_record
          WHERE source_record.source_system = 'mongodb'
            AND source_record.source_collection = 'product_pricings'
            AND source_record.source_record_id = $1
        ),
        deleted_source_record AS (
          DELETE FROM app.product_price_source_records source_record
          USING migrated_fact
          WHERE source_record.source_system = 'mongodb'
            AND source_record.source_collection = 'product_pricings'
            AND source_record.source_record_id = $1
          RETURNING
            migrated_fact.price_fact_id,
            migrated_fact.price_recorded_at
        )
        DELETE FROM silver.fct_product_prices fact
        USING deleted_source_record
        WHERE fact.id = deleted_source_record.price_fact_id
          AND fact.recorded_at = deleted_source_record.price_recorded_at
      `,
      [sourceId],
    );
  });
}

async function applyPricingBatch(context, documents) {
  const { dataSource, runId, options, references, summary } = context;
  const transformedDocuments = [];

  for (const document of documents) {
    summary.scannedCount += 1;
    summary.lastScannedSource = String(document._id);
    const transformed = transformProductPricingDocument(document);

    if (!transformed.valid) {
      summary.rejectedCount += 1;

      if (
        !options.scanOnly
        && transformed.errors.includes('product_pricing_negative_price')
      ) {
        await removePreviouslyMigratedPricingFact(dataSource, transformed.sourceId);
      }
      await recordRejected(dataSource, runId, {
        sourceCollection: 'product_pricings',
        sourceId: transformed.sourceId,
        reasons: transformed.errors,
        details: productPricingAuditPayload(document),
      });
      continue;
    }

    summary.validCount += 1;
    transformedDocuments.push(transformed);
  }

  if (options.scanOnly) {
    summary.migratedCount += transformedDocuments.length;
    summary.warningCount += transformedDocuments.reduce(
      (count, transformed) => count + transformed.warnings.length,
      0,
    );
    transformedDocuments.forEach((transformed) => updateExpectedMetrics(summary, transformed));

    return;
  }

  const rows = [];
  const successfulTransforms = [];

  for (const transformed of transformedDocuments) {
    const resolved = resolvePricingRow(transformed, references);

    if (resolved.skip) {
      summary.blockedCount += 1;
      const retailerFailure = resolved.skip.reason === 'product_pricing_retailer_not_migrated';
      await recordBlocked(dataSource, runId, {
        sourceCollection: 'product_pricings',
        sourceId: transformed.sourceId,
        sourceChecksum: transformed.sourceChecksum,
        primaryReasonCode: resolved.skip.reason,
        details: resolved.skip.detail,
        reasons: resolved.skip.reason === 'product_pricing_product_identity_conflict'
          ? [{ reason: resolved.skip.reason, detail: resolved.skip.detail }]
          : [],
      });
      await recordReferenceFailures(dataSource, runId, [{
        sourceCollection: 'product_pricings',
        sourceId: transformed.sourceId,
        sourceField: retailerFailure ? 'store_chain' : 'product_id',
        sourceValue: retailerFailure
          ? transformed.retailerKey
          : transformed.sourceProductId || transformed.productCode,
        targetSchema: 'silver',
        targetTable: retailerFailure ? 'dim_retailers' : 'dim_products',
        reason: resolved.skip.reason,
        required: true,
        details: resolved.skip.detail,
      }]);
      continue;
    }

    rows.push(resolved.row);
    successfulTransforms.push(transformed);
  }

  try {
    summary.migratedCount += await persistPricingRows(
      dataSource,
      runId,
      rows,
      successfulTransforms,
    );
    summary.warningCount += successfulTransforms.reduce(
      (count, transformed) => count + transformed.warnings.length,
      0,
    );
    successfulTransforms.forEach((transformed) => updateExpectedMetrics(summary, transformed));
  } catch (error) {
    summary.failedCount += rows.length;

    for (const transformed of successfulTransforms) {
      await recordFailed(dataSource, runId, {
        sourceCollection: 'product_pricings',
        sourceId: transformed.sourceId,
        sourceChecksum: transformed.sourceChecksum,
        error,
      });
    }

    if (options.failFast) throw error;
  }
}

async function runProductPricingPhase({
  mongoDb,
  dataSource,
  runId,
  options,
  onProgress,
}) {
  const filter = createFilter(options.afterId);
  const collection = mongoDb.collection('product_pricings');
  const sourceCount = await collection.countDocuments(filter);
  const summary = createSummary(sourceCount, options);
  const context = {
    dataSource,
    runId,
    options,
    references: options.scanOnly ? null : await loadReferenceMaps(dataSource),
    summary,
  };

  const cursor = collection.find(filter).sort({ _id: 1 }).batchSize(options.batchSize);
  let batch = [];

  for await (const document of cursor) {
    batch.push(document);

    if (batch.length >= options.batchSize) {
      await applyPricingBatch(context, batch);
      batch = [];
      await updateRunProgress(dataSource, runId, summary);
      onProgress?.(summary);
    }
  }

  if (batch.length) await applyPricingBatch(context, batch);
  if (!options.scanOnly) await refreshProductPriceSnapshots(dataSource);

  await updateRunProgress(dataSource, runId, summary);
  onProgress?.(summary);

  return summary;
}

function sortedCounts(counts) {
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
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
      ) VALUES ($1, 'product_pricing', $2, $3::jsonb, $4::jsonb, $5, $6::jsonb)
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

async function reconcileProductPricing({ dataSource, runId, sourceSummary }) {
  const factRows = await dataSource.query(`
      SELECT
        count(fact.id)::integer AS fact_count,
        count(DISTINCT source_record.source_record_id)::integer AS source_id_count,
        COALESCE(sum(round(fact.price * 100)), 0)::bigint AS price_cents,
        count(*) FILTER (WHERE fact.is_on_special = true)::integer AS on_special_count,
        count(*) FILTER (WHERE source_record.raw_unit_price IS NOT NULL)::integer AS raw_unit_price_count,
        count(*) FILTER (WHERE fact.price = 0)::integer AS zero_price_count
      FROM app.product_price_source_records source_record
      LEFT JOIN silver.fct_product_prices fact
        ON fact.id = source_record.price_fact_id
       AND fact.recorded_at = source_record.price_recorded_at
      WHERE source_record.source_system = 'mongodb'
        AND source_record.source_collection = 'product_pricings'
  `);

  const retailerRows = await dataSource.query(`
      SELECT lower(retailer.retailer_name) AS retailer_key, count(*)::integer AS price_count
      FROM app.product_price_source_records source_record
      JOIN silver.fct_product_prices fact
        ON fact.id = source_record.price_fact_id
       AND fact.recorded_at = source_record.price_recorded_at
      JOIN silver.dim_retailers retailer ON retailer.id = fact.retailer_id
      WHERE source_record.source_system = 'mongodb'
        AND source_record.source_collection = 'product_pricings'
      GROUP BY lower(retailer.retailer_name)
      ORDER BY lower(retailer.retailer_name)
  `);

  const integrityRows = await dataSource.query(`
      SELECT
        count(*) FILTER (WHERE fact.id IS NULL)::integer AS fact_dangling_references,
        count(*) FILTER (WHERE fact.id IS NOT NULL AND product.id IS NULL)::integer AS product_dangling_references,
        count(*) FILTER (WHERE fact.id IS NOT NULL AND category.id IS NULL)::integer AS category_dangling_references,
        count(*) FILTER (WHERE fact.id IS NOT NULL AND retailer.id IS NULL)::integer AS retailer_dangling_references,
        (
          SELECT count(*)
          FROM (
            SELECT price_fact_id, price_recorded_at
            FROM app.product_price_source_records
            WHERE source_system = 'mongodb'
              AND source_collection = 'product_pricings'
            GROUP BY price_fact_id, price_recorded_at
            HAVING count(*) > 1
          ) duplicate
        )::integer AS duplicate_source_groups
      FROM app.product_price_source_records source_record
      LEFT JOIN silver.fct_product_prices fact
        ON fact.id = source_record.price_fact_id
       AND fact.recorded_at = source_record.price_recorded_at
      LEFT JOIN silver.dim_products product ON product.id = fact.product_id
      LEFT JOIN silver.dim_categories category ON category.id = fact.category_id
      LEFT JOIN silver.dim_retailers retailer ON retailer.id = fact.retailer_id
      WHERE source_record.source_system = 'mongodb'
        AND source_record.source_collection = 'product_pricings'
  `);

  const snapshotRows = await dataSource.transaction(async (manager) => {
    await manager.query('SET LOCAL max_parallel_workers_per_gather = 0');

    return manager.query(`
      WITH ranked AS (
        SELECT
          fact.product_id,
          lower(retailer.retailer_name) AS retailer_key,
          fact.price,
          fact.unit_price,
          row_number() OVER (
            PARTITION BY fact.product_id, lower(retailer.retailer_name)
            ORDER BY fact.recorded_at DESC, fact.created_at DESC, fact.id DESC
          ) AS price_rank
        FROM silver.fct_product_prices fact
        JOIN silver.dim_retailers retailer ON retailer.id = fact.retailer_id
        WHERE fact.price >= 0
      ),
      expected AS (
        SELECT
          product_id,
          max(price) FILTER (WHERE retailer_key = 'coles' AND price_rank = 1) AS price_current_coles,
          max(price) FILTER (WHERE retailer_key = 'coles' AND price_rank = 2) AS price_last_coles,
          max(price) FILTER (WHERE retailer_key = 'woolworths' AND price_rank = 1) AS price_current_woolworths,
          max(price) FILTER (WHERE retailer_key = 'woolworths' AND price_rank = 2) AS price_last_woolworths,
          max(price) FILTER (WHERE retailer_key = 'aldi' AND price_rank = 1) AS price_current_aldi,
          max(price) FILTER (WHERE retailer_key = 'aldi' AND price_rank = 2) AS price_last_aldi,
          max(price) FILTER (WHERE retailer_key = 'iga' AND price_rank = 1) AS price_current_iga,
          max(price) FILTER (WHERE retailer_key = 'iga' AND price_rank = 2) AS price_last_iga,
          max(unit_price) FILTER (WHERE retailer_key = 'coles' AND price_rank = 1) AS unit_price_current_coles,
          max(unit_price) FILTER (WHERE retailer_key = 'coles' AND price_rank = 2) AS unit_price_last_coles,
          max(unit_price) FILTER (WHERE retailer_key = 'woolworths' AND price_rank = 1) AS unit_price_current_woolworths,
          max(unit_price) FILTER (WHERE retailer_key = 'woolworths' AND price_rank = 2) AS unit_price_last_woolworths,
          max(unit_price) FILTER (WHERE retailer_key = 'aldi' AND price_rank = 1) AS unit_price_current_aldi,
          max(unit_price) FILTER (WHERE retailer_key = 'aldi' AND price_rank = 2) AS unit_price_last_aldi,
          max(unit_price) FILTER (WHERE retailer_key = 'iga' AND price_rank = 1) AS unit_price_current_iga,
          max(unit_price) FILTER (WHERE retailer_key = 'iga' AND price_rank = 2) AS unit_price_last_iga
        FROM ranked
        WHERE price_rank <= 2
        GROUP BY product_id
      )
      SELECT count(*)::integer AS mismatch_count
      FROM silver.dim_products product
      LEFT JOIN expected ON expected.product_id = product.id
      WHERE product.price_current_coles IS DISTINCT FROM expected.price_current_coles
         OR product.price_last_coles IS DISTINCT FROM expected.price_last_coles
         OR product.price_current_woolworths IS DISTINCT FROM expected.price_current_woolworths
         OR product.price_last_woolworths IS DISTINCT FROM expected.price_last_woolworths
         OR product.price_current_aldi IS DISTINCT FROM expected.price_current_aldi
         OR product.price_last_aldi IS DISTINCT FROM expected.price_last_aldi
         OR product.price_current_iga IS DISTINCT FROM expected.price_current_iga
         OR product.price_last_iga IS DISTINCT FROM expected.price_last_iga
         OR product.unit_price_current_coles IS DISTINCT FROM expected.unit_price_current_coles
         OR product.unit_price_last_coles IS DISTINCT FROM expected.unit_price_last_coles
         OR product.unit_price_current_woolworths IS DISTINCT FROM expected.unit_price_current_woolworths
         OR product.unit_price_last_woolworths IS DISTINCT FROM expected.unit_price_last_woolworths
         OR product.unit_price_current_aldi IS DISTINCT FROM expected.unit_price_current_aldi
         OR product.unit_price_last_aldi IS DISTINCT FROM expected.unit_price_last_aldi
         OR product.unit_price_current_iga IS DISTINCT FROM expected.unit_price_current_iga
         OR product.unit_price_last_iga IS DISTINCT FROM expected.unit_price_last_iga
    `);
  });

  const facts = factRows[0] || {};
  const integrity = integrityRows[0] || {};
  const targetRetailerCounts = sortedCounts(Object.fromEntries(
    retailerRows.map((row) => [row.retailer_key, Number(row.price_count)]),
  ));

  const sourceRetailerCounts = sortedCounts(sourceSummary.expectedRetailerCounts);
  const factCount = Number(facts.fact_count || 0);
  const sourceIdCount = Number(facts.source_id_count || 0);
  const targetPriceCents = Number(facts.price_cents || 0);
  const danglingReferenceCount = Number(integrity.fact_dangling_references || 0)
    + Number(integrity.product_dangling_references || 0)
    + Number(integrity.category_dangling_references || 0)
    + Number(integrity.retailer_dangling_references || 0);

  const duplicateSourceGroups = Number(integrity.duplicate_source_groups || 0);
  const snapshotMismatchCount = Number(snapshotRows[0]?.mismatch_count || 0);
  const results = [
    {
      checkName: 'product_pricing_references_resolve',
      sourceValue: { expectedDanglingReferences: 0 },
      targetValue: { danglingReferenceCount },
      passed: danglingReferenceCount === 0,
    },
    {
      checkName: 'product_pricing_source_ids_unique',
      sourceValue: { expectedDuplicateGroups: 0 },
      targetValue: { duplicateSourceGroups },
      passed: duplicateSourceGroups === 0 && factCount === sourceIdCount,
    },
    {
      checkName: 'product_price_snapshots_are_current',
      sourceValue: { expectedMismatches: 0 },
      targetValue: { snapshotMismatchCount },
      passed: snapshotMismatchCount === 0,
    },
  ];

  if (!sourceSummary.partial) {
    results.push(
      {
        checkName: 'migrated_product_pricing_count_matches',
        sourceValue: { migratedPrices: sourceSummary.migratedCount },
        targetValue: { facts: factCount, sourceIds: sourceIdCount },
        passed: sourceSummary.migratedCount === factCount
          && sourceSummary.migratedCount === sourceIdCount,
      },
      {
        checkName: 'product_pricing_amounts_match',
        sourceValue: {
          priceCents: sourceSummary.expectedPriceCents,
          zeroPrices: sourceSummary.expectedZeroPriceCount,
        },
        targetValue: {
          priceCents: targetPriceCents,
          zeroPrices: Number(facts.zero_price_count || 0),
        },
        passed: sourceSummary.expectedPriceCents === targetPriceCents
          && sourceSummary.expectedZeroPriceCount
            === Number(facts.zero_price_count || 0),
      },
      {
        checkName: 'product_pricing_flags_and_raw_units_match',
        sourceValue: {
          onSpecial: sourceSummary.expectedOnSpecialCount,
          rawUnitPrices: sourceSummary.expectedRawUnitPriceCount,
        },
        targetValue: {
          onSpecial: Number(facts.on_special_count || 0),
          rawUnitPrices: Number(facts.raw_unit_price_count || 0),
        },
        passed: sourceSummary.expectedOnSpecialCount
            === Number(facts.on_special_count || 0)
          && sourceSummary.expectedRawUnitPriceCount
            === Number(facts.raw_unit_price_count || 0),
      },
      {
        checkName: 'product_pricing_retailer_counts_match',
        sourceValue: sourceRetailerCounts,
        targetValue: targetRetailerCounts,
        passed: JSON.stringify(sourceRetailerCounts) === JSON.stringify(targetRetailerCounts),
      },
    );
  }

  for (const result of results) {
    await insertReconciliationResult(dataSource, runId, result);
  }

  return { passed: results.every((result) => result.passed), results };
}

module.exports = {
  reconcileProductPricing,
  refreshProductPriceSnapshots,
  runProductPricingPhase,
};
