const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const {
  auditPayload,
  transformUserDocument,
} = require('../lib/user-transform');

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

async function findTargetUserId(manager, transformed) {
  const mappings = await manager.query(
    `
            SELECT target_id
            FROM migration.entity_id_map
            WHERE source_system = 'mongodb'
              AND source_collection = 'users'
              AND source_id = $1
              AND target_schema = 'app'
              AND target_table = 'users'
        `,
    [transformed.sourceId],
  );

  const mappedId = mappings[0]?.target_id || null;
  const emailRows = await manager.query(
    'SELECT id FROM app.users WHERE email = $1',
    [transformed.user.email],
  );

  const emailUserId = emailRows[0]?.id || null;

  if (mappedId && emailUserId && mappedId !== emailUserId) {
    throw new MigrationBlockedError('email_conflicts_with_mapped_user', {
      email: transformed.user.email,
      mappedId,
      emailUserId,
    });
  }

  if (!mappedId && emailUserId) {
    throw new MigrationBlockedError('normalized_email_already_exists', {
      email: transformed.user.email,
      existingUserId: emailUserId,
    });
  }

  return mappedId || crypto.randomUUID();
}

async function persistCoreUser(manager, userId, transformed, retailerByKey) {
  const { user, profile, notificationPreferences, dashboardPreferences, legacyMetrics } = transformed;
  const selectedRetailerId = retailerByKey.get(dashboardPreferences.selectedRetailerKey) || null;

  await manager.query(
    `
            INSERT INTO app.users (
                id,
                email,
                password_hash,
                role,
                status,
                email_verified_at,
                phone_verified_at,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                password_hash = EXCLUDED.password_hash,
                role = EXCLUDED.role,
                status = EXCLUDED.status,
                email_verified_at = EXCLUDED.email_verified_at,
                phone_verified_at = EXCLUDED.phone_verified_at,
                updated_at = EXCLUDED.updated_at
        `,
    [
      userId,
      user.email,
      user.passwordHash,
      user.role,
      user.status,
      user.emailVerifiedAt,
      user.phoneVerifiedAt,
      user.createdAt,
      user.updatedAt,
    ],
  );

  await manager.query(
    `
            INSERT INTO app.user_profiles (
                user_id,
                first_name,
                last_name,
                phone_number,
                address,
                postcode,
                date_of_birth,
                bio,
                legacy_profile_id,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (user_id) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                phone_number = EXCLUDED.phone_number,
                address = EXCLUDED.address,
                postcode = EXCLUDED.postcode,
                date_of_birth = EXCLUDED.date_of_birth,
                bio = EXCLUDED.bio,
                legacy_profile_id = EXCLUDED.legacy_profile_id,
                updated_at = EXCLUDED.updated_at
        `,
    [
      userId,
      profile.firstName,
      profile.lastName,
      profile.phoneNumber,
      profile.address,
      profile.postcode,
      profile.dateOfBirth,
      profile.bio,
      profile.legacyProfileId,
      profile.createdAt,
      profile.updatedAt,
    ],
  );

  if (transformed.profileImage) {
    await manager.query(
      `
                INSERT INTO app.user_profile_images (
                    user_id,
                    mime_type,
                    image_data,
                    created_at,
                    updated_at
                ) VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (user_id) DO UPDATE SET
                    mime_type = EXCLUDED.mime_type,
                    image_data = EXCLUDED.image_data,
                    updated_at = EXCLUDED.updated_at
            `,
      [
        userId,
        transformed.profileImage.mimeType,
        transformed.profileImage.imageData,
        user.createdAt,
        user.updatedAt,
      ],
    );
  } else {
    await manager.query(
      'DELETE FROM app.user_profile_images WHERE user_id = $1',
      [userId],
    );
  }

  await manager.query(
    `
            INSERT INTO app.user_notification_preferences (
                user_id,
                price_alerts_enabled,
                weekly_summary_enabled,
                browser_notifications_enabled,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
                price_alerts_enabled = EXCLUDED.price_alerts_enabled,
                weekly_summary_enabled = EXCLUDED.weekly_summary_enabled,
                browser_notifications_enabled = EXCLUDED.browser_notifications_enabled,
                updated_at = EXCLUDED.updated_at
        `,
    [
      userId,
      notificationPreferences.priceAlertsEnabled,
      notificationPreferences.weeklySummaryEnabled,
      notificationPreferences.browserNotificationsEnabled,
      user.updatedAt,
    ],
  );

  await manager.query(
    `
            INSERT INTO app.user_dashboard_preferences (
                user_id,
                selected_list_id,
                selected_retailer_id,
                selected_retailer_key,
                legacy_selected_list_id,
                created_at,
                updated_at
            ) VALUES ($1, NULL, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id) DO UPDATE SET
                selected_retailer_id = EXCLUDED.selected_retailer_id,
                selected_retailer_key = EXCLUDED.selected_retailer_key,
                legacy_selected_list_id = EXCLUDED.legacy_selected_list_id,
                updated_at = EXCLUDED.updated_at
        `,
    [
      userId,
      selectedRetailerId,
      dashboardPreferences.selectedRetailerKey,
      dashboardPreferences.legacySelectedListId,
      dashboardPreferences.createdAt,
      dashboardPreferences.updatedAt,
    ],
  );

  await manager.query(
    `
            INSERT INTO app.user_legacy_metrics (
                user_id,
                total_saved,
                shopping_trips,
                shopping_lists_count,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
                total_saved = EXCLUDED.total_saved,
                shopping_trips = EXCLUDED.shopping_trips,
                shopping_lists_count = EXCLUDED.shopping_lists_count,
                updated_at = EXCLUDED.updated_at
        `,
    [
      userId,
      legacyMetrics.totalSaved,
      legacyMetrics.shoppingTrips,
      legacyMetrics.shoppingListsCount,
      legacyMetrics.updatedAt,
    ],
  );
}

