class CreateUserDomain1786579200002 {
  name = 'CreateUserDomain1786579200002';

  async up(queryRunner) {
    await queryRunner.query(`
            CREATE TABLE app.users (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                email citext NOT NULL,
                password_hash text NOT NULL,
                role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
                status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'pending_deletion')),
                email_verified_at timestamptz,
                phone_verified_at timestamptz,
                password_changed_at timestamptz,
                created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_users_email UNIQUE (email)
            )
        `);

    await queryRunner.query(`
            CREATE TABLE app.user_profiles (
                user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
                first_name varchar(100),
                last_name varchar(100),
                phone_number varchar(32),
                address text,
                postcode char(4),
                date_of_birth date,
                bio text,
                legacy_profile_id text,
                created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT ck_user_profiles_postcode
                    CHECK (postcode IS NULL OR postcode ~ '^[0-9]{4}$')
            )
        `);

    await queryRunner.query(`
            CREATE TABLE app.user_profile_images (
                user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
                mime_type varchar(100) NOT NULL,
                image_data bytea NOT NULL,
                created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

    await queryRunner.query(`
            CREATE TABLE app.user_notification_preferences (
                user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
                price_alerts_enabled boolean NOT NULL DEFAULT true,
                weekly_summary_enabled boolean NOT NULL DEFAULT true,
                browser_notifications_enabled boolean NOT NULL DEFAULT true,
                updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

    await queryRunner.query(`
            CREATE TABLE app.user_dashboard_preferences (
                user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
                selected_list_id uuid,
                selected_retailer_id uuid,
                selected_retailer_key text NOT NULL DEFAULT 'coles'
                    CHECK (selected_retailer_key IN ('aldi', 'coles', 'woolworths', 'iga')),
                legacy_selected_list_id text,
                created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

    await queryRunner.query(`
            CREATE TABLE app.user_legacy_metrics (
                user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
                total_saved numeric(12, 2) NOT NULL DEFAULT 0,
                shopping_trips integer NOT NULL DEFAULT 0,
                shopping_lists_count integer NOT NULL DEFAULT 0,
                updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT ck_user_legacy_metrics_nonnegative
                    CHECK (total_saved >= 0 AND shopping_trips >= 0 AND shopping_lists_count >= 0)
            )
        `);

    await queryRunner.query(`
            CREATE TABLE app.subscription_plans (
                code text PRIMARY KEY,
                display_name text NOT NULL,
                price_cents integer NOT NULL CHECK (price_cents >= 0),
                currency char(3) NOT NULL DEFAULT 'AUD',
                billing_interval text NOT NULL,
                price_suffix text NOT NULL,
                badge text,
                max_active_alerts integer CHECK (max_active_alerts IS NULL OR max_active_alerts >= 0),
                max_saved_lists integer CHECK (max_saved_lists IS NULL OR max_saved_lists >= 0),
                is_active boolean NOT NULL DEFAULT true,
                display_order integer NOT NULL,
                created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

    await queryRunner.query(`
            CREATE TABLE app.subscription_plan_features (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                plan_code text NOT NULL REFERENCES app.subscription_plans(code) ON DELETE CASCADE,
                display_text text NOT NULL,
                display_order integer NOT NULL,
                CONSTRAINT uq_subscription_plan_feature UNIQUE (plan_code, display_order)
            )
        `);

    await queryRunner.query(`
            CREATE TABLE app.user_subscriptions (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
                plan_code text NOT NULL REFERENCES app.subscription_plans(code),
                status text NOT NULL CHECK (status IN ('active', 'cancelled', 'ended')),
                source text NOT NULL,
                provider_customer_id text,
                provider_subscription_id text,
                started_at timestamptz NOT NULL,
                current_period_start timestamptz,
                current_period_end timestamptz,
                cancelled_at timestamptz,
                ended_at timestamptz,
                created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

    await queryRunner.query(`
            CREATE UNIQUE INDEX uq_user_subscriptions_one_active
            ON app.user_subscriptions (user_id)
            WHERE status = 'active'
        `);

    await queryRunner.query(`
            CREATE INDEX idx_user_subscriptions_history
            ON app.user_subscriptions (user_id, started_at DESC)
        `);

    await queryRunner.query(`
            CREATE TABLE app.receipts (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
                source_receipt_key text UNIQUE,
                retailer_id uuid,
                store_name text NOT NULL,
                receipt_number text,
                purchased_at timestamptz,
                uploaded_at timestamptz NOT NULL,
                subtotal numeric(12, 2),
                total numeric(12, 2),
                savings numeric(12, 2),
                source text NOT NULL DEFAULT 'ocr',
                raw_payload jsonb,
                created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT ck_receipts_amounts_nonnegative CHECK (
                    (subtotal IS NULL OR subtotal >= 0)
                    AND (total IS NULL OR total >= 0)
                    AND (savings IS NULL OR savings >= 0)
                )
            )
        `);

    await queryRunner.query(`
            CREATE INDEX idx_receipts_user_uploaded
            ON app.receipts (user_id, uploaded_at DESC)
        `);

    await queryRunner.query(`
            CREATE TABLE app.receipt_items (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                receipt_id uuid NOT NULL REFERENCES app.receipts(id) ON DELETE CASCADE,
                line_number integer NOT NULL CHECK (line_number >= 1),
                item_name text,
                quantity numeric(12, 3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
                unit_price numeric(12, 2),
                line_total numeric(12, 2),
                matched_product_id uuid,
                raw_payload jsonb,
                created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_receipt_item_line UNIQUE (receipt_id, line_number),
                CONSTRAINT ck_receipt_item_amounts_nonnegative CHECK (
                    (unit_price IS NULL OR unit_price >= 0)
                    AND (line_total IS NULL OR line_total >= 0)
                )
            )
        `);

    await queryRunner.query(`
            INSERT INTO app.subscription_plans (
                code,
                display_name,
                price_cents,
                currency,
                billing_interval,
                price_suffix,
                badge,
                max_active_alerts,
                max_saved_lists,
                display_order
            ) VALUES
                ('free', 'Free', 0, 'AUD', 'none', 'forever', NULL, 5, 3, 1),
                ('premium', 'Premium', 499, 'AUD', 'month', '/ month', 'Most Popular', NULL, NULL, 2),
                ('family', 'Family', 999, 'AUD', 'month', '/ month', NULL, NULL, NULL, 3)
            ON CONFLICT (code) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                price_cents = EXCLUDED.price_cents,
                currency = EXCLUDED.currency,
                billing_interval = EXCLUDED.billing_interval,
                price_suffix = EXCLUDED.price_suffix,
                badge = EXCLUDED.badge,
                max_active_alerts = EXCLUDED.max_active_alerts,
                max_saved_lists = EXCLUDED.max_saved_lists,
                display_order = EXCLUDED.display_order,
                updated_at = CURRENT_TIMESTAMP
        `);

    await queryRunner.query(`
            INSERT INTO app.subscription_plan_features (plan_code, display_text, display_order)
            VALUES
                ('free', 'Up to 5 active price and category alerts', 1),
                ('free', 'Basic savings summary', 2),
                ('free', 'Up to 3 saved lists', 3),
                ('premium', 'Unlimited price and category alerts', 1),
                ('premium', 'Expanded dashboard insights and history', 2),
                ('premium', 'Priority deal notifications', 3),
                ('premium', 'Early access to new features', 4),
                ('family', 'Everything in Premium', 1),
                ('family', 'Household-friendly plan management', 2),
                ('family', 'Shared planning tools as they roll out', 3),
                ('family', 'Family-focused savings visibility', 4),
                ('family', 'Priority support access', 5)
            ON CONFLICT (plan_code, display_order) DO UPDATE SET
                display_text = EXCLUDED.display_text
        `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS app.receipt_items');
    await queryRunner.query('DROP TABLE IF EXISTS app.receipts');
    await queryRunner.query('DROP TABLE IF EXISTS app.user_subscriptions');
    await queryRunner.query('DROP TABLE IF EXISTS app.subscription_plan_features');
    await queryRunner.query('DROP TABLE IF EXISTS app.subscription_plans');
    await queryRunner.query('DROP TABLE IF EXISTS app.user_legacy_metrics');
    await queryRunner.query('DROP TABLE IF EXISTS app.user_dashboard_preferences');
    await queryRunner.query('DROP TABLE IF EXISTS app.user_notification_preferences');
    await queryRunner.query('DROP TABLE IF EXISTS app.user_profile_images');
    await queryRunner.query('DROP TABLE IF EXISTS app.user_profiles');
    await queryRunner.query('DROP TABLE IF EXISTS app.users');
  }
}

module.exports = { CreateUserDomain1786579200002 };
