const {
  AppDataSource,
} = require('../database/app-data-source');

const FINALISED_PROJECTIONS = [
  {
    sourceTable: 'app.users',
    proposedTable: 'app.users',
    omit: {},
  },
  {
    sourceTable: 'app.user_profiles',
    proposedTable: 'app.user_profiles',
    omit: {
      legacy_profile_id: 'MongoDB-only identity; migration.entity_id_map owns source identity.',
    },
  },
  {
    sourceTable: 'app.user_dashboard_preferences',
    proposedTable: 'app.user_dashboard_preferences',
    omit: {
      legacy_selected_list_id: 'Replaced by selected_list_id after reference resolution.',
      selected_retailer_key: 'Controller can derive the API label through selected_retailer_id.',
    },
  },
  {
    sourceTable: 'app.user_legacy_metrics',
    proposedTable: 'app.user_metrics',
    omit: {},
  },
  {
    sourceTable: 'app.receipts',
    proposedTable: 'app.receipts',
    omit: {
      source_receipt_key: 'Migration idempotency key; not part of the runtime receipt model.',
      raw_payload: 'Temporary source-fidelity payload.',
    },
  },
  {
    sourceTable: 'app.receipt_items',
    proposedTable: 'app.receipt_items',
    omit: { raw_payload: 'Temporary source-fidelity payload.' },
  },
  {
    sourceTable: 'app.shopping_lists',
    proposedTable: 'app.shopping_lists',
    omit: {},
  },
  {
    sourceTable: 'app.shopping_list_items',
    proposedTable: 'app.shopping_list_items',
    omit: {
      legacy_product_identifier: 'Replaced by product_id after reference resolution.',
      selected_retailer_key: 'Controller can derive the API label through retailer_id.',
      legacy_category_identifier: 'Replaced by category_id after reference resolution.',
      raw_payload: 'Temporary source-fidelity payload.',
    },
  },
  {
    sourceTable: 'app.list_pricing_snapshots',
    proposedTable: 'app.list_pricing_snapshots',
    rename: {
      legacy_shopping_list_id: 'snapshot_list_key',
    },
    omit: {
      selected_retailer_key: 'Controller-controlled API compatibility field.',
      cheapest_retailer_key: 'Controller-controlled API compatibility field.',
      highest_retailer_key: 'Controller-controlled API compatibility field.',
      raw_payload: 'Temporary source-fidelity payload.',
    },
  },
  {
    sourceTable: 'app.alert_segments',
    proposedTable: 'app.alert_segments',
    omit: {},
  },
  {
    sourceTable: 'app.notifications',
    proposedTable: 'app.notifications',
    omit: {},
  },
  {
    sourceTable: 'app.notification_product_references',
    proposedTable: 'app.notification_products',
    omit: {
      legacy_product_identifier: 'Replaced by product_id after reference resolution.',
    },
  },
  {
    sourceTable: 'app.category_api_compatibility',
    proposedTable: 'app.category_metadata',
    omit: {},
  },
  {
    sourceTable: 'app.product_api_compatibility',
    proposedTable: 'app.product_metadata',
    omit: {
      legacy_gtin: 'Source-only malformed/alternate identifier.',
      legacy_measurement: 'Replaced by canonical pack_quantity and pack_uom.',
    },
  },
  {
    sourceTable: 'silver.dim_categories',
    proposedTable: 'silver.dim_categories',
    omit: {},
  },
  {
    sourceTable: 'silver.dim_products',
    proposedTable: 'silver.dim_products',
    omit: {},
  },
  {
    sourceTable: 'silver.dim_retailers',
    proposedTable: 'silver.dim_retailers',
    omit: {},
  },
  {
    sourceTable: 'silver.fct_product_prices',
    proposedTable: 'silver.fct_product_prices',
    omit: {},
  },
];

const AUDIT_ONLY_TABLES = [
  'app.catalog_source_keys',
  'app.product_price_source_records',
  'migration.entity_id_map',
  'migration.record_issues',
  'migration.record_outcomes',
  'migration.reference_resolution_issues',
  'migration.reconciliation_results',
  'migration.runs',
];

