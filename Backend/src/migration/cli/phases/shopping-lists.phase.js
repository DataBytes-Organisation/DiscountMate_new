const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const {
  pricingSnapshotAuditPayload,
  shoppingListAuditPayload,
  transformPricingSnapshotDocument,
  transformShoppingListDocument,
} = require('../lib/shopping-list-transform');

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

async function findMappedId(manager, sourceCollection, sourceId, targetTable) {
  if (!sourceId) return null;

  const rows = await manager.query(
    `
      SELECT target_id
      FROM migration.entity_id_map
      WHERE source_system = 'mongodb'
        AND source_collection = $1
        AND source_id = $2
        AND target_schema = $3
        AND target_table = $4
    `,
    [
      sourceCollection,
      sourceId,
      targetTable.startsWith('dim_') ? 'silver' : 'app',
      targetTable,
    ],
  );

  return rows[0]?.target_id || null;
}

async function resolveUserId(manager, ownerSourceId, ownerEmail = '') {
  const mappedId = await findMappedId(manager, 'users', ownerSourceId, 'users');
  const emailRows = ownerEmail
    ? await manager.query('SELECT id FROM app.users WHERE email = $1', [ownerEmail])
    : [];

  const emailUserId = emailRows[0]?.id || null;

  if (mappedId && emailUserId && mappedId !== emailUserId) {
    throw new MigrationSkipError('snapshot_owner_conflict', {
      ownerSourceId,
      ownerEmail,
      mappedId,
      emailUserId,
    });
  }

  const userId = mappedId || emailUserId;

  if (!userId) {
    throw new MigrationSkipError('missing_migrated_user_owner', {
      ownerSourceId: ownerSourceId || null,
      hasOwnerEmail: Boolean(ownerEmail),
    });
  }

  return userId;
}

async function findTargetId(manager, sourceCollection, sourceId, targetTable) {
  return await findMappedId(manager, sourceCollection, sourceId, targetTable)
    || crypto.randomUUID();
}

async function upsertIdMap(
  manager,
  runId,
  sourceCollection,
  sourceId,
  targetTable,
  targetId,
  sourceChecksum,
) {
  await manager.query(
    `
      INSERT INTO migration.entity_id_map (
        source_system,
        source_collection,
        source_id,
        target_schema,
        target_table,
        target_id,
        migration_run_id,
        source_checksum,
        migrated_at
      ) VALUES ('mongodb', $1, $2, 'app', $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (
        source_system,
        source_collection,
        source_id,
        target_schema,
        target_table
      ) DO UPDATE SET
        target_id = EXCLUDED.target_id,
        migration_run_id = EXCLUDED.migration_run_id,
        source_checksum = EXCLUDED.source_checksum,
        migrated_at = CURRENT_TIMESTAMP
    `,
    [sourceCollection, sourceId, targetTable, targetId, runId, sourceChecksum],
  );
}

async function loadReferenceMaps(dataSource) {
  const [retailers, categories, productMappings, categoryMappings] = await Promise.all([
    dataSource.query('SELECT id, retailer_name FROM silver.dim_retailers'),
    dataSource.query('SELECT id, category_name FROM silver.dim_categories'),
    dataSource.query(`
      SELECT
        source_key.identifier_value AS source_id,
        min(source_key.entity_id::text)::uuid AS target_id
      FROM app.catalog_source_keys source_key
      JOIN silver.dim_products product ON product.id = source_key.entity_id
      WHERE source_key.entity_type = 'product'
        AND source_key.source_system = 'mongodb'
        AND source_key.source_collection = 'products'
      GROUP BY source_key.identifier_value
      HAVING count(DISTINCT source_key.entity_id) = 1
    `),
    dataSource.query(`
      SELECT
        source_key.identifier_value AS source_id,
        min(source_key.entity_id::text)::uuid AS target_id
      FROM app.catalog_source_keys source_key
      JOIN silver.dim_categories category ON category.id = source_key.entity_id
      WHERE source_key.entity_type = 'category'
        AND source_key.source_system = 'mongodb'
        AND source_key.source_collection = 'categories'
      GROUP BY source_key.identifier_value
      HAVING count(DISTINCT source_key.entity_id) = 1
    `),
  ]);

  return {
    retailerByKey: new Map(
      retailers.map((row) => [String(row.retailer_name).toLowerCase(), row.id]),
    ),
    categoryByName: new Map(
      categories.map((row) => [String(row.category_name).toLowerCase(), row.id]),
    ),
    productBySourceId: new Map(
      productMappings.map((row) => [String(row.source_id), row.target_id]),
    ),
    categoryBySourceId: new Map(
      categoryMappings.map((row) => [String(row.source_id), row.target_id]),
    ),
  };
}