async function persistSubscription(manager, userId, subscription) {
  const activeRows = await manager.query(
    `
            SELECT id, source
            FROM app.user_subscriptions
            WHERE user_id = $1 AND status = 'active'
        `,
    [userId],
  );

  const current = activeRows[0] || null;

  if (current && current.source !== 'legacy_mongodb') {
    return {
      reason: 'active_non_legacy_subscription_preserved',
      detail: { subscriptionId: current.id, source: current.source },
    };
  }

  if (current) {
    await manager.query(
      `
                UPDATE app.user_subscriptions
                SET plan_code = $2,
                    started_at = $3,
                    updated_at = $4
                WHERE id = $1
            `,
      [current.id, subscription.planCode, subscription.startedAt, subscription.updatedAt],
    );

    return null;
  }

  await manager.query(
    `
            INSERT INTO app.user_subscriptions (
                id,
                user_id,
                plan_code,
                status,
                source,
                started_at,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, 'active', 'legacy_mongodb', $4, $5, $6)
        `,
    [
      crypto.randomUUID(),
      userId,
      subscription.planCode,
      subscription.startedAt,
      subscription.startedAt,
      subscription.updatedAt,
    ],
  );

  return null;
}

async function persistReceipts(manager, userId, receipts, retailerByKey) {
  const sourceKeys = receipts.map((receipt) => receipt.sourceReceiptKey);
  const unresolvedReferences = [];

  await manager.query(
    `
            DELETE FROM app.receipts
            WHERE user_id = $1
              AND source = 'legacy_mongodb'
              AND NOT (source_receipt_key = ANY($2::text[]))
        `,
    [userId, sourceKeys],
  );

  for (const receipt of receipts) {
    const retailerId = retailerByKey.get(receipt.retailerKey) || null;

    if (!retailerId && receipt.storeName) {
      unresolvedReferences.push({
        sourceCollection: 'users',
        sourceField: 'receipt_history[].store_name',
        sourceValue: receipt.storeName,
        targetSchema: 'silver',
        targetTable: 'dim_retailers',
        reason: receipt.retailerKey ? 'retailer_not_migrated' : 'retailer_unrecognized',
        required: false,
        details: { sourceReceiptKey: receipt.sourceReceiptKey },
      });
    }

    const rows = await manager.query(
      `
                INSERT INTO app.receipts (
                    id,
                    user_id,
                    source_receipt_key,
                    retailer_id,
                    store_name,
                    receipt_number,
                    purchased_at,
                    uploaded_at,
                    subtotal,
                    total,
                    savings,
                    source,
                    raw_payload,
                    created_at,
                    updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                    'legacy_mongodb', $12::jsonb, $13, $14
                )
                ON CONFLICT (source_receipt_key) DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    retailer_id = EXCLUDED.retailer_id,
                    store_name = EXCLUDED.store_name,
                    receipt_number = EXCLUDED.receipt_number,
                    purchased_at = EXCLUDED.purchased_at,
                    uploaded_at = EXCLUDED.uploaded_at,
                    subtotal = EXCLUDED.subtotal,
                    total = EXCLUDED.total,
                    savings = EXCLUDED.savings,
                    raw_payload = EXCLUDED.raw_payload,
                    updated_at = EXCLUDED.updated_at
                RETURNING id
            `,
      [
        crypto.randomUUID(),
        userId,
        receipt.sourceReceiptKey,
        retailerId,
        receipt.storeName,
        receipt.receiptNumber,
        receipt.purchasedAt,
        receipt.uploadedAt,
        receipt.subtotal,
        receipt.total,
        receipt.savings,
        JSON.stringify(receipt.rawPayload),
        receipt.uploadedAt,
        receipt.uploadedAt,
      ],
    );

    const receiptId = rows[0].id;
    await manager.query('DELETE FROM app.receipt_items WHERE receipt_id = $1', [receiptId]);

    for (const item of receipt.items) {
      await manager.query(
        `
                    INSERT INTO app.receipt_items (
                        id,
                        receipt_id,
                        line_number,
                        item_name,
                        quantity,
                        unit_price,
                        line_total,
                        raw_payload,
                        created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
                `,
        [
          crypto.randomUUID(),
          receiptId,
          item.lineNumber,
          item.itemName,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
          JSON.stringify(item.rawPayload),
          receipt.uploadedAt,
        ],
      );
    }
  }

  return unresolvedReferences;
}

