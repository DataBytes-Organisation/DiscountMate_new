class CreateMigrationInfrastructure1786579200001 {
  name = 'CreateMigrationInfrastructure1786579200001';

  async up(queryRunner) {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS citext');
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS app');
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS migration');

    await queryRunner.query(`
            CREATE TABLE migration.runs (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                migration_name text NOT NULL,
                phase text NOT NULL,
                source_database text,
                status text NOT NULL CHECK (status IN ('running', 'completed', 'completed_with_errors', 'failed')),
                last_scanned_source text,
                source_count bigint NOT NULL DEFAULT 0,
                target_count bigint NOT NULL DEFAULT 0,
                skipped_count bigint NOT NULL DEFAULT 0,
                failed_count bigint NOT NULL DEFAULT 0,
                error_summary jsonb,
                options jsonb,
                started_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at timestamptz
            )
        `);

    await queryRunner.query(`
            CREATE TABLE migration.entity_id_map (
                source_system text NOT NULL,
                source_collection text NOT NULL,
                source_id text NOT NULL,
                target_schema text NOT NULL,
                target_table text NOT NULL,
                target_id uuid NOT NULL,
                migration_run_id uuid REFERENCES migration.runs(id) ON DELETE SET NULL,
                source_checksum text,
                migrated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (
                    source_system,
                    source_collection,
                    source_id,
                    target_schema,
                    target_table
                )
            )
        `);

    await queryRunner.query(`
            CREATE UNIQUE INDEX uq_entity_id_map_target
            ON migration.entity_id_map (target_schema, target_table, target_id)
        `);

    await queryRunner.query(`
            CREATE TABLE migration.reconciliation_results (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                migration_run_id uuid NOT NULL REFERENCES migration.runs(id) ON DELETE CASCADE,
                entity_type text NOT NULL,
                check_name text NOT NULL,
                source_value jsonb,
                target_value jsonb,
                passed boolean NOT NULL,
                details jsonb,
                checked_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

    await queryRunner.query(`
            CREATE INDEX idx_reconciliation_results_run
            ON migration.reconciliation_results (migration_run_id, passed)
        `);

    await queryRunner.query(`
            CREATE TABLE migration.unmapped_documents (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                migration_run_id uuid REFERENCES migration.runs(id) ON DELETE SET NULL,
                source_collection text NOT NULL,
                source_id text,
                reason text NOT NULL,
                payload jsonb,
                resolved_at timestamptz,
                created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

    await queryRunner.query(`
            CREATE INDEX idx_unmapped_documents_source
            ON migration.unmapped_documents (source_collection, source_id)
            WHERE resolved_at IS NULL
        `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS migration.unmapped_documents');
    await queryRunner.query('DROP TABLE IF EXISTS migration.reconciliation_results');
    await queryRunner.query('DROP TABLE IF EXISTS migration.entity_id_map');
    await queryRunner.query('DROP TABLE IF EXISTS migration.runs');
    await queryRunner.query('DROP SCHEMA IF EXISTS migration');
    await queryRunner.query('DROP SCHEMA IF EXISTS app');
  }
}

module.exports = { CreateMigrationInfrastructure1786579200001 };