async function persistShoppingList(dataSource, runId, transformed, references) {
  return dataSource.transaction(async (manager) => {
    const userId = await resolveUserId(manager, transformed.ownerSourceId);
    const listId = await findTargetId(
      manager,
      'shopping_lists',
      transformed.sourceId,
      'shopping_lists',
    );

    const { list } = transformed;

    if (list.isActive) {
      await manager.query(
        `
          UPDATE app.shopping_lists
          SET is_active = false,
              updated_at = GREATEST(updated_at, $2)
          WHERE user_id = $1 AND id <> $3 AND is_active = true
        `,
        [userId, list.updatedAt, listId],
      );
    }

    await manager.query(
      `
        INSERT INTO app.shopping_lists (
          id, user_id, name, description, accent, is_active,
          total, savings, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          accent = EXCLUDED.accent,
          is_active = EXCLUDED.is_active,
          total = EXCLUDED.total,
          savings = EXCLUDED.savings,
          updated_at = EXCLUDED.updated_at
      `,
      [
        listId,
        userId,
        list.name,
        list.description,
        list.accent,
        list.isActive,
        list.total,
        list.savings,
        list.createdAt,
        list.updatedAt,
      ],
    );

    await manager.query(
      'DELETE FROM app.shopping_list_items WHERE shopping_list_id = $1',
      [listId],
    );

    let matchedProductCount = 0;
    const unresolvedReferences = [];

    for (const item of transformed.items) {
      const productId = references.productBySourceId.get(item.legacyProductIdentifier) || null;
      const categoryId = (
        references.categoryBySourceId.get(item.legacyCategoryIdentifier)
        || references.categoryByName.get(String(item.categoryName || '').toLowerCase())
        || null
      );

      const retailerId = references.retailerByKey.get(item.selectedRetailerKey) || null;

      if (productId) matchedProductCount += 1;

      if (!productId) {
        unresolvedReferences.push({
          sourceCollection: 'shopping_lists',
          sourceId: transformed.sourceId,
          sourceField: `items[${item.lineNumber - 1}].product_id`,
          sourceValue: item.legacyProductIdentifier,
          targetSchema: 'silver',
          targetTable: 'dim_products',
          reason: 'product_not_migrated',
          required: false,
          details: { lineNumber: item.lineNumber },
        });
      }

      if (!categoryId && (item.legacyCategoryIdentifier || item.categoryName)) {
        unresolvedReferences.push({
          sourceCollection: 'shopping_lists',
          sourceId: transformed.sourceId,
          sourceField: `items[${item.lineNumber - 1}].category_id`,
          sourceValue: item.legacyCategoryIdentifier || item.categoryName,
          targetSchema: 'silver',
          targetTable: 'dim_categories',
          reason: 'category_not_migrated',
          required: false,
          details: { lineNumber: item.lineNumber },
        });
      }

      if (!retailerId && item.selectedRetailerKey) {
        unresolvedReferences.push({
          sourceCollection: 'shopping_lists',
          sourceId: transformed.sourceId,
          sourceField: `items[${item.lineNumber - 1}].store`,
          sourceValue: item.selectedRetailerKey,
          targetSchema: 'silver',
          targetTable: 'dim_retailers',
          reason: 'retailer_not_migrated',
          required: false,
          details: { lineNumber: item.lineNumber },
        });
      }

      await manager.query(
        `
          INSERT INTO app.shopping_list_items (
            id,
            shopping_list_id,
            line_number,
            product_id,
            legacy_product_identifier,
            product_name,
            quantity,
            unit_price,
            retailer_id,
            selected_retailer_key,
            image_url,
            category_id,
            legacy_category_identifier,
            category_name,
            retailer_prices,
            raw_payload,
            created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
            $13, $14, $15::jsonb, $16::jsonb, $17
          )
        `,
        [
          crypto.randomUUID(),
          listId,
          item.lineNumber,
          productId,
          item.legacyProductIdentifier,
          item.productName,
          item.quantity,
          item.unitPrice,
          retailerId,
          item.selectedRetailerKey,
          item.imageUrl,
          categoryId,
          item.legacyCategoryIdentifier,
          item.categoryName,
          JSON.stringify(item.retailerPrices),
          JSON.stringify(item.rawPayload),
          list.createdAt,
        ],
      );
    }

    await upsertIdMap(
      manager,
      runId,
      'shopping_lists',
      transformed.sourceId,
      'shopping_lists',
      listId,
      transformed.sourceChecksum,
    );

    return {
      itemCount: transformed.items.length,
      matchedProductCount,
      unresolvedReferences,
    };
  });
}