function splitTableName(tableName) {
  const [schema, table] = tableName.split('.');

  return { schema, table };
}

function buildProjection(definition, columns) {
  const renamedFields = definition.rename || {};
  const omittedFields = Object.entries(definition.omit)
    .filter(([field]) => columns.includes(field))
    .map(([field, reason]) => ({ field, reason }));

  return {
    sourceTable: definition.sourceTable,
    proposedTable: definition.proposedTable,
    fields: columns
      .filter((field) => !Object.hasOwn(definition.omit, field))
      .map((field) => renamedFields[field] || field),
    omittedFields,
  };
}

async function loadColumns(dataSource) {
  const rows = await dataSource.query(`
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema IN ('app', 'silver')
    ORDER BY table_schema, table_name, ordinal_position
  `);

  const columnsByTable = new Map();

  for (const row of rows) {
    const tableName = `${row.table_schema}.${row.table_name}`;
    const fields = columnsByTable.get(tableName) || [];
    fields.push(row.column_name);
    columnsByTable.set(tableName, fields);
  }

  return columnsByTable;
}

async function loadUnresolvedReferences(dataSource) {
  const exists = await dataSource.query(
    'SELECT to_regclass(\'migration.reference_resolution_issues\') AS table_name',
  );

  if (!exists[0]?.table_name) {
    throw new Error('Reference audit table is missing. Run `npm run db:migrate` first.');
  }

  return dataSource.query(`
    SELECT
      target_schema || '.' || target_table AS target,
      source_collection,
      source_field,
      reason_code AS reason,
      required,
      count(*)::integer AS count
    FROM migration.reference_resolution_issues
    WHERE resolved_at IS NULL
    GROUP BY target_schema, target_table, source_collection, source_field, reason_code, required
    ORDER BY required DESC, target, source_collection, source_field, reason_code
  `);
}

async function createPreview(dataSource) {
  const [columnsByTable, unresolvedReferences, finalisedState] = await Promise.all([
    loadColumns(dataSource),
    loadUnresolvedReferences(dataSource),
    dataSource.query(
      'SELECT to_regclass(\'migration.finalised_schema_field_backup\') AS backup_table',
    ),
  ]);

  const tables = FINALISED_PROJECTIONS.map((definition) => {
    const actualTable = columnsByTable.has(definition.sourceTable)
      ? definition.sourceTable
      : definition.proposedTable;

    const columns = columnsByTable.get(actualTable);

    if (!columns) {
      return {
        sourceTable: definition.sourceTable,
        proposedTable: definition.proposedTable,
        missing: true,
        fields: [],
        omittedFields: [],
      };
    }

    return buildProjection(definition, columns);
  });

  const requiredReferenceFailureCount = unresolvedReferences
    .filter((reference) => reference.required)
    .reduce((total, reference) => total + Number(reference.count), 0);

  const standaloneSnapshotReferenceCount = unresolvedReferences
    .filter((reference) => reference.reason === 'shopping_list_not_migrated')
    .reduce((total, reference) => total + Number(reference.count), 0);

  const totalReferenceFailureCount = unresolvedReferences
    .reduce((total, reference) => total + Number(reference.count), 0);

  return {
    mode: 'finalised-schema-preview',
    readOnly: true,
    finalisedSchemaApplied: Boolean(finalisedState[0]?.backup_table),
    explanation: 'Compatibility data is excluded from this proposed contract but is not dropped from PostgreSQL. Standalone pricing snapshots retain a durable snapshot_list_key.',
    tables,
    auditOnlyTables: AUDIT_ONLY_TABLES,
    unresolvedReferences,
    cleanupAllowed: requiredReferenceFailureCount === 0,
    requiredReferenceFailureCount,
    optionalReferenceFailureCount: totalReferenceFailureCount - requiredReferenceFailureCount,
    standaloneSnapshotReferenceCount,
  };
}

async function main() {
  await AppDataSource.initialize();

  try {
    console.log(JSON.stringify(await createPreview(AppDataSource), null, 2));
  } finally {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Finalised PostgreSQL preview failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  AUDIT_ONLY_TABLES,
  FINALISED_PROJECTIONS,
  buildProjection,
  createPreview,
  splitTableName,
};
