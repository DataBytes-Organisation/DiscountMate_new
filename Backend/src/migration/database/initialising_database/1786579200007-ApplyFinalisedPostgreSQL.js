const FIELD_BACKUPS = [
  {
    table: 'app.user_profiles',
    idColumn: 'user_id',
    columns: [
      ['legacy_profile_id', 'text'],
    ],
  },
  {
    table: 'app.user_dashboard_preferences',
    idColumn: 'user_id',
    columns: [
      ['legacy_selected_list_id', 'text'],
      ['selected_retailer_key', 'text'],
    ],
  },
  {
    table: 'app.receipts',
    idColumn: 'id',
    columns: [
      ['source_receipt_key', 'text'],
      ['raw_payload', 'jsonb'],
    ],
  },
  {
    table: 'app.receipt_items',
    idColumn: 'id',
    columns: [
      ['raw_payload', 'jsonb'],
    ],
  },
  {
    table: 'app.shopping_list_items',
    idColumn: 'id',
    columns: [
      ['legacy_product_identifier', 'text'],
      ['selected_retailer_key', 'text'],
      ['legacy_category_identifier', 'text'],
      ['raw_payload', 'jsonb'],
    ],
  },
  {
    table: 'app.list_pricing_snapshots',
    idColumn: 'id',
    columns: [
      ['selected_retailer_key', 'text'],
      ['cheapest_retailer_key', 'text'],
      ['highest_retailer_key', 'text'],
      ['raw_payload', 'jsonb'],
    ],
  },
  {
    table: 'app.notification_product_references',
    idColumn: 'id',
    columns: [
      ['legacy_product_identifier', 'text'],
    ],
  },
  {
    table: 'app.product_api_compatibility',
    idColumn: 'product_id',
    columns: [
      ['legacy_gtin', 'text'],
      ['legacy_measurement', 'text'],
    ],
  },
];

const FINALISED_COLUMN_RENAMES = [
  {
    table: 'app.list_pricing_snapshots',
    migrationColumn: 'legacy_shopping_list_id',
    finalisedColumn: 'snapshot_list_key',
  },
];

function jsonBuildExpression(columns) {
  return `jsonb_build_object(${columns
    .flatMap(([column]) => [`'${column}'`, `source.${column}`])
    .join(', ')})`;
}

async function backupFields(queryRunner, specification) {
  await queryRunner.query(`
    INSERT INTO migration.finalised_schema_field_backup (
      table_name,
      record_id,
      fields
    )
    SELECT
      '${specification.table}',
      source.${specification.idColumn}::text,
      ${jsonBuildExpression(specification.columns)}
    FROM ${specification.table} source
    ON CONFLICT (table_name, record_id) DO UPDATE SET
      fields = EXCLUDED.fields,
      backed_up_at = CURRENT_TIMESTAMP
  `);
}

async function dropFields(queryRunner, specification) {
  for (const [column] of specification.columns) {
    await queryRunner.query(
      `ALTER TABLE ${specification.table} DROP COLUMN ${column}`,
    );
  }
}

function restoreExpression(column, type) {
  if (type === 'jsonb') {
    return `NULLIF(backup.fields -> '${column}', 'null'::jsonb)`;
  }

  return `backup.fields ->> '${column}'`;
}

async function restoreFields(queryRunner, specification) {
  for (const [column, type] of specification.columns) {
    await queryRunner.query(
      `ALTER TABLE ${specification.table} ADD COLUMN ${column} ${type}`,
    );
  }

  await queryRunner.query(`
    UPDATE ${specification.table} target
    SET ${specification.columns
    .map(([column, type]) => `${column} = ${restoreExpression(column, type)}`)
    .join(',\n        ')}
    FROM migration.finalised_schema_field_backup backup
    WHERE backup.table_name = '${specification.table}'
      AND backup.record_id = target.${specification.idColumn}::text
  `);
}

async function renameColumnsToFinalised(queryRunner) {
  for (const specification of FINALISED_COLUMN_RENAMES) {
    await queryRunner.query(
      `ALTER TABLE ${specification.table} RENAME COLUMN ${specification.migrationColumn} TO ${specification.finalisedColumn}`,
    );
  }
}

async function restoreMigrationColumnNames(queryRunner) {
  for (const specification of [...FINALISED_COLUMN_RENAMES].reverse()) {
    await queryRunner.query(
      `ALTER TABLE ${specification.table} RENAME COLUMN ${specification.finalisedColumn} TO ${specification.migrationColumn}`,
    );
  }
}

class ApplyFinalisedPostgreSQL1786579200007 {
  name = 'ApplyFinalisedPostgreSQL1786579200007';