async function persistPricingSnapshot(dataSource, runId, transformed, references) {
  return dataSource.transaction(async (manager) => {
    const mappedListId = await findMappedId(
      manager,
      'shopping_lists',
      transformed.listSourceId,
      'shopping_lists',
    );

    const listRows = mappedListId
      ? await manager.query('SELECT user_id FROM app.shopping_lists WHERE id = $1', [mappedListId])
      : [];

    const listUserId = listRows[0]?.user_id || null;
    const resolvedOwnerId = await resolveUserId(
      manager,
      transformed.ownerSourceId,
      transformed.ownerEmail,
    );

    if (listUserId && listUserId !== resolvedOwnerId) {
      throw new MigrationSkipError('snapshot_list_owner_conflict', {
        listSourceId: transformed.listSourceId,
      });
    }

    const snapshotId = await findTargetId(
      manager,
      'list_pricing_snapshots',
      transformed.sourceId,
      'list_pricing_snapshots',
    );

    const snapshot = transformed.snapshot;
    const retailerId = (key) => references.retailerByKey.get(key) || null;
    const unresolvedReferences = [];

    if (!mappedListId) {
      unresolvedReferences.push({
        sourceCollection: 'list_pricing_snapshots',
        sourceId: transformed.sourceId,
        sourceField: 'shopping_list_id',
        sourceValue: transformed.listSourceId,
        targetSchema: 'app',
        targetTable: 'shopping_lists',
        reason: 'shopping_list_not_migrated',
        required: false,
      });
    }

    for (const [sourceField, retailerKey] of [
      ['selected_retailer', snapshot.selectedRetailerKey],
      ['cheapest_retailer', snapshot.cheapestRetailerKey],
      ['highest_retailer', snapshot.highestRetailerKey],
    ]) {
      if (retailerKey && !retailerId(retailerKey)) {
        unresolvedReferences.push({
          sourceCollection: 'list_pricing_snapshots',
          sourceId: transformed.sourceId,
          sourceField,
          sourceValue: retailerKey,
          targetSchema: 'silver',
          targetTable: 'dim_retailers',
          reason: 'retailer_not_migrated',
          required: false,
        });
      }
    }

    await manager.query(
      `
        INSERT INTO app.list_pricing_snapshots (
          id,
          user_id,
          shopping_list_id,
          legacy_shopping_list_id,
          list_name,
          selected_retailer_id,
          selected_retailer_key,
          retailer_totals,
          comparison_status,
          comparable_retailer_count,
          available_retailers,
          cheapest_retailer_id,
          cheapest_retailer_key,
          cheapest_total,
          highest_retailer_id,
          highest_retailer_key,
          highest_total,
          selected_total,
          total_saved,
          savings_rate,
          comparison_label,
          item_count,
          source,
          raw_payload,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11::text[],
          $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
          $24::jsonb, $25, $26
        )
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          shopping_list_id = EXCLUDED.shopping_list_id,
          legacy_shopping_list_id = EXCLUDED.legacy_shopping_list_id,
          list_name = EXCLUDED.list_name,
          selected_retailer_id = EXCLUDED.selected_retailer_id,
          selected_retailer_key = EXCLUDED.selected_retailer_key,
          retailer_totals = EXCLUDED.retailer_totals,
          comparison_status = EXCLUDED.comparison_status,
          comparable_retailer_count = EXCLUDED.comparable_retailer_count,
          available_retailers = EXCLUDED.available_retailers,
          cheapest_retailer_id = EXCLUDED.cheapest_retailer_id,
          cheapest_retailer_key = EXCLUDED.cheapest_retailer_key,
          cheapest_total = EXCLUDED.cheapest_total,
          highest_retailer_id = EXCLUDED.highest_retailer_id,
          highest_retailer_key = EXCLUDED.highest_retailer_key,
          highest_total = EXCLUDED.highest_total,
          selected_total = EXCLUDED.selected_total,
          total_saved = EXCLUDED.total_saved,
          savings_rate = EXCLUDED.savings_rate,
          comparison_label = EXCLUDED.comparison_label,
          item_count = EXCLUDED.item_count,
          source = EXCLUDED.source,
          raw_payload = EXCLUDED.raw_payload,
          updated_at = EXCLUDED.updated_at
      `,
      [
        snapshotId,
        listUserId || resolvedOwnerId,
        mappedListId,
        transformed.listSourceId,
        snapshot.listName,
        retailerId(snapshot.selectedRetailerKey),
        snapshot.selectedRetailerKey,
        JSON.stringify(snapshot.retailerTotals),
        snapshot.comparisonStatus,
        snapshot.comparableRetailerCount,
        snapshot.availableRetailers,
        retailerId(snapshot.cheapestRetailerKey),
        snapshot.cheapestRetailerKey,
        snapshot.cheapestTotal,
        retailerId(snapshot.highestRetailerKey),
        snapshot.highestRetailerKey,
        snapshot.highestTotal,
        snapshot.selectedTotal,
        snapshot.totalSaved,
        snapshot.savingsRate,
        snapshot.comparisonLabel,
        snapshot.itemCount,
        snapshot.source,
        JSON.stringify(snapshot.rawPayload),
        snapshot.createdAt,
        snapshot.updatedAt,
      ],
    );

    await upsertIdMap(
      manager,
      runId,
      'list_pricing_snapshots',
      transformed.sourceId,
      'list_pricing_snapshots',
      snapshotId,
      transformed.sourceChecksum,
    );

    return { preservedWithoutList: !mappedListId, unresolvedReferences };
  });
}

