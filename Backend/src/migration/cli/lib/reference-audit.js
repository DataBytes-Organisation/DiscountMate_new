function normalizeFailure(failure) {
  return {
    sourceSystem: failure.sourceSystem || 'mongodb',
    sourceCollection: failure.sourceCollection,
    sourceId: failure.sourceId || null,
    sourceField: failure.sourceField,
    sourceValue: failure.sourceValue === undefined || failure.sourceValue === null
      ? null
      : String(failure.sourceValue),
    targetSchema: failure.targetSchema,
    targetTable: failure.targetTable,
    targetField: failure.targetField || 'id',
    reason: failure.reason || 'target_not_found',
    required: Boolean(failure.required),
    details: failure.details || {},
  };
}

async function recordReferenceFailure(dataSource, runId, failure) {
  if (!dataSource || !runId) return;

  const normalized = normalizeFailure(failure);

  await dataSource.query(
    `
      INSERT INTO migration.reference_resolution_failures (
        migration_run_id,
        source_system,
        source_collection,
        source_id,
        source_field,
        source_value,
        target_schema,
        target_table,
        target_field,
        reason,
        required,
        details
      )
      SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb
      WHERE NOT EXISTS (
        SELECT 1
        FROM migration.reference_resolution_failures existing
        WHERE existing.source_system = $2
          AND existing.source_collection = $3
          AND existing.source_id IS NOT DISTINCT FROM $4
          AND existing.source_field = $5
          AND existing.source_value IS NOT DISTINCT FROM $6
          AND existing.target_schema = $7
          AND existing.target_table = $8
          AND existing.target_field = $9
          AND existing.reason = $10
          AND existing.resolved_at IS NULL
      )
    `,
    [
      runId,
      normalized.sourceSystem,
      normalized.sourceCollection,
      normalized.sourceId,
      normalized.sourceField,
      normalized.sourceValue,
      normalized.targetSchema,
      normalized.targetTable,
      normalized.targetField,
      normalized.reason,
      normalized.required,
      JSON.stringify(normalized.details),
    ],
  );
}

async function recordReferenceFailures(dataSource, runId, failures = []) {
  for (const failure of failures) {
    await recordReferenceFailure(dataSource, runId, failure);
  }
}

async function resolveKnownReferenceFailures(dataSource) {
  if (!dataSource) return;

  await dataSource.query(`
    UPDATE migration.reference_resolution_failures failure
    SET resolved_target_id = source_key.entity_id,
        resolved_at = CURRENT_TIMESTAMP
    FROM app.catalog_source_keys source_key
    WHERE failure.resolved_at IS NULL
      AND failure.target_schema = 'silver'
      AND failure.target_table IN ('dim_products', 'dim_categories')
      AND source_key.entity_type = CASE failure.target_table
        WHEN 'dim_products' THEN 'product'
        ELSE 'category'
      END
      AND source_key.identifier_value = failure.source_value
  `);

  await dataSource.query(`
    UPDATE migration.reference_resolution_failures failure
    SET resolved_target_id = retailer.id,
        resolved_at = CURRENT_TIMESTAMP
    FROM silver.dim_retailers retailer
    WHERE failure.resolved_at IS NULL
      AND failure.target_schema = 'silver'
      AND failure.target_table = 'dim_retailers'
      AND lower(retailer.retailer_name) = lower(failure.source_value)
  `);

  await dataSource.query(`
    UPDATE migration.reference_resolution_failures failure
    SET resolved_target_id = category.id,
        resolved_at = CURRENT_TIMESTAMP
    FROM silver.dim_categories category
    WHERE failure.resolved_at IS NULL
      AND failure.target_schema = 'silver'
      AND failure.target_table = 'dim_categories'
      AND lower(category.category_name) = lower(failure.source_value)
  `);

  await dataSource.query(`
    UPDATE migration.reference_resolution_failures failure
    SET resolved_target_id = map.target_id,
        resolved_at = CURRENT_TIMESTAMP
    FROM migration.entity_id_map map
    WHERE failure.resolved_at IS NULL
      AND failure.target_schema = map.target_schema
      AND failure.target_table = map.target_table
      AND failure.source_value = map.source_id
      AND map.source_system = failure.source_system
  `);
}

module.exports = {
  normalizeFailure,
  recordReferenceFailure,
  recordReferenceFailures,
  resolveKnownReferenceFailures,
};
