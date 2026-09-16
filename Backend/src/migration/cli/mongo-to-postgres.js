const path = require('path');
const { MongoClient } = require('mongodb');
const { parseCliOptions, usage } = require('./lib/cli-options');
const { resolveKnownReferenceIssues } = require('./lib/reference-audit');
const { reconcileOutcomeLedger } = require('./lib/migration-audit');
const { reconcileShoppingLists, runShoppingListsPhase } = require('./phases/shopping-lists.phase');
const { reconcileAlertsNotifications, runAlertsNotificationsPhase } = require('./phases/alerts-notifications.phase');
const { reconcileSupportRequests, runSupportRequestsPhase } = require('./phases/support-requests.phase');
const { reconcileCatalog, runCatalogPhase } = require('./phases/catalog.phase');
const { reconcileProductPricing, runProductPricingPhase } = require('./phases/product-pricing.phase');
const { reconcileUsers, runUsersPhase } = require('./phases/users.phase');
const PHASES = {
  users: {
    run: runUsersPhase,
    reconcile: reconcileUsers,
  },
  'shopping-lists': {
    run: runShoppingListsPhase,
    reconcile: reconcileShoppingLists,
  },
  'alerts-notifications': {
    run: runAlertsNotificationsPhase,
    reconcile: reconcileAlertsNotifications,
  },
  'support-requests': {
    run: runSupportRequestsPhase,
    reconcile: reconcileSupportRequests,
  },
  catalog: {
    run: runCatalogPhase,
    reconcile: reconcileCatalog,
  },
  'product-pricing': {
    run: runProductPricingPhase,
    reconcile: reconcileProductPricing,
  },
};

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({
    path: path.join(__dirname, '..', '..', '..', '.env'),
  });
}

function formatProgress(summary, reconciliation = null) {
  const progress = [
    `progress=${summary.scannedCount}/${summary.sourceCount}`,
    `migrated=${summary.migratedCount}`,
    `rejected=${summary.rejectedCount}`,
    `blocked=${summary.blockedCount}`,
    `failed=${summary.failedCount}`,
    `warnings=${summary.warningCount}`,
  ];

  if (reconciliation) {
    const checks = Array.isArray(reconciliation.results) ? reconciliation.results : [];
    const passedChecks = checks.filter((check) => check.passed).length;
    progress.push(`checks=${passedChecks}/${checks.length}`);
  }

  return progress.join(' ');
}

function printProgress(summary, reconciliation = null) {
  process.stdout.write(`\r${formatProgress(summary, reconciliation)}`);
}

async function assertMigrationSchema(dataSource, phase) {
  const rows = await dataSource.query(`
        SELECT
            to_regclass('migration.runs') AS migration_runs,
            to_regclass('migration.record_outcomes') AS record_outcomes,
            to_regclass('migration.record_issues') AS record_issues,
            to_regclass('migration.reference_resolution_issues') AS reference_issues,
            to_regclass('app.users') AS app_users,
            to_regclass('app.shopping_lists') AS app_shopping_lists,
            to_regclass('app.alert_segments') AS app_alert_segments,
            to_regclass('app.notifications') AS app_notifications,
            to_regclass('app.support_requests') AS app_support_requests,
            to_regclass('app.support_request_attachments') AS app_support_attachments,
            to_regclass('silver.dim_retailers') AS silver_retailers,
            to_regclass('silver.dim_categories') AS silver_categories,
            to_regclass('silver.dim_products') AS silver_products,
            to_regclass('silver.fct_product_prices') AS silver_product_prices,
            to_regclass('app.catalog_source_keys') AS app_catalog_source_keys,
            to_regclass('app.category_api_compatibility') AS app_category_compatibility,
            to_regclass('app.product_api_compatibility') AS app_product_compatibility,
            to_regclass('app.product_price_source_records') AS app_product_price_sources
    `);

  if (
    !rows[0]?.migration_runs
    || !rows[0]?.record_outcomes
    || !rows[0]?.record_issues
    || !rows[0]?.reference_issues
    || !rows[0]?.app_users
  ) {
    throw new Error('PostgreSQL migration tables are missing. Run `npm run db:migrate` first.');
  }

  if (phase === 'users' && !rows[0]?.silver_retailers) {
    throw new Error('Retailer references are missing. Run `npm run db:silver:setup` first.');
  }

  if (phase === 'shopping-lists' && !rows[0]?.app_shopping_lists) {
    throw new Error('Shopping-list tables are missing. Run `npm run db:migrate` first.');
  }

  if (
    phase === 'alerts-notifications'
      && (!rows[0]?.app_alert_segments || !rows[0]?.app_notifications)
  ) {
    throw new Error('Alert/notification tables are missing. Run `npm run db:migrate` first.');
  }

  if (
    phase === 'support-requests'
      && (!rows[0]?.app_support_requests || !rows[0]?.app_support_attachments)
  ) {
    throw new Error('Support-request tables are missing. Run `npm run db:migrate` first.');
  }

  if (
    phase === 'shopping-lists'
      && (!rows[0]?.silver_retailers
        || !rows[0]?.silver_categories
        || !rows[0]?.silver_products
        || !rows[0]?.app_catalog_source_keys)
  ) {
    throw new Error('Catalogue references are missing. Run `npm run db:migrate` and `npm run db:silver:setup` first.');
  }

  if (
    phase === 'alerts-notifications'
      && (!rows[0]?.silver_categories
        || !rows[0]?.silver_products
        || !rows[0]?.app_catalog_source_keys)
  ) {
    throw new Error('Category/product references are missing. Run `npm run db:migrate` and `npm run db:silver:setup` first.');
  }

  if (
    phase === 'catalog'
      && (!rows[0]?.silver_categories
        || !rows[0]?.silver_products
        || !rows[0]?.app_catalog_source_keys
        || !rows[0]?.app_category_compatibility
        || !rows[0]?.app_product_compatibility)
  ) {
    throw new Error('Catalogue tables are missing. Run `npm run db:migrate` and `npm run db:silver:setup` first.');
  }

  if (
    phase === 'product-pricing'
      && (!rows[0]?.silver_retailers
        || !rows[0]?.silver_categories
        || !rows[0]?.silver_products
        || !rows[0]?.silver_product_prices
        || !rows[0]?.app_catalog_source_keys
        || !rows[0]?.app_product_price_sources)
  ) {
    throw new Error('Product-pricing tables are missing. Run `npm run db:migrate` and `npm run db:silver:setup` first.');
  }
}