function createMongoFilter(afterId) {
  if (!afterId) return {};

  if (!ObjectId.isValid(afterId) || !/^[0-9a-fA-F]{24}$/.test(afterId)) {
    throw new Error('--after-id must be a 24-character Mongo ObjectId');
  }

  return { _id: { $gt: new ObjectId(afterId) } };
}

async function loadActiveSourceIds(collection) {
  const rows = await collection.aggregate([
    {
      $match: {
        $or: [
          { user_id: { $exists: true, $ne: null } },
          { userId: { $exists: true, $ne: null } },
        ],
      },
    },
    { $addFields: { migration_owner: { $ifNull: ['$user_id', '$userId'] } } },
    { $sort: { is_active: -1, updated_at: -1, created_at: -1, _id: -1 } },
    { $group: { _id: '$migration_owner', sourceId: { $first: '$_id' } } },
  ]).toArray();

  return new Map(rows.map((row) => [String(row._id), String(row.sourceId)]));
}

async function synchronizeDerivedUserFields(dataSource, runId) {
  await dataSource.query(`
    UPDATE app.user_dashboard_preferences preferences
    SET selected_list_id = map.target_id,
        updated_at = CURRENT_TIMESTAMP
    FROM migration.entity_id_map map
    WHERE map.source_system = 'mongodb'
      AND map.source_collection = 'shopping_lists'
      AND map.source_id = preferences.legacy_selected_list_id
      AND map.target_schema = 'app'
      AND map.target_table = 'shopping_lists'
  `);

  await recordReferenceFailures(
    dataSource,
    runId,
    (await dataSource.query(`
      SELECT
        map.source_id AS source_id,
        preferences.legacy_selected_list_id AS source_value
      FROM app.user_dashboard_preferences preferences
      JOIN migration.entity_id_map map
        ON map.source_system = 'mongodb'
       AND map.source_collection = 'users'
       AND map.target_schema = 'app'
       AND map.target_table = 'users'
       AND map.target_id = preferences.user_id
      WHERE preferences.legacy_selected_list_id IS NOT NULL
        AND preferences.selected_list_id IS NULL
    `)).map((row) => ({
      sourceCollection: 'users',
      sourceId: row.source_id,
      sourceField: 'dashboard_preferences.selected_dashboard_list_id',
      sourceValue: row.source_value,
      targetSchema: 'app',
      targetTable: 'shopping_lists',
      reason: 'shopping_list_not_migrated',
      required: false,
    })),
  );

  await dataSource.query(`
    UPDATE app.user_legacy_metrics metrics
    SET shopping_lists_count = (
          SELECT count(*)::integer
          FROM app.shopping_lists list
          WHERE list.user_id = metrics.user_id
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE EXISTS (
      SELECT 1
      FROM migration.entity_id_map map
      WHERE map.source_system = 'mongodb'
        AND map.source_collection = 'users'
        AND map.target_schema = 'app'
        AND map.target_table = 'users'
        AND map.target_id = metrics.user_id
    )
  `);
}