async function persistUser(dataSource, runId, transformed, retailerByKey) {
  return dataSource.transaction(async (manager) => {
    const userId = await findTargetUserId(manager, transformed);
    await persistCoreUser(manager, userId, transformed, retailerByKey);
    const subscriptionWarning = await persistSubscription(
      manager,
      userId,
      transformed.subscription,
    );

    const unresolvedReferences = await persistReceipts(
      manager,
      userId,
      transformed.receipts,
      retailerByKey,
    );

    if (!retailerByKey.get(transformed.dashboardPreferences.selectedRetailerKey)) {
      unresolvedReferences.push({
        sourceCollection: 'users',
        sourceId: transformed.sourceId,
        sourceField: 'dashboard_preferences.selected_dashboard_retailer',
        sourceValue: transformed.dashboardPreferences.selectedRetailerKey,
        targetSchema: 'silver',
        targetTable: 'dim_retailers',
        reason: 'retailer_not_migrated',
        required: false,
      });
    }

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
                ) VALUES ('mongodb', 'users', $1, 'app', 'users', $2, $3, $4, CURRENT_TIMESTAMP)
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
      [transformed.sourceId, userId, runId, transformed.sourceChecksum],
    );

    const warnings = [
      ...transformed.warnings,
      ...(subscriptionWarning ? [subscriptionWarning] : []),
    ];
    await recordMigrated(manager, runId, {
      sourceCollection: 'users',
      sourceId: transformed.sourceId,
      sourceChecksum: transformed.sourceChecksum,
      targetSchema: 'app',
      targetTable: 'users',
      targetId: userId,
      warnings,
    });
    await recordReferenceFailures(
      manager,
      runId,
      unresolvedReferences.map((failure) => ({
        ...failure,
        sourceId: failure.sourceId || transformed.sourceId,
      })),
    );

    return { userId, subscriptionWarning, unresolvedReferences, warnings };
  });
}

function createMongoFilter(afterId) {
  if (!afterId) return {};

  if (!ObjectId.isValid(afterId) || !/^[0-9a-fA-F]{24}$/.test(afterId)) {
    throw new Error('--after-id must be a 24-character Mongo ObjectId');
  }

  return { _id: { $gt: new ObjectId(afterId) } };
}

function includeMigratedUserMetrics(summary, transformed) {
  summary.expectedReceiptCount += transformed.receipts.length;
  summary.expectedRetailerLinkedReceiptCount += transformed.receipts.filter(
    (receipt) => receipt.retailerKey,
  ).length;
  summary.planCounts[transformed.subscription.planCode] += 1;
}

