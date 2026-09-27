const OUTCOMES = Object.freeze({
  MIGRATED: 'migrated',
  REJECTED: 'rejected',
  BLOCKED: 'blocked',
  FAILED: 'failed',
});

function normalizeSourceId(sourceId) {
  const value = sourceId === undefined || sourceId === null ? '' : String(sourceId).trim();

  return value || '<missing-source-id>';
}

function normalizeIssue(issue, defaults = {}) {
  return {
    issueType: issue.issueType || defaults.issueType || 'validation',
    severity: issue.severity || defaults.severity || 'error',
    reasonCode: issue.reasonCode || issue.reason || 'unspecified_migration_issue',
    sourceField: issue.sourceField || null,
    details: issue.details || issue.detail || {},
  };
}

function issuesFromReasons(reasons = [], defaults = {}) {
  return reasons.map((reason) => normalizeIssue(
    typeof reason === 'string' ? { reasonCode: reason } : reason,
    defaults,
  ));
}

async function recordIssues(queryable, recordOutcomeId, issues = []) {
  for (const rawIssue of issues) {
    const issue = normalizeIssue(rawIssue);

    await queryable.query(
      `
        INSERT INTO migration.record_issues (
          record_outcome_id,
          issue_type,
          severity,
          reason_code,
          source_field,
          details
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        recordOutcomeId,
        issue.issueType,
        issue.severity,
        issue.reasonCode,
        issue.sourceField,
        JSON.stringify(issue.details),
      ],
    );
  }
}

async function recordOutcome(queryable, runId, record) {
  if (!queryable || !runId) return null;

  const sourceId = normalizeSourceId(record.sourceId);
  const primaryReasonCode = record.primaryReasonCode
    || (record.outcome === OUTCOMES.MIGRATED
      ? null
      : record.issues?.[0]?.reasonCode || record.issues?.[0]?.reason || null);

  const rows = await queryable.query(
    `
      INSERT INTO migration.record_outcomes (
        migration_run_id,
        source_system,
        source_collection,
        source_id,
        source_checksum,
        outcome,
        primary_reason_code,
        target_schema,
        target_table,
        target_id,
        details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      ON CONFLICT (
        migration_run_id,
        source_system,
        source_collection,
        source_id
      ) DO UPDATE SET
        source_checksum = COALESCE(EXCLUDED.source_checksum, migration.record_outcomes.source_checksum),
        outcome = EXCLUDED.outcome,
        primary_reason_code = EXCLUDED.primary_reason_code,
        target_schema = EXCLUDED.target_schema,
        target_table = EXCLUDED.target_table,
        target_id = EXCLUDED.target_id,
        details = migration.record_outcomes.details || EXCLUDED.details,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `,
    [
      runId,
      record.sourceSystem || 'mongodb',
      record.sourceCollection,
      sourceId,
      record.sourceChecksum || null,
      record.outcome,
      primaryReasonCode,
      record.targetSchema || null,
      record.targetTable || null,
      record.targetId || null,
      JSON.stringify(record.details || {}),
    ],
  );

  const outcomeId = rows[0].id;
  await recordIssues(queryable, outcomeId, record.issues || []);

  return outcomeId;
}

async function recordMigrated(queryable, runId, record) {
  return recordOutcome(queryable, runId, {
    ...record,
    outcome: OUTCOMES.MIGRATED,
    issues: issuesFromReasons(record.warnings || record.issues || [], {
      issueType: 'normalization',
      severity: 'warning',
    }),
  });
}

function outcomeKey(sourceSystem, sourceCollection, sourceId) {
  return JSON.stringify([sourceSystem, sourceCollection, sourceId]);
}

async function recordMigratedBatch(queryable, runId, records = []) {
  if (!queryable || !runId || !records.length) return 0;

  const normalizedRecords = records.map((record) => ({
    source_system: record.sourceSystem || 'mongodb',
    source_collection: record.sourceCollection,
    source_id: normalizeSourceId(record.sourceId),
    source_checksum: record.sourceChecksum || null,
    target_schema: record.targetSchema || null,
    target_table: record.targetTable || null,
    target_id: record.targetId || null,
    details: record.details || {},
    warnings: issuesFromReasons(record.warnings || record.issues || [], {
      issueType: 'normalization',
      severity: 'warning',
    }),
  }));

  const rows = await queryable.query(
    `
      INSERT INTO migration.record_outcomes (
        migration_run_id,
        source_system,
        source_collection,
        source_id,
        source_checksum,
        outcome,
        primary_reason_code,
        target_schema,
        target_table,
        target_id,
        details
      )
      SELECT
        $1,
        input.source_system,
        input.source_collection,
        input.source_id,
        input.source_checksum,
        'migrated',
        NULL,
        input.target_schema,
        input.target_table,
        input.target_id,
        input.details
      FROM jsonb_to_recordset($2::jsonb) AS input(
        source_system text,
        source_collection text,
        source_id text,
        source_checksum text,
        target_schema text,
        target_table text,
        target_id uuid,
        details jsonb
      )
      ON CONFLICT (
        migration_run_id,
        source_system,
        source_collection,
        source_id
      ) DO UPDATE SET
        source_checksum = COALESCE(EXCLUDED.source_checksum, migration.record_outcomes.source_checksum),
        outcome = 'migrated',
        primary_reason_code = NULL,
        target_schema = EXCLUDED.target_schema,
        target_table = EXCLUDED.target_table,
        target_id = EXCLUDED.target_id,
        details = migration.record_outcomes.details || EXCLUDED.details,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, source_system, source_collection, source_id
    `,
    [runId, JSON.stringify(normalizedRecords)],
  );

  const outcomeIdByKey = new Map(rows.map((row) => [
    outcomeKey(row.source_system, row.source_collection, row.source_id),
    row.id,
  ]));

  const issues = normalizedRecords.flatMap((record) => record.warnings.map((warning) => ({
    record_outcome_id: outcomeIdByKey.get(outcomeKey(
      record.source_system,
      record.source_collection,
      record.source_id,
    )),
    issue_type: warning.issueType,
    severity: warning.severity,
    reason_code: warning.reasonCode,
    source_field: warning.sourceField,
    details: warning.details,
  })));

  if (issues.length) {
    await queryable.query(
      `
        INSERT INTO migration.record_issues (
          record_outcome_id,
          issue_type,
          severity,
          reason_code,
          source_field,
          details
        )
        SELECT
          input.record_outcome_id,
          input.issue_type,
          input.severity,
          input.reason_code,
          input.source_field,
          input.details
        FROM jsonb_to_recordset($1::jsonb) AS input(
          record_outcome_id uuid,
          issue_type text,
          severity text,
          reason_code text,
          source_field text,
          details jsonb
        )
      `,
      [JSON.stringify(issues)],
    );
  }

  return rows.length;
}

async function recordRejected(queryable, runId, record) {
  const rawIssues = record.reasons || record.issues || [];
  const issues = issuesFromReasons(
    rawIssues.length || !record.primaryReasonCode
      ? rawIssues
      : [{ reasonCode: record.primaryReasonCode, details: record.details }],
    {
      issueType: 'validation',
      severity: 'error',
    },
  );

  return recordOutcome(queryable, runId, {
    ...record,
    outcome: OUTCOMES.REJECTED,
    issues,
    primaryReasonCode: record.primaryReasonCode || issues[0]?.reasonCode,
  });
}

async function recordBlocked(queryable, runId, record) {
  const rawIssues = record.reasons || record.issues || [];
  const issues = issuesFromReasons(
    rawIssues.length || !record.primaryReasonCode
      ? rawIssues
      : [{ reasonCode: record.primaryReasonCode, details: record.details }],
    {
      issueType: 'identity',
      severity: 'error',
    },
  );

  return recordOutcome(queryable, runId, {
    ...record,
    outcome: OUTCOMES.BLOCKED,
    issues,
    primaryReasonCode: record.primaryReasonCode || issues[0]?.reasonCode,
  });
}

async function recordFailed(queryable, runId, record) {
  const error = record.error;
  const details = {
    ...(record.details || {}),
    ...(error ? { name: error.name, message: error.message } : {}),
  };

  return recordOutcome(queryable, runId, {
    ...record,
    outcome: OUTCOMES.FAILED,
    primaryReasonCode: record.primaryReasonCode || 'unexpected_migration_error',
    details,
    issues: [{
      issueType: 'technical',
      severity: 'error',
      reasonCode: record.primaryReasonCode || 'unexpected_migration_error',
      details,
    }],
  });
}

async function updateRunProgress(dataSource, runId, summary) {
  if (!dataSource || !runId) return;

  await dataSource.query(
    `
      UPDATE migration.runs
      SET last_scanned_source = $2,
          source_count = $3,
          migrated_count = $4,
          rejected_count = $5,
          blocked_count = $6,
          failed_count = $7,
          warning_count = $8
      WHERE id = $1
    `,
    [
      runId,
      summary.lastScannedSource,
      summary.sourceCount,
      summary.migratedCount,
      summary.rejectedCount,
      summary.blockedCount,
      summary.failedCount,
      summary.warningCount,
    ],
  );
}

async function reconcileOutcomeLedger(dataSource, runId, summary) {
  if (!dataSource || !runId || summary.scanOnly) return null;

  const rows = await dataSource.query(
    `
      SELECT
        count(*)::integer AS outcome_count,
        count(*) FILTER (WHERE outcome = 'migrated')::integer AS migrated_count,
        count(*) FILTER (WHERE outcome = 'rejected')::integer AS rejected_count,
        count(*) FILTER (WHERE outcome = 'blocked')::integer AS blocked_count,
        count(*) FILTER (WHERE outcome = 'failed')::integer AS failed_count
      FROM migration.record_outcomes
      WHERE migration_run_id = $1
    `,
    [runId],
  );

  const counts = rows[0] || {};
  const targetValue = {
    outcomeCount: Number(counts.outcome_count || 0),
    migrated: Number(counts.migrated_count || 0),
    rejected: Number(counts.rejected_count || 0),
    blocked: Number(counts.blocked_count || 0),
    failed: Number(counts.failed_count || 0),
  };

  const sourceValue = {
    sourceCount: summary.sourceCount,
    migrated: summary.migratedCount,
    rejected: summary.rejectedCount,
    blocked: summary.blockedCount,
    failed: summary.failedCount,
  };

  const terminalTotal = summary.migratedCount
    + summary.rejectedCount
    + summary.blockedCount
    + summary.failedCount;

  const passed = terminalTotal === summary.sourceCount
    && targetValue.outcomeCount === summary.sourceCount
    && targetValue.migrated === summary.migratedCount
    && targetValue.rejected === summary.rejectedCount
    && targetValue.blocked === summary.blockedCount
    && targetValue.failed === summary.failedCount;

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
      ) VALUES ($1, 'migration_audit', $2, $3::jsonb, $4::jsonb, $5, $6::jsonb)
    `,
    [
      runId,
      'migration_record_outcomes_accounted_for',
      JSON.stringify(sourceValue),
      JSON.stringify(targetValue),
      passed,
      JSON.stringify({ terminalTotal }),
    ],
  );

  return {
    checkName: 'migration_record_outcomes_accounted_for',
    sourceValue,
    targetValue,
    passed,
    details: { terminalTotal },
  };
}

module.exports = {
  OUTCOMES,
  issuesFromReasons,
  normalizeSourceId,
  reconcileOutcomeLedger,
  recordBlocked,
  recordFailed,
  recordIssues,
  recordMigrated,
  recordMigratedBatch,
  recordOutcome,
  recordRejected,
  updateRunProgress,
};