async function createRun(dataSource, options) {
  const rows = await dataSource.query(
    `
            INSERT INTO migration.runs (
                migration_name,
                phase,
                source_database,
                status,
                last_scanned_source,
                options
            ) VALUES ('mongo_to_postgres', $1, $2, 'running', $3, $4::jsonb)
            RETURNING id
        `,
    [
      options.reconcileOnly ? `${options.phase}_reconciliation` : options.phase,
      options.sourceDb,
      options.afterId,
      JSON.stringify({
        batchSize: options.batchSize,
        afterId: options.afterId,
        failFast: options.failFast,
        reconcileOnly: options.reconcileOnly,
        orchestrationId: process.env.MIGRATION_ORCHESTRATION_ID || null,
      }),
    ],
  );

  return rows[0].id;
}

function determineRunStatus(summary, reconciliation, failure = null) {
  if (failure || summary.failedCount > 0) return 'failed';
  if (summary.blockedCount > 0 || !reconciliation?.passed) return 'completed_with_errors';

  if (summary.rejectedCount > 0 || summary.warningCount > 0) {
    return 'completed_with_warnings';
  }

  return 'completed';
}

function determineExitCode(summary, reconciliation) {
  if (summary.failedCount > 0) return 1;
  if (summary.blockedCount > 0 || !reconciliation?.passed) return 2;

  return 0;
}

async function finishRun(dataSource, runId, summary, reconciliation, failure = null) {
  const status = determineRunStatus(summary, reconciliation, failure);

  await dataSource.query(
    `
            UPDATE migration.runs
            SET status = $2,
                last_scanned_source = $3,
                source_count = $4,
                migrated_count = $5,
                rejected_count = $6,
                blocked_count = $7,
                failed_count = $8,
                warning_count = $9,
                error_summary = $10::jsonb,
                completed_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `,
    [
      runId,
      status,
      summary.lastScannedSource,
      summary.sourceCount,
      summary.migratedCount,
      summary.rejectedCount,
      summary.blockedCount,
      summary.failedCount,
      summary.warningCount,
      JSON.stringify(failure
        ? { name: failure.name, message: failure.message }
        : { reconciliationPassed: reconciliation?.passed ?? null }),
    ],
  );
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const phase = PHASES[options.phase];

  if (options.help) {
    console.log(usage());

    return;
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required');
  }

  const mongoClient = new MongoClient(process.env.MONGO_URI);
  let dataSource = null;
  let runId = null;
  let summary = {
    sourceCount: 0,
    scannedCount: 0,
    validCount: 0,
    migratedCount: 0,
    rejectedCount: 0,
    blockedCount: 0,
    failedCount: 0,
    warningCount: 0,
    lastScannedSource: options.afterId,
    partial: Boolean(options.afterId),
  };

  try {
    await mongoClient.connect();
    const mongoDb = mongoClient.db(options.sourceDb);
    const { AppDataSource } = require('../database/app-data-source');
    dataSource = AppDataSource;
    await dataSource.initialize();
    await assertMigrationSchema(dataSource, options.phase);
    runId = await createRun(dataSource, options);

    const phaseOptions = {
      ...options,
      scanOnly: options.reconcileOnly,
    };
    summary = await phase.run({
      mongoDb,
      dataSource: phaseOptions.scanOnly ? null : dataSource,
      runId: phaseOptions.scanOnly ? null : runId,
      options: phaseOptions,
      onProgress: printProgress,
    });

    await resolveKnownReferenceIssues(dataSource);

    const reconciliation = await phase.reconcile({
      dataSource,
      runId,
      sourceSummary: summary,
    });

    const outcomeCheck = await reconcileOutcomeLedger(dataSource, runId, summary);

    if (outcomeCheck) {
      reconciliation.results.push(outcomeCheck);
      reconciliation.passed = reconciliation.passed && outcomeCheck.passed;
    }
    await finishRun(dataSource, runId, summary, reconciliation);

    printProgress(summary, reconciliation);
    process.stdout.write('\n');

    const exitCode = determineExitCode(summary, reconciliation);

    if (exitCode) process.exitCode = exitCode;
  } catch (error) {
    if (dataSource?.isInitialized && runId) {
      await finishRun(dataSource, runId, summary, null, error).catch(() => {});
    }
    throw error;
  } finally {
    await mongoClient.close().catch(() => {});

    if (dataSource?.isInitialized) {
      await dataSource.destroy().catch(() => {});
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`\nMigration failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  determineExitCode,
  determineRunStatus,
  formatProgress,
  main,
  printProgress,
};