async function synchronizeRemovedSources(dataSource, runId, summary) {
  if (summary.partial || summary.skippedCount > 0 || summary.failedCount > 0) return;

  await dataSource.transaction(async (manager) => {
    await manager.query(`
      DELETE FROM app.list_pricing_snapshots snapshot
      USING migration.entity_id_map map
      WHERE map.source_system = 'mongodb'
        AND map.source_collection = 'list_pricing_snapshots'
        AND map.target_schema = 'app'
        AND map.target_table = 'list_pricing_snapshots'
        AND map.target_id = snapshot.id
        AND map.migration_run_id IS DISTINCT FROM $1
    `, [runId]);

    await manager.query(`
      DELETE FROM migration.entity_id_map
      WHERE source_system = 'mongodb'
        AND source_collection = 'list_pricing_snapshots'
        AND target_schema = 'app'
        AND target_table = 'list_pricing_snapshots'
        AND migration_run_id IS DISTINCT FROM $1
    `, [runId]);

    await manager.query(`
      DELETE FROM app.shopping_lists list
      USING migration.entity_id_map map
      WHERE map.source_system = 'mongodb'
        AND map.source_collection = 'shopping_lists'
        AND map.target_schema = 'app'
        AND map.target_table = 'shopping_lists'
        AND map.target_id = list.id
        AND map.migration_run_id IS DISTINCT FROM $1
    `, [runId]);

    await manager.query(`
      DELETE FROM migration.entity_id_map
      WHERE source_system = 'mongodb'
        AND source_collection = 'shopping_lists'
        AND target_schema = 'app'
        AND target_table = 'shopping_lists'
        AND migration_run_id IS DISTINCT FROM $1
    `, [runId]);
  });
}