  async up(queryRunner) {
    const guards = await queryRunner.query(`
      SELECT
        (SELECT count(*)::integer
         FROM migration.reference_resolution_issues
         WHERE resolved_at IS NULL AND required = true) AS required_reference_issues,
        (SELECT count(*)::integer
         FROM migration.runs
         WHERE status = 'running') AS running_migrations
    `);

    if (Number(guards[0]?.required_reference_issues || 0) > 0) {
      throw new Error('Finalised PostgreSQL blocked: required reference issues remain unresolved.');
    }

    if (Number(guards[0]?.running_migrations || 0) > 0) {
      throw new Error('Finalised PostgreSQL blocked: a data migration is still running.');
    }

    await queryRunner.query(`
      CREATE TABLE migration.finalised_schema_field_backup (
        table_name text NOT NULL,
        record_id text NOT NULL,
        fields jsonb NOT NULL,
        backed_up_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (table_name, record_id)
      )
    `);

    await queryRunner.query(
      'REVOKE ALL ON migration.finalised_schema_field_backup FROM PUBLIC',
    );

    await queryRunner.query(`
      COMMENT ON TABLE migration.finalised_schema_field_backup IS
      'Restricted reversible backup for fields removed when applying Finalised PostgreSQL.'
    `);

    for (const specification of FIELD_BACKUPS) {
      await backupFields(queryRunner, specification);
      await dropFields(queryRunner, specification);
    }

    await renameColumnsToFinalised(queryRunner);

    await queryRunner.query(
      'ALTER TABLE app.user_legacy_metrics RENAME TO user_metrics',
    );
    await queryRunner.query(
      'ALTER TABLE app.notification_product_references RENAME TO notification_products',
    );
    await queryRunner.query(
      'ALTER TABLE app.category_api_compatibility RENAME TO category_metadata',
    );
    await queryRunner.query(
      'ALTER TABLE app.product_api_compatibility RENAME TO product_metadata',
    );
    await queryRunner.query(
      'ALTER TABLE app.catalog_source_keys SET SCHEMA migration',
    );
    await queryRunner.query(
      'ALTER TABLE app.product_price_source_records SET SCHEMA migration',
    );
  }

  async down(queryRunner) {
    await queryRunner.query(
      'ALTER TABLE migration.product_price_source_records SET SCHEMA app',
    );
    await queryRunner.query(
      'ALTER TABLE migration.catalog_source_keys SET SCHEMA app',
    );
    await queryRunner.query(
      'ALTER TABLE app.product_metadata RENAME TO product_api_compatibility',
    );
    await queryRunner.query(
      'ALTER TABLE app.category_metadata RENAME TO category_api_compatibility',
    );
    await queryRunner.query(
      'ALTER TABLE app.notification_products RENAME TO notification_product_references',
    );
    await queryRunner.query(
      'ALTER TABLE app.user_metrics RENAME TO user_legacy_metrics',
    );

    await restoreMigrationColumnNames(queryRunner);

    for (const specification of FIELD_BACKUPS) {
      await restoreFields(queryRunner, specification);
    }

    await queryRunner.query(`
      UPDATE app.user_dashboard_preferences
      SET selected_retailer_key = 'coles'
      WHERE selected_retailer_key IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE app.user_dashboard_preferences
      ALTER COLUMN selected_retailer_key SET DEFAULT 'coles',
      ALTER COLUMN selected_retailer_key SET NOT NULL,
      ADD CONSTRAINT ck_user_dashboard_selected_retailer_key
        CHECK (selected_retailer_key IN ('aldi', 'coles', 'woolworths', 'iga'))
    `);

    await queryRunner.query(`
      UPDATE app.shopping_list_items
      SET legacy_product_identifier = COALESCE(
        legacy_product_identifier,
        product_id::text,
        'finalised:shopping-list-item:' || id::text
      )
    `);
    await queryRunner.query(`
      ALTER TABLE app.shopping_list_items
      ALTER COLUMN legacy_product_identifier SET NOT NULL,
      ADD CONSTRAINT ck_shopping_list_items_selected_retailer_key
        CHECK (
          selected_retailer_key IS NULL
          OR selected_retailer_key IN ('aldi', 'coles', 'woolworths', 'iga')
        )
    `);

    await queryRunner.query(`
      UPDATE app.list_pricing_snapshots
      SET legacy_shopping_list_id = COALESCE(
        legacy_shopping_list_id,
        shopping_list_id::text,
        'finalised:list-pricing-snapshot:' || id::text
      )
    `);
    await queryRunner.query(`
      ALTER TABLE app.list_pricing_snapshots
      ALTER COLUMN legacy_shopping_list_id SET NOT NULL,
      ADD CONSTRAINT ck_list_pricing_snapshots_selected_retailer_key
        CHECK (
          selected_retailer_key IS NULL
          OR selected_retailer_key IN ('aldi', 'coles', 'woolworths', 'iga')
        )
    `);

    await queryRunner.query(`
      UPDATE app.notification_product_references
      SET legacy_product_identifier = COALESCE(
        legacy_product_identifier,
        product_id::text,
        'finalised:notification-product:' || id::text
      )
    `);
    await queryRunner.query(`
      ALTER TABLE app.notification_product_references
      ALTER COLUMN legacy_product_identifier SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE app.receipts
      ADD CONSTRAINT uq_receipts_source_receipt_key UNIQUE (source_receipt_key)
    `);

    await queryRunner.query('DROP TABLE migration.finalised_schema_field_backup');
  }
}

module.exports = {
  ApplyFinalisedPostgreSQL1786579200007,
  FIELD_BACKUPS,
  FINALISED_COLUMN_RENAMES,
  jsonBuildExpression,
};
