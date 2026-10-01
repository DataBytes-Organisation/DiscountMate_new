class AddReferenceResolutionAudit1786579200006 {
  name = 'AddReferenceResolutionAudit1786579200006';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE migration.reference_resolution_issues (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        record_outcome_id uuid
          REFERENCES migration.record_outcomes(id) ON DELETE SET NULL,
        migration_run_id uuid REFERENCES migration.runs(id) ON DELETE SET NULL,
        source_system text NOT NULL DEFAULT 'mongodb',
        source_collection text NOT NULL,
        source_id text NOT NULL,
        source_field text NOT NULL,
        source_value text,
        target_schema text NOT NULL,
        target_table text NOT NULL,
        target_field text NOT NULL DEFAULT 'id',
        reason_code text NOT NULL,
        required boolean NOT NULL DEFAULT false,
        details jsonb NOT NULL DEFAULT '{}'::jsonb,
        resolved_target_id uuid,
        resolved_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_reference_resolution_issues_open
      ON migration.reference_resolution_issues (
        target_schema,
        target_table,
        source_collection,
        source_id
      )
      WHERE resolved_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX idx_reference_resolution_issues_run
      ON migration.reference_resolution_issues (migration_run_id, required, reason_code)
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS migration.reference_resolution_issues');
  }
}

module.exports = { AddReferenceResolutionAudit1786579200006 };