async function runShoppingListsPhase({ mongoDb, dataSource, runId, options, onProgress }) {
  const filter = createMongoFilter(options.afterId);
  const lists = mongoDb.collection('shopping_lists');
  const snapshots = mongoDb.collection('list_pricing_snapshots');
  const [listSourceCount, snapshotSourceCount, activeSourceByOwner] = await Promise.all([
    lists.countDocuments(filter),
    snapshots.countDocuments(),
    loadActiveSourceIds(lists),
  ]);

  const references = dataSource ? await loadReferenceMaps(dataSource) : null;
  const summary = {
    sourceCount: listSourceCount + snapshotSourceCount,
    listSourceCount,
    snapshotSourceCount,
    scannedCount: 0,
    validCount: 0,
    targetCount: 0,
    targetListCount: 0,
    targetSnapshotCount: 0,
    skippedCount: 0,
    failedCount: 0,
    expectedItemCount: 0,
    matchedProductItemCount: 0,
    snapshotsWithoutListCount: 0,
    lastScannedSource: options.afterId ? `shopping_lists:${options.afterId}` : null,
    partial: Boolean(options.afterId),
    scanOnly: options.scanOnly,
  };

  const listCursor = lists.find(filter).sort({ _id: 1 }).batchSize(options.batchSize);

  for await (const document of listCursor) {
    summary.scannedCount += 1;
    summary.lastScannedSource = `shopping_lists:${document._id}`;
    const ownerSourceId = String(document.user_id || document.userId || '');
    const transformed = transformShoppingListDocument(
      document,
      activeSourceByOwner.get(ownerSourceId) || null,
    );

    if (!transformed.valid) {
      summary.skippedCount += 1;
      await recordUnmapped(
        dataSource,
        runId,
        'shopping_lists',
        transformed.sourceId,
        transformed.errors.join(','),
        shoppingListAuditPayload(document),
      );
    } else {
      summary.validCount += 1;
      summary.expectedItemCount += transformed.items.length;

      if (options.scanOnly) {
        summary.targetCount += 1;
        summary.targetListCount += 1;
      } else {
        try {
          const persisted = await persistShoppingList(
            dataSource,
            runId,
            transformed,
            references,
          );
          summary.targetCount += 1;
          summary.targetListCount += 1;
          summary.matchedProductItemCount += persisted.matchedProductCount;
          await recordReferenceFailures(
            dataSource,
            runId,
            persisted.unresolvedReferences,
          );

          for (const warning of transformed.warnings) {
            await recordUnmapped(
              dataSource,
              runId,
              'shopping_lists',
              transformed.sourceId,
              warning.reason,
              warning.detail,
            );
          }
        } catch (error) {
          if (error instanceof MigrationSkipError) {
            summary.skippedCount += 1;

            if (error.reason === 'missing_migrated_user_owner') {
              await recordReferenceFailures(dataSource, runId, [{
                sourceCollection: 'shopping_lists',
                sourceId: transformed.sourceId,
                sourceField: 'user_id',
                sourceValue: transformed.ownerSourceId,
                targetSchema: 'app',
                targetTable: 'users',
                reason: error.reason,
                required: true,
              }]);
            }
            await recordUnmapped(
              dataSource,
              runId,
              'shopping_lists',
              transformed.sourceId,
              error.reason,
              error.detail,
            );
          } else {
            summary.failedCount += 1;
            await recordUnmapped(
              dataSource,
              runId,
              'shopping_lists',
              transformed.sourceId,
              'unexpected_migration_error',
              { name: error.name, message: error.message },
            );
            if (options.failFast) throw error;
          }
        }
      }
    }

    if (summary.scannedCount % options.batchSize === 0) {
      await updateRunProgress(dataSource, runId, summary);
      onProgress?.(summary);
    }
  }

  const snapshotCursor = snapshots.find({}).sort({ _id: 1 }).batchSize(options.batchSize);

  for await (const document of snapshotCursor) {
    summary.scannedCount += 1;
    summary.lastScannedSource = `list_pricing_snapshots:${document._id}`;
    const transformed = transformPricingSnapshotDocument(document);

    if (!transformed.valid) {
      summary.skippedCount += 1;
      await recordUnmapped(
        dataSource,
        runId,
        'list_pricing_snapshots',
        transformed.sourceId,
        transformed.errors.join(','),
        pricingSnapshotAuditPayload(document),
      );
    } else {
      summary.validCount += 1;

      if (options.scanOnly) {
        summary.targetCount += 1;
        summary.targetSnapshotCount += 1;
      } else {
        try {
          const persisted = await persistPricingSnapshot(
            dataSource,
            runId,
            transformed,
            references,
          );
          summary.targetCount += 1;
          summary.targetSnapshotCount += 1;
          await recordReferenceFailures(
            dataSource,
            runId,
            persisted.unresolvedReferences,
          );

          if (persisted.preservedWithoutList) {
            summary.snapshotsWithoutListCount += 1;
            await recordUnmapped(
              dataSource,
              runId,
              'list_pricing_snapshots',
              transformed.sourceId,
              'snapshot_list_not_migrated',
              { listSourceId: transformed.listSourceId },
            );
          }
        } catch (error) {
          if (error instanceof MigrationSkipError) {
            summary.skippedCount += 1;

            if (error.reason === 'missing_migrated_user_owner') {
              await recordReferenceFailures(dataSource, runId, [{
                sourceCollection: 'list_pricing_snapshots',
                sourceId: transformed.sourceId,
                sourceField: 'user_id',
                sourceValue: transformed.ownerSourceId || null,
                targetSchema: 'app',
                targetTable: 'users',
                reason: error.reason,
                required: true,
                details: { hasOwnerEmail: Boolean(transformed.ownerEmail) },
              }]);
            }
            await recordUnmapped(
              dataSource,
              runId,
              'list_pricing_snapshots',
              transformed.sourceId,
              error.reason,
              error.detail,
            );
          } else {
            summary.failedCount += 1;
            await recordUnmapped(
              dataSource,
              runId,
              'list_pricing_snapshots',
              transformed.sourceId,
              'unexpected_migration_error',
              { name: error.name, message: error.message },
            );
            if (options.failFast) throw error;
          }
        }
      }
    }

    if (summary.scannedCount % options.batchSize === 0) {
      await updateRunProgress(dataSource, runId, summary);
      onProgress?.(summary);
    }
  }

  if (!options.scanOnly) {
    await synchronizeRemovedSources(dataSource, runId, summary);
    await synchronizeDerivedUserFields(dataSource, runId);
  }

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
      ) VALUES ($1, 'shopping_lists', $2, $3::jsonb, $4::jsonb, $5, $6::jsonb)
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