async function runUsersPhase({ mongoDb, dataSource, runId, options, onProgress }) {
  const filter = createMongoFilter(options.afterId);
  const users = mongoDb.collection('users');
  const sourceCount = await users.countDocuments(filter);
  const retailerRows = dataSource
    ? await dataSource.query(
      'SELECT id, lower(retailer_name) AS retailer_key FROM silver.dim_retailers',
    )
    : [];

  const retailerByKey = new Map(
    retailerRows.map((row) => [String(row.retailer_key), row.id]),
  );

  const summary = {
    sourceCount,
    scannedCount: 0,
    validCount: 0,
    migratedCount: 0,
    rejectedCount: 0,
    blockedCount: 0,
    failedCount: 0,
    warningCount: 0,
    expectedReceiptCount: 0,
    expectedRetailerLinkedReceiptCount: 0,
    planCounts: { free: 0, premium: 0, family: 0 },
    lastScannedSource: options.afterId || null,
    partial: Boolean(options.afterId),
    scanOnly: options.scanOnly,
  };

  const cursor = users.find(filter).sort({ _id: 1 }).batchSize(options.batchSize);

  for await (const document of cursor) {
    summary.scannedCount += 1;
    summary.lastScannedSource = String(document._id);
    const transformed = transformUserDocument(document);

    if (!transformed.valid) {
      summary.rejectedCount += 1;
      await recordRejected(dataSource, runId, {
        sourceCollection: 'users',
        sourceId: transformed.sourceId,
        reasons: transformed.errors,
        details: auditPayload(document),
      });
    } else {
      summary.validCount += 1;

      if (options.scanOnly) {
        summary.migratedCount += 1;
        summary.warningCount += transformed.warnings.length;
        includeMigratedUserMetrics(summary, transformed);
      } else {
        try {
          const persisted = await persistUser(
            dataSource,
            runId,
            transformed,
            retailerByKey,
          );
          summary.migratedCount += 1;
          summary.warningCount += persisted.warnings.length
            + persisted.unresolvedReferences.length;
          includeMigratedUserMetrics(summary, transformed);
        } catch (error) {
          if (error instanceof MigrationBlockedError) {
            summary.blockedCount += 1;
            await recordBlocked(dataSource, runId, {
              sourceCollection: 'users',
              sourceId: transformed.sourceId,
              sourceChecksum: transformed.sourceChecksum,
              reasons: [{ reason: error.reason, detail: error.detail }],
            });
          } else {
            summary.failedCount += 1;
            await recordFailed(dataSource, runId, {
              sourceCollection: 'users',
              sourceId: transformed.sourceId,
              sourceChecksum: transformed.sourceChecksum,
              error,
            });
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
            ) VALUES ($1, 'users', $2, $3::jsonb, $4::jsonb, $5, $6::jsonb)
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

async function reconcileUsers({ dataSource, runId, sourceSummary }) {
  const [mappingRows, danglingReferenceRows, receiptRows, planRows] = await Promise.all([
    dataSource.query(`
            SELECT
                count(*)::integer AS mapped_count,
                count(u.id)::integer AS existing_target_count
            FROM migration.entity_id_map map
            LEFT JOIN app.users u ON u.id = map.target_id
            WHERE map.source_system = 'mongodb'
              AND map.source_collection = 'users'
              AND map.target_schema = 'app'
              AND map.target_table = 'users'
        `),
    dataSource.query(`
            SELECT (
                (SELECT count(*) FROM app.user_profiles p LEFT JOIN app.users u ON u.id = p.user_id WHERE u.id IS NULL)
                + (SELECT count(*) FROM app.user_profile_images p LEFT JOIN app.users u ON u.id = p.user_id WHERE u.id IS NULL)
                + (SELECT count(*) FROM app.user_notification_preferences p LEFT JOIN app.users u ON u.id = p.user_id WHERE u.id IS NULL)
                + (SELECT count(*) FROM app.user_dashboard_preferences p LEFT JOIN app.users u ON u.id = p.user_id WHERE u.id IS NULL)
                + (SELECT count(*) FROM app.user_legacy_metrics p LEFT JOIN app.users u ON u.id = p.user_id WHERE u.id IS NULL)
                + (SELECT count(*) FROM app.user_subscriptions p LEFT JOIN app.users u ON u.id = p.user_id WHERE u.id IS NULL)
                + (SELECT count(*) FROM app.receipts p LEFT JOIN app.users u ON u.id = p.user_id WHERE u.id IS NULL)
            )::integer AS dangling_reference_count
        `),
    dataSource.query(`
            SELECT
                count(*)::integer AS receipt_count,
                count(receipt.retailer_id)::integer AS retailer_linked_count,
                count(*) FILTER (
                  WHERE receipt.retailer_id IS NOT NULL
                    AND retailer.id IS NULL
                )::integer AS invalid_retailer_count
            FROM app.receipts receipt
            LEFT JOIN silver.dim_retailers retailer ON retailer.id = receipt.retailer_id
            WHERE receipt.source = 'legacy_mongodb'
        `),
    dataSource.query(`
            SELECT subscription.plan_code, count(*)::integer AS count
            FROM migration.entity_id_map map
            JOIN app.user_subscriptions subscription
              ON subscription.user_id = map.target_id
             AND subscription.status = 'active'
            WHERE map.source_system = 'mongodb'
              AND map.source_collection = 'users'
              AND map.target_schema = 'app'
              AND map.target_table = 'users'
            GROUP BY subscription.plan_code
        `),
  ]);

  const mappedCount = Number(mappingRows[0]?.mapped_count || 0);
  const existingTargetCount = Number(mappingRows[0]?.existing_target_count || 0);
  const danglingReferenceCount = Number(
    danglingReferenceRows[0]?.dangling_reference_count || 0,
  );

  const targetReceiptCount = Number(receiptRows[0]?.receipt_count || 0);
  const targetRetailerLinkedReceiptCount = Number(
    receiptRows[0]?.retailer_linked_count || 0,
  );

  const invalidReceiptRetailerCount = Number(
    receiptRows[0]?.invalid_retailer_count || 0,
  );

  const targetPlanCounts = { free: 0, premium: 0, family: 0 };
  planRows.forEach((row) => {
    if (Object.hasOwn(targetPlanCounts, row.plan_code)) {
      targetPlanCounts[row.plan_code] = Number(row.count || 0);
    }
  });

  const results = [
    {
      checkName: 'all_mappings_resolve_to_users',
      sourceValue: { mappedCount },
      targetValue: { existingTargetCount },
      passed: mappedCount === existingTargetCount,
    },
    {
      checkName: 'no_dangling_user_children',
      sourceValue: { expected: 0 },
      targetValue: { danglingReferenceCount },
      passed: danglingReferenceCount === 0,
    },
    {
      checkName: 'receipt_retailer_ids_resolve',
      sourceValue: { expectedInvalidRetailers: 0 },
      targetValue: { invalidRetailers: invalidReceiptRetailerCount },
      passed: invalidReceiptRetailerCount === 0,
    },
  ];

  if (!sourceSummary.partial) {
    results.push(
      {
        checkName: 'migrated_users_have_id_mappings',
        sourceValue: { migratedUsers: sourceSummary.migratedCount },
        targetValue: { mappedUsers: mappedCount },
        passed: sourceSummary.migratedCount === mappedCount,
      },
      {
        checkName: 'legacy_receipt_count_matches',
        sourceValue: { receipts: sourceSummary.expectedReceiptCount },
        targetValue: { receipts: targetReceiptCount },
        passed: sourceSummary.expectedReceiptCount === targetReceiptCount,
      },
      {
        checkName: 'optional_receipt_retailer_resolution_observed',
        sourceValue: {
          recognizedReceipts: sourceSummary.expectedRetailerLinkedReceiptCount,
        },
        targetValue: {
          linkedReceipts: targetRetailerLinkedReceiptCount,
        },
        passed: true,
        details: {
          unresolvedOptionalRetailers: Math.max(
            0,
            sourceSummary.expectedRetailerLinkedReceiptCount
              - targetRetailerLinkedReceiptCount,
          ),
        },
      },
      {
        checkName: 'active_plan_distribution_matches',
        sourceValue: sourceSummary.planCounts,
        targetValue: targetPlanCounts,
        passed: JSON.stringify(sourceSummary.planCounts) === JSON.stringify(targetPlanCounts),
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
  reconcileUsers,
  runUsersPhase,
};
