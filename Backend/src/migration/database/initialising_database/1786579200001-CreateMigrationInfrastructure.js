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
                status text NOT NULL,
                last_scanned_source text,
                source_count bigint NOT NULL DEFAULT 0,
                migrated_count bigint NOT NULL DEFAULT 0,
                rejected_count bigint NOT NULL DEFAULT 0,
                blocked_count bigint NOT NULL DEFAULT 0,
                failed_count bigint NOT NULL DEFAULT 0,
                warning_count bigint NOT NULL DEFAULT 0,
                error_summary jsonb,
                options jsonb,
                started_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at timestamptz,
                CONSTRAINT runs_status_check CHECK (
                    status IN (
                        'running',
                        'completed',
                        'completed_with_warnings',
                        'completed_with_errors',
                        'failed'
                    )
                )
            )
        `);

    await queryRunner.query(`
            CREATE TABLE migration.record_outcomes (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                migration_run_id uuid NOT NULL REFERENCES migration.runs(id) ON DELETE CASCADE,
                source_system text NOT NULL DEFAULT 'mongodb',
                source_collection text NOT NULL,
                source_id text NOT NULL,
                source_checksum text,
                outcome text NOT NULL CHECK (
                    outcome IN ('migrated', 'rejected', 'blocked', 'failed')
                ),
                primary_reason_code text,
                target_schema text,
                target_table text,
                target_id uuid,
                details jsonb NOT NULL DEFAULT '{}'::jsonb,
                created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (
                    migration_run_id,
                    source_system,
                    source_collection,
                    source_id
                )
            )
        `);

    await queryRunner.query(`
            CREATE INDEX idx_record_outcomes_run_outcome
            ON migration.record_outcomes (migration_run_id, outcome)
        `);

    await queryRunner.query(`
            CREATE INDEX idx_record_outcomes_source
            ON migration.record_outcomes (source_system, source_collection, source_id)
        `);

    await queryRunner.query(`
            CREATE TABLE migration.record_issues (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                record_outcome_id uuid NOT NULL
                    REFERENCES migration.record_outcomes(id) ON DELETE CASCADE,
                issue_type text NOT NULL CHECK (
                    issue_type IN ('validation', 'normalization', 'identity', 'technical')
                ),
                severity text NOT NULL CHECK (severity IN ('warning', 'error')),
                reason_code text NOT NULL,
                source_field text,
                details jsonb NOT NULL DEFAULT '{}'::jsonb,
                created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

    await queryRunner.query(`
            CREATE INDEX idx_record_issues_outcome
            ON migration.record_issues (record_outcome_id, severity, reason_code)
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
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS migration.reconciliation_results');
    await queryRunner.query('DROP TABLE IF EXISTS migration.entity_id_map');
    await queryRunner.query('DROP TABLE IF EXISTS migration.record_issues');
    await queryRunner.query('DROP TABLE IF EXISTS migration.record_outcomes');
    await queryRunner.query('DROP TABLE IF EXISTS migration.runs');
    await queryRunner.query('DROP SCHEMA IF EXISTS migration');
    await queryRunner.query('DROP SCHEMA IF EXISTS app');
  }
}

module.exports = { CreateMigrationInfrastructure1786579200001 };