async function reconcileShoppingLists({ dataSource, runId, sourceSummary }) {
  const [listRows, snapshotRows, itemRows, integrityRows, activeRows, dashboardRows] = await Promise.all([
    dataSource.query(`
      SELECT count(*)::integer AS mapped_count, count(list.id)::integer AS target_count
      FROM migration.entity_id_map map
      LEFT JOIN app.shopping_lists list ON list.id = map.target_id
      WHERE map.source_system = 'mongodb'
        AND map.source_collection = 'shopping_lists'
        AND map.target_schema = 'app'
        AND map.target_table = 'shopping_lists'
    `),
    dataSource.query(`
      SELECT count(*)::integer AS mapped_count, count(snapshot.id)::integer AS target_count
      FROM migration.entity_id_map map
      LEFT JOIN app.list_pricing_snapshots snapshot ON snapshot.id = map.target_id
      WHERE map.source_system = 'mongodb'
        AND map.source_collection = 'list_pricing_snapshots'
        AND map.target_schema = 'app'
        AND map.target_table = 'list_pricing_snapshots'
    `),
    dataSource.query(`
      SELECT count(item.id)::integer AS item_count
      FROM migration.entity_id_map map
      JOIN app.shopping_lists list ON list.id = map.target_id
      LEFT JOIN app.shopping_list_items item ON item.shopping_list_id = list.id
      WHERE map.source_system = 'mongodb'
        AND map.source_collection = 'shopping_lists'
        AND map.target_schema = 'app'
        AND map.target_table = 'shopping_lists'
    `),
    dataSource.query(`
      SELECT (
        (SELECT count(*) FROM app.shopping_list_items item LEFT JOIN app.shopping_lists list ON list.id = item.shopping_list_id WHERE list.id IS NULL)
        + (SELECT count(*) FROM app.list_pricing_snapshots snapshot LEFT JOIN app.users users ON users.id = snapshot.user_id WHERE users.id IS NULL)
      )::integer AS dangling_reference_count
    `),
    dataSource.query(`
      SELECT count(*)::integer AS users_with_multiple_active
      FROM (
        SELECT user_id
        FROM app.shopping_lists
        WHERE is_active = true
        GROUP BY user_id
        HAVING count(*) > 1
      ) violations
    `),
    dataSource.query(`
      SELECT count(*)::integer AS mismatch_count
      FROM app.user_dashboard_preferences preferences
      JOIN migration.entity_id_map map
        ON map.source_system = 'mongodb'
       AND map.source_collection = 'shopping_lists'
       AND map.source_id = preferences.legacy_selected_list_id
       AND map.target_schema = 'app'
       AND map.target_table = 'shopping_lists'
      WHERE preferences.selected_list_id IS DISTINCT FROM map.target_id
    `),
  ]);

  const mappedLists = Number(listRows[0]?.mapped_count || 0);
  const targetLists = Number(listRows[0]?.target_count || 0);
  const mappedSnapshots = Number(snapshotRows[0]?.mapped_count || 0);
  const targetSnapshots = Number(snapshotRows[0]?.target_count || 0);
  const targetItems = Number(itemRows[0]?.item_count || 0);
  const danglingReferenceCount = Number(
    integrityRows[0]?.dangling_reference_count || 0,
  );
  const activeViolations = Number(activeRows[0]?.users_with_multiple_active || 0);
  const dashboardMismatches = Number(dashboardRows[0]?.mismatch_count || 0);
  const results = [
    {
      checkName: 'all_list_mappings_resolve',
      sourceValue: { mappedLists },
      targetValue: { targetLists },
      passed: mappedLists === targetLists,
    },
    {
      checkName: 'all_snapshot_mappings_resolve',
      sourceValue: { mappedSnapshots },
      targetValue: { targetSnapshots },
      passed: mappedSnapshots === targetSnapshots,
    },
    {
      checkName: 'no_dangling_list_children',
      sourceValue: { expected: 0 },
      targetValue: { danglingReferenceCount },
      passed: danglingReferenceCount === 0,
    },
    {
      checkName: 'at_most_one_active_list_per_user',
      sourceValue: { expected: 0 },
      targetValue: { activeViolations },
      passed: activeViolations === 0,
    },
    {
      checkName: 'dashboard_list_references_resolved',
      sourceValue: { expected: 0 },
      targetValue: { dashboardMismatches },
      passed: dashboardMismatches === 0,
    },
  ];

  if (!sourceSummary.partial) {
    results.push(
      {
        checkName: 'source_list_count_matches',
        sourceValue: { lists: sourceSummary.listSourceCount },
        targetValue: { lists: mappedLists },
        passed: sourceSummary.listSourceCount === mappedLists,
      },
      {
        checkName: 'source_snapshot_count_matches',
        sourceValue: { snapshots: sourceSummary.snapshotSourceCount },
        targetValue: { snapshots: mappedSnapshots },
        passed: sourceSummary.snapshotSourceCount === mappedSnapshots,
      },
      {
        checkName: 'embedded_item_count_matches',
        sourceValue: { items: sourceSummary.expectedItemCount },
        targetValue: { items: targetItems },
        passed: sourceSummary.expectedItemCount === targetItems,
      },
    );
  }

  for (const result of results) {
    await insertReconciliationResult(dataSource, runId, result);
  }

  return {
    passed: results.every((result) => result.passed),
    results,
  };
}

module.exports = {
  MigrationSkipError,
  reconcileShoppingLists,
  runShoppingListsPhase,
};
