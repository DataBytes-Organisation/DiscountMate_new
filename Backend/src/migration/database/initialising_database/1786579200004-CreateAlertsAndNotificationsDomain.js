class CreateAlertsAndNotificationsDomain1786579200004 {
  name = 'CreateAlertsAndNotificationsDomain1786579200004';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE app.alert_segments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        category_id uuid,
        category_key text NOT NULL,
        category_label text NOT NULL,
        active boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_alert_segments_user_category UNIQUE (user_id, category_key)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_alert_segments_user_active
      ON app.alert_segments (user_id, active, category_key)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_alert_segments_category
      ON app.alert_segments (category_id)
      WHERE category_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE app.notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        type text NOT NULL DEFAULT 'general',
        title text NOT NULL,
        message text NOT NULL DEFAULT '',
        is_read boolean NOT NULL DEFAULT false,
        category_id uuid,
        category_key text,
        category_label text,
        cta_route text,
        deal_key text,
        source_types text[] NOT NULL DEFAULT ARRAY[]::text[],
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_notifications_user_created
      ON app.notifications (user_id, created_at DESC, id DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_notifications_user_unread
      ON app.notifications (user_id, created_at DESC)
      WHERE is_read = false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_notifications_deal
      ON app.notifications (user_id, type, category_key, deal_key)
      WHERE deal_key IS NOT NULL AND category_key IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE app.notification_product_references (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        notification_id uuid NOT NULL REFERENCES app.notifications(id) ON DELETE CASCADE,
        line_number integer NOT NULL CHECK (line_number >= 1),
        product_id uuid,
        legacy_product_identifier text NOT NULL,
        CONSTRAINT uq_notification_product_line UNIQUE (notification_id, line_number)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_notification_product_references_product
      ON app.notification_product_references (product_id)
      WHERE product_id IS NOT NULL
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS app.notification_product_references');
    await queryRunner.query('DROP TABLE IF EXISTS app.notifications');
    await queryRunner.query('DROP TABLE IF EXISTS app.alert_segments');
  }
}

module.exports = { CreateAlertsAndNotificationsDomain1786579200004 };
