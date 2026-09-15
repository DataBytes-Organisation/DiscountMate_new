const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const {
  supportRequestAuditPayload,
  transformSupportRequestDocument,
} = require('../lib/support-request-transform');

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

async function findMappedId(manager, sourceId) {
  const rows = await manager.query(
    `
      SELECT target_id
      FROM migration.entity_id_map
      WHERE source_system = 'mongodb'
        AND source_collection = 'support_requests'
        AND source_id = $1
        AND target_schema = 'app'
        AND target_table = 'support_requests'
    `,
    [sourceId],
  );

  return rows[0]?.target_id || null;
}

async function upsertIdMap(manager, runId, transformed, targetId) {
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
      ) VALUES (
        'mongodb', 'support_requests', $1, 'app', 'support_requests',
        $2, $3, $4, CURRENT_TIMESTAMP
      )
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
    [transformed.sourceId, targetId, runId, transformed.sourceChecksum],
  );
}

async function persistSupportRequest(dataSource, runId, transformed) {
  return dataSource.transaction(async (manager) => {
    const mappedId = await findMappedId(manager, transformed.sourceId);
    const referenceRows = await manager.query(
      'SELECT id FROM app.support_requests WHERE reference_number = $1',
      [transformed.request.referenceNumber],
    );

    const referenceId = referenceRows[0]?.id || null;

    if (mappedId && referenceId && mappedId !== referenceId) {
      throw new MigrationBlockedError('support_reference_number_conflict', {
        referenceNumber: transformed.request.referenceNumber,
        mappedId,
        referenceId,
      });
    }

    const targetId = mappedId || referenceId || crypto.randomUUID();
    const request = transformed.request;

    await manager.query(
      `
        INSERT INTO app.support_requests (
          id,
          reference_number,
          user_id,
          name,
          email,
          topic,
          subject,
          message,
          support_email,
          email_status,
          status,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          reference_number = EXCLUDED.reference_number,
          user_id = EXCLUDED.user_id,
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          topic = EXCLUDED.topic,
          subject = EXCLUDED.subject,
          message = EXCLUDED.message,
          support_email = EXCLUDED.support_email,
          email_status = EXCLUDED.email_status,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
      `,
      [
        targetId,
        request.referenceNumber,
        request.userId,
        request.name,
        request.email,
        request.topic,
        request.subject,
        request.message,
        request.supportEmail,
        request.emailStatus,
        request.status,
        request.createdAt,
        request.updatedAt,
      ],
    );

    if (transformed.attachment) {
      const attachment = transformed.attachment;
      await manager.query(
        `
          INSERT INTO app.support_request_attachments (
            support_request_id,
            original_name,
            mime_type,
            size_bytes,
            data,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (support_request_id) DO UPDATE SET
            original_name = EXCLUDED.original_name,
            mime_type = EXCLUDED.mime_type,
            size_bytes = EXCLUDED.size_bytes,
            data = EXCLUDED.data,
            created_at = EXCLUDED.created_at
        `,
        [
          targetId,
          attachment.originalName,
          attachment.mimeType,
          attachment.sizeBytes,
          attachment.data,
          request.createdAt,
        ],
      );
    } else {
      await manager.query(
        'DELETE FROM app.support_request_attachments WHERE support_request_id = $1',
        [targetId],
      );
    }

    await upsertIdMap(manager, runId, transformed, targetId);

    await recordMigrated(manager, runId, {
      sourceCollection: 'support_requests',
      sourceId: transformed.sourceId,
      sourceChecksum: transformed.sourceChecksum,
      targetSchema: 'app',
      targetTable: 'support_requests',
      targetId,
      warnings: transformed.warnings,
    });

    return { targetId, hasAttachment: Boolean(transformed.attachment) };
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
    await manager.query(
      `
        DELETE FROM app.support_requests request
        USING migration.entity_id_map map
        WHERE map.source_system = 'mongodb'
          AND map.source_collection = 'support_requests'
          AND map.target_schema = 'app'
          AND map.target_table = 'support_requests'
          AND map.target_id = request.id
          AND map.migration_run_id IS DISTINCT FROM $1
      `,
      [runId],
    );

    await manager.query(
      `
        DELETE FROM migration.entity_id_map
        WHERE source_system = 'mongodb'
          AND source_collection = 'support_requests'
          AND target_schema = 'app'
          AND target_table = 'support_requests'
          AND migration_run_id IS DISTINCT FROM $1
      `,
      [runId],
    );
  });
}

