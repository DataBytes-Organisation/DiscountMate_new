function normalizeRun(row) {
  return {
    phase: row.phase,
    status: row.status,
    sourceCount: Number(row.source_count || 0),
    migratedCount: Number(row.migrated_count || 0),
    rejectedCount: Number(row.rejected_count || 0),
    blockedCount: Number(row.blocked_count || 0),
    failedCount: Number(row.failed_count || 0),
    warningCount: Number(row.warning_count || 0),
    passedChecks: Number(row.passed_checks || 0),
    checkCount: Number(row.check_count || 0),
  };
}

function totalRuns(runs) {
  return runs.reduce((totals, run) => ({
    sourceCount: totals.sourceCount + run.sourceCount,
    migratedCount: totals.migratedCount + run.migratedCount,
    rejectedCount: totals.rejectedCount + run.rejectedCount,
    blockedCount: totals.blockedCount + run.blockedCount,
    failedCount: totals.failedCount + run.failedCount,
    warningCount: totals.warningCount + run.warningCount,
    passedChecks: totals.passedChecks + run.passedChecks,
    checkCount: totals.checkCount + run.checkCount,
  }), {
    sourceCount: 0,
    migratedCount: 0,
    rejectedCount: 0,
    blockedCount: 0,
    failedCount: 0,
    warningCount: 0,
    passedChecks: 0,
    checkCount: 0,
  });
}

function formatCounts(counts, mode) {
  const migratedLabel = mode === 'reconciliation' ? 'expected_migrated' : 'migrated';

  return [
    `scanned=${counts.sourceCount}`,
    `${migratedLabel}=${counts.migratedCount}`,
    `rejected=${counts.rejectedCount}`,
    `blocked=${counts.blockedCount}`,
    `failed=${counts.failedCount}`,
    `warnings=${counts.warningCount}`,
    `checks=${counts.passedChecks}/${counts.checkCount}`,
  ].join(' ');
}

async function loadOrchestrationRuns(dataSource, orchestrationId) {
  const rows = await dataSource.query(
    `
      SELECT
        run.phase,
        run.status,
        run.source_count,
        run.migrated_count,
        run.rejected_count,
        run.blocked_count,
        run.failed_count,
        run.warning_count,
        count(result.id)::integer AS check_count,
        count(result.id) FILTER (WHERE result.passed)::integer AS passed_checks
      FROM migration.runs run
      LEFT JOIN migration.reconciliation_results result
        ON result.migration_run_id = run.id
      WHERE run.options ->> 'orchestrationId' = $1
      GROUP BY run.id
      ORDER BY
        CASE run.phase
          WHEN 'users' THEN 1
          WHEN 'support-requests' THEN 2
          WHEN 'catalog' THEN 3
          WHEN 'product-pricing' THEN 4
          WHEN 'shopping-lists' THEN 5
          WHEN 'alerts-notifications' THEN 6
          ELSE 7
        END,
        run.started_at,
        run.id
    `,
    [orchestrationId],
  );

  return rows.map(normalizeRun);
}

async function printOrchestrationSummary(orchestrationId, mode) {
  const { AppDataSource } = require('../../database/app-data-source');
  let initializedHere = false;

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      initializedHere = true;
    }

    const runs = await loadOrchestrationRuns(AppDataSource, orchestrationId);
    const heading = mode === 'reconciliation'
      ? 'Overall reconciliation totals'
      : 'Overall migration totals';

    console.log(heading);

    if (!runs.length) {
      console.log('No phase runs were recorded.');

      return [];
    }

    console.log(`TOTAL ${formatCounts(totalRuns(runs), mode)}`);

    return runs;
  } finally {
    if (initializedHere && AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

module.exports = {
  formatCounts,
  loadOrchestrationRuns,
  normalizeRun,
  printOrchestrationSummary,
  totalRuns,
};
