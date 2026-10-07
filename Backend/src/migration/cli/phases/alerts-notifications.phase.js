const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const {
  alertSegmentAuditPayload,
  notificationAuditPayload,
  transformAlertSegmentDocument,
  transformNotificationDocument,
} = require('../lib/alert-notification-transform');

const { recordReferenceFailures } = require('../lib/reference-audit');
const {
  recordBlocked,
  recordFailed,
  recordMigrated,
  recordRejected,
  updateRunProgress,
} = require('../lib/migration-audit');

class MigrationBlockedError extends Error {
  constructor(reason, detail = {}) {
    super(reason);
    this.name = 'MigrationBlockedError';
    this.reason = reason;
    this.detail = detail;
  }
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

async function resolveUserId(manager, ownerSourceId, ownerEmail) {
  const mappedId = await findMappedId(manager, 'users', ownerSourceId, 'users');
  const emailRows = ownerEmail
    ? await manager.query('SELECT id FROM app.users WHERE email = $1', [ownerEmail])
    : [];

  const emailUserId = emailRows[0]?.id || null;

  if (mappedId && emailUserId && mappedId !== emailUserId) {
    throw new MigrationBlockedError('alert_notification_owner_conflict', {
      ownerSourceId: ownerSourceId || null,
      hasOwnerEmail: Boolean(ownerEmail),
      mappedId,
      emailUserId,
    });
  }

  const userId = mappedId || emailUserId;

  if (!userId) {
    throw new MigrationBlockedError('missing_migrated_user_owner', {
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
  const [categories, productMappings] = await Promise.all([
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
  ]);

  return {
    categoryByName: new Map(
      categories.map((row) => [String(row.category_name).trim().toLowerCase(), row.id]),
    ),
    productBySourceId: new Map(
      productMappings.map((row) => [String(row.source_id), row.target_id]),
    ),
  };
}

function resolveCategoryId(references, categoryLabel) {
  return references.categoryByName.get(String(categoryLabel || '').trim().toLowerCase()) || null;
}

async function persistAlertSegment(dataSource, runId, transformed, references) {
  return dataSource.transaction(async (manager) => {
    const userId = await resolveUserId(
      manager,
      transformed.ownerSourceId,
      transformed.ownerEmail,
    );

    const segmentId = await findTargetId(
      manager,
      'alert_segments',
      transformed.sourceId,
      'alert_segments',
    );

    const { segment } = transformed;
    const existingRows = await manager.query(
      'SELECT id FROM app.alert_segments WHERE user_id = $1 AND category_key = $2',
      [userId, segment.categoryKey],
    );

    if (existingRows[0]?.id && existingRows[0].id !== segmentId) {
      throw new MigrationBlockedError('duplicate_user_category_alert_segment', {
        categoryKey: segment.categoryKey,
        existingSegmentId: existingRows[0].id,
      });
    }

    const categoryId = resolveCategoryId(references, segment.categoryLabel);

    await manager.query(
      `
        INSERT INTO app.alert_segments (
          id,
          user_id,
          category_id,
          category_key,
          category_label,
          active,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          category_id = EXCLUDED.category_id,
          category_key = EXCLUDED.category_key,
          category_label = EXCLUDED.category_label,
          active = EXCLUDED.active,
          updated_at = EXCLUDED.updated_at
      `,
      [
        segmentId,
        userId,
        categoryId,
        segment.categoryKey,
        segment.categoryLabel,
        segment.active,
        segment.createdAt,
        segment.updatedAt,
      ],
    );

    await upsertIdMap(
      manager,
      runId,
      'alert_segments',
      transformed.sourceId,
      'alert_segments',
      segmentId,
      transformed.sourceChecksum,
    );

    const unresolvedReferences = categoryId ? [] : [{
      sourceCollection: 'alert_segments',
      sourceId: transformed.sourceId,
      sourceField: 'category_label',
      sourceValue: transformed.segment.categoryLabel,
      targetSchema: 'silver',
      targetTable: 'dim_categories',
      reason: 'category_not_migrated',
      required: false,
    }];
    await recordMigrated(manager, runId, {
      sourceCollection: 'alert_segments',
      sourceId: transformed.sourceId,
      sourceChecksum: transformed.sourceChecksum,
      targetSchema: 'app',
      targetTable: 'alert_segments',
      targetId: segmentId,
      warnings: transformed.warnings,
    });
    await recordReferenceFailures(manager, runId, unresolvedReferences);

    return { segmentId, categoryResolved: Boolean(categoryId), unresolvedReferences };
  });
}

async function assertNoNotificationDealConflict(manager, userId, notificationId, notification) {
  if (!notification.dealKey || !notification.categoryKey) return;

  const rows = await manager.query(
    `
      SELECT id
      FROM app.notifications
      WHERE user_id = $1
        AND type = $2
        AND category_key = $3
        AND deal_key = $4
    `,
    [userId, notification.type, notification.categoryKey, notification.dealKey],
  );

  if (rows[0]?.id && rows[0].id !== notificationId) {
    throw new MigrationBlockedError('duplicate_notification_deal_key', {
      type: notification.type,
      categoryKey: notification.categoryKey,
      dealKey: notification.dealKey,
      existingNotificationId: rows[0].id,
    });
  }
}

async function persistNotification(dataSource, runId, transformed, references) {
  return dataSource.transaction(async (manager) => {
    const userId = await resolveUserId(
      manager,
      transformed.ownerSourceId,
      transformed.ownerEmail,
    );

    const notificationId = await findTargetId(
      manager,
      'notifications',
      transformed.sourceId,
      'notifications',
    );

    const { notification } = transformed;
    const categoryId = resolveCategoryId(references, notification.categoryLabel);

    await assertNoNotificationDealConflict(manager, userId, notificationId, notification);

    await manager.query(
      `
        INSERT INTO app.notifications (
          id,
          user_id,
          type,
          title,
          message,
          is_read,
          category_id,
          category_key,
          category_label,
          cta_route,
          deal_key,
          source_types,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::text[], $13, $14
        )
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          type = EXCLUDED.type,
          title = EXCLUDED.title,
          message = EXCLUDED.message,
          is_read = EXCLUDED.is_read,
          category_id = EXCLUDED.category_id,
          category_key = EXCLUDED.category_key,
          category_label = EXCLUDED.category_label,
          cta_route = EXCLUDED.cta_route,
          deal_key = EXCLUDED.deal_key,
          source_types = EXCLUDED.source_types,
          updated_at = EXCLUDED.updated_at
      `,
      [
        notificationId,
        userId,
        notification.type,
        notification.title,
        notification.message,
        notification.isRead,
        categoryId,
        notification.categoryKey,
        notification.categoryLabel,
        notification.ctaRoute,
        notification.dealKey,
        notification.sourceTypes,
        notification.createdAt,
        notification.updatedAt,
      ],
    );

    await manager.query(
      'DELETE FROM app.notification_product_references WHERE notification_id = $1',
      [notificationId],
    );

    let matchedProductCount = 0;
    const unresolvedReferences = [];

    for (let index = 0; index < notification.relatedProductIdentifiers.length; index += 1) {
      const legacyProductIdentifier = notification.relatedProductIdentifiers[index];
      const productId = references.productBySourceId.get(legacyProductIdentifier) || null;

      if (productId) matchedProductCount += 1;

      if (!productId) {
        unresolvedReferences.push({
          sourceCollection: 'notifications',
          sourceId: transformed.sourceId,
          sourceField: `related_product_ids[${index}]`,
          sourceValue: legacyProductIdentifier,
          targetSchema: 'silver',
          targetTable: 'dim_products',
          reason: 'product_not_migrated',
          required: false,
          details: { lineNumber: index + 1 },
        });
      }

      await manager.query(
        `
          INSERT INTO app.notification_product_references (
            id,
            notification_id,
            line_number,
            product_id,
            legacy_product_identifier
          ) VALUES ($1, $2, $3, $4, $5)
        `,
        [crypto.randomUUID(), notificationId, index + 1, productId, legacyProductIdentifier],
      );
    }

    await upsertIdMap(
      manager,
      runId,
      'notifications',
      transformed.sourceId,
      'notifications',
      notificationId,
      transformed.sourceChecksum,
    );

    if (notification.categoryKey && !categoryId) {
      unresolvedReferences.push({
        sourceCollection: 'notifications',
        sourceId: transformed.sourceId,
        sourceField: 'category_label',
        sourceValue: transformed.notification.categoryLabel,
        targetSchema: 'silver',
        targetTable: 'dim_categories',
        reason: 'category_not_migrated',
        required: false,
      });
    }
    await recordMigrated(manager, runId, {
      sourceCollection: 'notifications',
      sourceId: transformed.sourceId,
      sourceChecksum: transformed.sourceChecksum,
      targetSchema: 'app',
      targetTable: 'notifications',
      targetId: notificationId,
      warnings: transformed.warnings,
    });
    await recordReferenceFailures(manager, runId, unresolvedReferences);

    return {
      notificationId,
      categoryResolved: !notification.categoryKey || Boolean(categoryId),
      matchedProductCount,
      unresolvedReferences,
    };
  });
}

function createMongoFilter(afterId) {
  if (!afterId) return {};

  if (!ObjectId.isValid(afterId) || !/^[0-9a-fA-F]{24}$/.test(afterId)) {
    throw new Error('--after-id must be a 24-character Mongo ObjectId');
  }

  return { _id: { $gt: new ObjectId(afterId) } };
}

async function synchronizeRemovedSources(dataSource, runId, summary) {
  if (
    summary.partial
    || summary.rejectedCount > 0
    || summary.blockedCount > 0
    || summary.failedCount > 0
  ) return;

  await dataSource.transaction(async (manager) => {
    for (const [sourceCollection, targetTable] of [
      ['notifications', 'notifications'],
      ['alert_segments', 'alert_segments'],
    ]) {
      await manager.query(`
        DELETE FROM app.${targetTable} target
        USING migration.entity_id_map map
        WHERE map.source_system = 'mongodb'
          AND map.source_collection = $1
          AND map.target_schema = 'app'
          AND map.target_table = $2
          AND map.target_id = target.id
          AND map.migration_run_id IS DISTINCT FROM $3
      `, [sourceCollection, targetTable, runId]);

      await manager.query(`
        DELETE FROM migration.entity_id_map
        WHERE source_system = 'mongodb'
          AND source_collection = $1
          AND target_schema = 'app'
          AND target_table = $2
          AND migration_run_id IS DISTINCT FROM $3
      `, [sourceCollection, targetTable, runId]);
    }
  });
}

function createSummary(alertSourceCount, notificationSourceCount, options) {
  return {
    sourceCount: alertSourceCount + notificationSourceCount,
    alertSourceCount,
    notificationSourceCount,
    scannedCount: 0,
    validCount: 0,
    migratedCount: 0,
    targetAlertCount: 0,
    targetNotificationCount: 0,
    rejectedCount: 0,
    blockedCount: 0,
    failedCount: 0,
    warningCount: 0,
    expectedActiveAlertCount: 0,
    expectedReadNotificationCount: 0,
    expectedAlertCategoryCount: 0,
    expectedNotificationCategoryCount: 0,
    resolvedAlertCategoryCount: 0,
    resolvedNotificationCategoryCount: 0,
    expectedRelatedProductCount: 0,
    matchedRelatedProductCount: 0,
    lastScannedSource: options.afterId ? `alert_segments:${options.afterId}` : null,
    partial: Boolean(options.afterId),
    scanOnly: options.scanOnly,
  };
}

function includeMigratedAlertMetrics(summary, transformed) {
  summary.expectedAlertCategoryCount += 1;
  if (transformed.segment.active) summary.expectedActiveAlertCount += 1;
}

function includeMigratedNotificationMetrics(summary, transformed) {
  summary.expectedRelatedProductCount += transformed.notification.relatedProductIdentifiers.length;
  if (transformed.notification.isRead) summary.expectedReadNotificationCount += 1;
  if (transformed.notification.categoryKey) summary.expectedNotificationCategoryCount += 1;
}

async function processAlertDocument(context, document) {
  const { dataSource, runId, options, references, summary } = context;
  summary.scannedCount += 1;
  summary.lastScannedSource = `alert_segments:${document._id}`;
  const transformed = transformAlertSegmentDocument(document);

  if (!transformed.valid) {
    summary.rejectedCount += 1;
    await recordRejected(dataSource, runId, {
      sourceCollection: 'alert_segments',
      sourceId: transformed.sourceId,
      reasons: transformed.errors,
      details: alertSegmentAuditPayload(document),
    });

    return;
  }

  summary.validCount += 1;

  if (options.scanOnly) {
    summary.migratedCount += 1;
    summary.targetAlertCount += 1;
    summary.warningCount += transformed.warnings.length;
    includeMigratedAlertMetrics(summary, transformed);

    return;
  }

  try {
    const persisted = await persistAlertSegment(dataSource, runId, transformed, references);
    summary.migratedCount += 1;
    summary.targetAlertCount += 1;
    if (persisted.categoryResolved) summary.resolvedAlertCategoryCount += 1;
    summary.warningCount += transformed.warnings.length + (persisted.categoryResolved ? 0 : 1);
    includeMigratedAlertMetrics(summary, transformed);
  } catch (error) {
    if (error instanceof MigrationBlockedError) {
      summary.blockedCount += 1;
      await recordBlocked(dataSource, runId, {
        sourceCollection: 'alert_segments',
        sourceId: transformed.sourceId,
        sourceChecksum: transformed.sourceChecksum,
        primaryReasonCode: error.reason,
        details: error.detail,
        reasons: error.reason === 'missing_migrated_user_owner'
          ? []
          : [{ reason: error.reason, detail: error.detail }],
      });

      if (error.reason === 'missing_migrated_user_owner') {
        await recordReferenceFailures(dataSource, runId, [{
          sourceCollection: 'alert_segments',
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
    } else {
      summary.failedCount += 1;
      await recordFailed(dataSource, runId, {
        sourceCollection: 'alert_segments',
        sourceId: transformed.sourceId,
        sourceChecksum: transformed.sourceChecksum,
        error,
      });
      if (options.failFast) throw error;
    }
  }
}

async function processNotificationDocument(context, document) {
  const { dataSource, runId, options, references, summary } = context;
  summary.scannedCount += 1;
  summary.lastScannedSource = `notifications:${document._id}`;
  const transformed = transformNotificationDocument(document);

  if (!transformed.valid) {
    summary.rejectedCount += 1;
    await recordRejected(dataSource, runId, {
      sourceCollection: 'notifications',
      sourceId: transformed.sourceId,
      reasons: transformed.errors,
      details: notificationAuditPayload(document),
    });

    return;
  }

  summary.validCount += 1;

  if (options.scanOnly) {
    summary.migratedCount += 1;
    summary.targetNotificationCount += 1;
    summary.warningCount += transformed.warnings.length;
    includeMigratedNotificationMetrics(summary, transformed);

    return;
  }

  try {
    const persisted = await persistNotification(dataSource, runId, transformed, references);
    summary.migratedCount += 1;
    summary.targetNotificationCount += 1;
    summary.matchedRelatedProductCount += persisted.matchedProductCount;
    summary.warningCount += transformed.warnings.length
      + persisted.unresolvedReferences.length;
    includeMigratedNotificationMetrics(summary, transformed);

    if (transformed.notification.categoryKey && persisted.categoryResolved) {
      summary.resolvedNotificationCategoryCount += 1;
    }
  } catch (error) {
    if (error instanceof MigrationBlockedError) {
      summary.blockedCount += 1;
      await recordBlocked(dataSource, runId, {
        sourceCollection: 'notifications',
        sourceId: transformed.sourceId,
        sourceChecksum: transformed.sourceChecksum,
        primaryReasonCode: error.reason,
        details: error.detail,
        reasons: error.reason === 'missing_migrated_user_owner'
          ? []
          : [{ reason: error.reason, detail: error.detail }],
      });

      if (error.reason === 'missing_migrated_user_owner') {
        await recordReferenceFailures(dataSource, runId, [{
          sourceCollection: 'notifications',
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
    } else {
      summary.failedCount += 1;
      await recordFailed(dataSource, runId, {
        sourceCollection: 'notifications',
        sourceId: transformed.sourceId,
        sourceChecksum: transformed.sourceChecksum,
        error,
      });
      if (options.failFast) throw error;
    }
  }
}

async function runAlertsNotificationsPhase({
  mongoDb,
  dataSource,
  runId,
  options,
  onProgress,
}) {
  const filter = createMongoFilter(options.afterId);
  const alertSegments = mongoDb.collection('alert_segments');
  const notifications = mongoDb.collection('notifications');
  const [alertSourceCount, notificationSourceCount] = await Promise.all([
    alertSegments.countDocuments(filter),
    notifications.countDocuments(filter),
  ]);

  const references = dataSource ? await loadReferenceMaps(dataSource) : null;
  const summary = createSummary(alertSourceCount, notificationSourceCount, options);
  const context = { dataSource, runId, options, references, summary };
  const alertCursor = alertSegments.find(filter).sort({ _id: 1 }).batchSize(options.batchSize);

  for await (const document of alertCursor) {
    await processAlertDocument(context, document);

    if (summary.scannedCount % options.batchSize === 0) {
      await updateRunProgress(dataSource, runId, summary);
      onProgress?.(summary);
    }
  }

  const notificationCursor = notifications.find(filter)
    .sort({ _id: 1 })
    .batchSize(options.batchSize);

  for await (const document of notificationCursor) {
    await processNotificationDocument(context, document);

    if (summary.scannedCount % options.batchSize === 0) {
      await updateRunProgress(dataSource, runId, summary);
      onProgress?.(summary);
    }
  }

  if (!options.scanOnly) {
    await synchronizeRemovedSources(dataSource, runId, summary);
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
      ) VALUES ($1, 'alerts_notifications', $2, $3::jsonb, $4::jsonb, $5, $6::jsonb)
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

async function reconcileAlertsNotifications({ dataSource, runId, sourceSummary }) {
  const [
    alertRows,
    notificationRows,
    productRows,
    stateRows,
    categoryRows,
    integrityRows,
    duplicateRows,
  ] = await Promise.all([
    dataSource.query(`
      SELECT count(*)::integer AS mapped_count, count(segment.id)::integer AS target_count
      FROM migration.entity_id_map map
      LEFT JOIN app.alert_segments segment ON segment.id = map.target_id
      WHERE map.source_system = 'mongodb'
        AND map.source_collection = 'alert_segments'
        AND map.target_schema = 'app'
        AND map.target_table = 'alert_segments'
    `),
    dataSource.query(`
      SELECT count(*)::integer AS mapped_count, count(notification.id)::integer AS target_count
      FROM migration.entity_id_map map
      LEFT JOIN app.notifications notification ON notification.id = map.target_id
      WHERE map.source_system = 'mongodb'
        AND map.source_collection = 'notifications'
        AND map.target_schema = 'app'
        AND map.target_table = 'notifications'
    `),
    dataSource.query(`
      SELECT count(reference.id)::integer AS reference_count
      FROM migration.entity_id_map map
      JOIN app.notifications notification ON notification.id = map.target_id
      LEFT JOIN app.notification_product_references reference
        ON reference.notification_id = notification.id
      WHERE map.source_system = 'mongodb'
        AND map.source_collection = 'notifications'
        AND map.target_schema = 'app'
        AND map.target_table = 'notifications'
    `),
    dataSource.query(`
      SELECT
        count(*) FILTER (WHERE segment.active)::integer AS active_alert_count,
        (
          SELECT count(*)::integer
          FROM migration.entity_id_map map
          JOIN app.notifications notification ON notification.id = map.target_id
          WHERE map.source_system = 'mongodb'
            AND map.source_collection = 'notifications'
            AND map.target_schema = 'app'
            AND map.target_table = 'notifications'
            AND notification.is_read = true
        ) AS read_notification_count
      FROM migration.entity_id_map map
      JOIN app.alert_segments segment ON segment.id = map.target_id
      WHERE map.source_system = 'mongodb'
        AND map.source_collection = 'alert_segments'
        AND map.target_schema = 'app'
        AND map.target_table = 'alert_segments'
    `),
    dataSource.query(`
      SELECT
        count(*) FILTER (WHERE segment.category_id IS NOT NULL)::integer
          AS resolved_alert_categories,
        (
          SELECT count(*)::integer
          FROM migration.entity_id_map map
          JOIN app.notifications notification ON notification.id = map.target_id
          WHERE map.source_system = 'mongodb'
            AND map.source_collection = 'notifications'
            AND map.target_schema = 'app'
            AND map.target_table = 'notifications'
            AND notification.category_key IS NOT NULL
            AND notification.category_id IS NOT NULL
        ) AS resolved_notification_categories
      FROM migration.entity_id_map map
      JOIN app.alert_segments segment ON segment.id = map.target_id
      WHERE map.source_system = 'mongodb'
        AND map.source_collection = 'alert_segments'
        AND map.target_schema = 'app'
        AND map.target_table = 'alert_segments'
    `),
    dataSource.query(`
      SELECT (
        (SELECT count(*) FROM app.alert_segments segment LEFT JOIN app.users users ON users.id = segment.user_id WHERE users.id IS NULL)
        + (SELECT count(*) FROM app.notifications notification LEFT JOIN app.users users ON users.id = notification.user_id WHERE users.id IS NULL)
        + (SELECT count(*) FROM app.notification_product_references reference LEFT JOIN app.notifications notification ON notification.id = reference.notification_id WHERE notification.id IS NULL)
      )::integer AS dangling_reference_count
    `),
    dataSource.query(`
      SELECT
        (SELECT count(*) FROM (
          SELECT user_id, category_key
          FROM app.alert_segments
          GROUP BY user_id, category_key
          HAVING count(*) > 1
        ) duplicate_alerts)::integer AS duplicate_alert_groups,
        (SELECT count(*) FROM (
          SELECT user_id, type, category_key, deal_key
          FROM app.notifications
          WHERE deal_key IS NOT NULL AND category_key IS NOT NULL
          GROUP BY user_id, type, category_key, deal_key
          HAVING count(*) > 1
        ) duplicate_notifications)::integer AS duplicate_notification_groups
    `),
  ]);

  const mappedAlerts = Number(alertRows[0]?.mapped_count || 0);
  const targetAlerts = Number(alertRows[0]?.target_count || 0);
  const mappedNotifications = Number(notificationRows[0]?.mapped_count || 0);
  const targetNotifications = Number(notificationRows[0]?.target_count || 0);
  const productReferences = Number(productRows[0]?.reference_count || 0);
  const activeAlerts = Number(stateRows[0]?.active_alert_count || 0);
  const readNotifications = Number(stateRows[0]?.read_notification_count || 0);
  const resolvedAlertCategories = Number(categoryRows[0]?.resolved_alert_categories || 0);
  const resolvedNotificationCategories = Number(
    categoryRows[0]?.resolved_notification_categories || 0,
  );

  const danglingReferenceCount = Number(
    integrityRows[0]?.dangling_reference_count || 0,
  );

  const duplicateAlertGroups = Number(duplicateRows[0]?.duplicate_alert_groups || 0);
  const duplicateNotificationGroups = Number(
    duplicateRows[0]?.duplicate_notification_groups || 0,
  );

  const results = [
    {
      checkName: 'all_alert_mappings_resolve',
      sourceValue: { mappedAlerts },
      targetValue: { targetAlerts },
      passed: mappedAlerts === targetAlerts,
    },
    {
      checkName: 'all_notification_mappings_resolve',
      sourceValue: { mappedNotifications },
      targetValue: { targetNotifications },
      passed: mappedNotifications === targetNotifications,
    },
    {
      checkName: 'no_dangling_alert_notification_rows',
      sourceValue: { expected: 0 },
      targetValue: { danglingReferenceCount },
      passed: danglingReferenceCount === 0,
    },
    {
      checkName: 'unique_user_category_alert_segments',
      sourceValue: { expected: 0 },
      targetValue: { duplicateAlertGroups },
      passed: duplicateAlertGroups === 0,
    },
    {
      checkName: 'unique_notification_deal_keys',
      sourceValue: { expected: 0 },
      targetValue: { duplicateNotificationGroups },
      passed: duplicateNotificationGroups === 0,
    },
  ];

  if (!sourceSummary.partial) {
    results.push(
      {
        checkName: 'migrated_alert_count_matches',
        sourceValue: { alertSegments: sourceSummary.targetAlertCount },
        targetValue: { alertSegments: mappedAlerts },
        passed: sourceSummary.targetAlertCount === mappedAlerts,
      },
      {
        checkName: 'migrated_notification_count_matches',
        sourceValue: { notifications: sourceSummary.targetNotificationCount },
        targetValue: { notifications: mappedNotifications },
        passed: sourceSummary.targetNotificationCount === mappedNotifications,
      },
      {
        checkName: 'notification_product_reference_count_matches',
        sourceValue: { references: sourceSummary.expectedRelatedProductCount },
        targetValue: { references: productReferences },
        passed: sourceSummary.expectedRelatedProductCount === productReferences,
      },
      {
        checkName: 'active_alert_state_matches',
        sourceValue: { activeAlerts: sourceSummary.expectedActiveAlertCount },
        targetValue: { activeAlerts },
        passed: sourceSummary.expectedActiveAlertCount === activeAlerts,
      },
      {
        checkName: 'read_notification_state_matches',
        sourceValue: { readNotifications: sourceSummary.expectedReadNotificationCount },
        targetValue: { readNotifications },
        passed: sourceSummary.expectedReadNotificationCount === readNotifications,
      },
      {
        checkName: 'optional_alert_category_resolution_observed',
        sourceValue: { categories: sourceSummary.expectedAlertCategoryCount },
        targetValue: { categories: resolvedAlertCategories },
        passed: true,
        details: {
          unresolvedOptionalCategories: Math.max(
            0,
            sourceSummary.expectedAlertCategoryCount - resolvedAlertCategories,
          ),
        },
      },
      {
        checkName: 'optional_notification_category_resolution_observed',
        sourceValue: { categories: sourceSummary.expectedNotificationCategoryCount },
        targetValue: { categories: resolvedNotificationCategories },
        passed: true,
        details: {
          unresolvedOptionalCategories: Math.max(
            0,
            sourceSummary.expectedNotificationCategoryCount
              - resolvedNotificationCategories,
          ),
        },
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
  MigrationBlockedError,
  reconcileAlertsNotifications,
  runAlertsNotificationsPhase,
};