async function runSupportRequestsPhase({
  mongoDb,
  dataSource,
  runId,
  options,
  onProgress,
}) {
  const filter = createMongoFilter(options.afterId);
  const collection = mongoDb.collection('support_requests');
  const sourceCount = await collection.countDocuments(filter);
  const summary = {
    sourceCount,
    scannedCount: 0,
    validCount: 0,
    migratedCount: 0,
    expectedAttachmentCount: 0,
    targetAttachmentCount: 0,
    rejectedCount: 0,
    blockedCount: 0,
    failedCount: 0,
    warningCount: 0,
    lastScannedSource: options.afterId,
    partial: Boolean(options.afterId),
    scanOnly: options.scanOnly,
  };

  const cursor = collection.find(filter).sort({ _id: 1 }).batchSize(options.batchSize);

  for await (const document of cursor) {
    summary.scannedCount += 1;
    summary.lastScannedSource = String(document._id);
    const transformed = transformSupportRequestDocument(document);

    if (!transformed.valid) {
      summary.rejectedCount += 1;
      await recordRejected(dataSource, runId, {
        sourceCollection: 'support_requests',
        sourceId: transformed.sourceId,
        reasons: transformed.errors,
        details: supportRequestAuditPayload(document),
      });
    } else {
      summary.validCount += 1;

      if (options.scanOnly) {
        summary.migratedCount += 1;
        summary.warningCount += transformed.warnings.length;

        if (transformed.attachment) {
          summary.expectedAttachmentCount += 1;
          summary.targetAttachmentCount += 1;
        }
      } else {
        try {
          const persisted = await persistSupportRequest(dataSource, runId, transformed);
          summary.migratedCount += 1;
          summary.warningCount += transformed.warnings.length;

          if (persisted.hasAttachment) {
            summary.expectedAttachmentCount += 1;
            summary.targetAttachmentCount += 1;
          }
        } catch (error) {
          if (error instanceof MigrationBlockedError) {
            summary.blockedCount += 1;
            await recordBlocked(dataSource, runId, {
              sourceCollection: 'support_requests',
              sourceId: transformed.sourceId,
              sourceChecksum: transformed.sourceChecksum,
              reasons: [{ reason: error.reason, detail: error.detail }],
            });
          } else {
            summary.failedCount += 1;
            await recordFailed(dataSource, runId, {
              sourceCollection: 'support_requests',
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
      ) VALUES ($1, 'support_requests', $2, $3::jsonb, $4::jsonb, $5, $6::jsonb)
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

async function reconcileSupportRequests({ dataSource, runId, sourceSummary }) {
  const [mappingRows, attachmentRows, integrityRows] = await Promise.all([
    dataSource.query(`
      SELECT count(*)::integer AS mapped_count, count(request.id)::integer AS target_count
      FROM migration.entity_id_map map
      LEFT JOIN app.support_requests request ON request.id = map.target_id
      WHERE map.source_system = 'mongodb'
        AND map.source_collection = 'support_requests'
        AND map.target_schema = 'app'
        AND map.target_table = 'support_requests'
    `),
    dataSource.query(`
      SELECT count(attachment.id)::integer AS attachment_count
      FROM migration.entity_id_map map
      JOIN app.support_requests request ON request.id = map.target_id
      LEFT JOIN app.support_request_attachments attachment
        ON attachment.support_request_id = request.id
      WHERE map.source_system = 'mongodb'
        AND map.source_collection = 'support_requests'
        AND map.target_schema = 'app'
        AND map.target_table = 'support_requests'
    `),
    dataSource.query(`
      SELECT
        (SELECT count(*)
         FROM app.support_request_attachments attachment
         LEFT JOIN app.support_requests request ON request.id = attachment.support_request_id
         WHERE request.id IS NULL)::integer AS dangling_reference_count,
        (SELECT count(*) FROM (
          SELECT reference_number
          FROM app.support_requests
          GROUP BY reference_number
          HAVING count(*) > 1
        ) duplicates)::integer AS duplicate_reference_groups
    `),
  ]);

  const mappedCount = Number(mappingRows[0]?.mapped_count || 0);
  const targetCount = Number(mappingRows[0]?.target_count || 0);
  const attachmentCount = Number(attachmentRows[0]?.attachment_count || 0);
  const danglingReferenceCount = Number(
    integrityRows[0]?.dangling_reference_count || 0,
  );

  const duplicateReferenceGroups = Number(
    integrityRows[0]?.duplicate_reference_groups || 0,
  );

  const results = [
    {
      checkName: 'all_support_request_mappings_resolve',
      sourceValue: { mappedCount },
      targetValue: { targetCount },
      passed: mappedCount === targetCount,
    },
    {
      checkName: 'no_dangling_support_attachments',
      sourceValue: { expected: 0 },
      targetValue: { danglingReferenceCount },
      passed: danglingReferenceCount === 0,
    },
    {
      checkName: 'unique_support_reference_numbers',
      sourceValue: { expected: 0 },
      targetValue: { duplicateReferenceGroups },
      passed: duplicateReferenceGroups === 0,
    },
  ];

  if (!sourceSummary.partial) {
    results.push(
      {
        checkName: 'migrated_support_request_count_matches',
        sourceValue: { supportRequests: sourceSummary.migratedCount },
        targetValue: { supportRequests: mappedCount },
        passed: sourceSummary.migratedCount === mappedCount,
      },
      {
        checkName: 'source_support_attachment_count_matches',
        sourceValue: { attachments: sourceSummary.expectedAttachmentCount },
        targetValue: { attachments: attachmentCount },
        passed: sourceSummary.expectedAttachmentCount === attachmentCount,
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
  reconcileSupportRequests,
  runSupportRequestsPhase,
};
