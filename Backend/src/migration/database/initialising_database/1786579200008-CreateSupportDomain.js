class CreateSupportDomain1786579200008 {
  name = 'CreateSupportDomain1786579200008';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE app.support_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        reference_number text NOT NULL,
        user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
        name text NOT NULL,
        email citext NOT NULL,
        topic text NOT NULL,
        subject text,
        message text NOT NULL,
        support_email citext NOT NULL,
        email_status text NOT NULL
          CHECK (email_status IN ('sent', 'failed', 'not_configured')),
        status text NOT NULL DEFAULT 'received'
          CHECK (status IN ('received', 'in_progress', 'resolved', 'closed')),
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_support_requests_reference_number UNIQUE (reference_number)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_support_requests_status_created
      ON app.support_requests (status, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_support_requests_email_created
      ON app.support_requests (email, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE app.support_request_attachments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        support_request_id uuid NOT NULL
          REFERENCES app.support_requests(id) ON DELETE CASCADE,
        original_name text NOT NULL,
        mime_type text NOT NULL
          CHECK (mime_type IN ('image/png', 'image/jpeg', 'application/pdf')),
        size_bytes integer NOT NULL
          CHECK (size_bytes >= 0 AND size_bytes <= 10485760),
        data bytea NOT NULL,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_support_request_attachments_request UNIQUE (support_request_id),
        CONSTRAINT ck_support_request_attachment_size_matches
          CHECK (octet_length(data) = size_bytes)
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS app.support_request_attachments');
    await queryRunner.query('DROP TABLE IF EXISTS app.support_requests');
  }
}

module.exports = { CreateSupportDomain1786579200008 };
