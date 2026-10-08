exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.sql(`
        CREATE TABLE app.comparison_product_mappings (
            source_ref text PRIMARY KEY,
            target_de_product_id uuid NOT NULL,
            mapping_method text NOT NULL CHECK (mapping_method IN ('gtin', 'exact_identity', 'de_product_id')),
            mapped_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE app.shopping_sessions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            comparison_run_id uuid NOT NULL REFERENCES app.comparison_runs(id) ON DELETE RESTRICT,
            comparison_plan_id uuid NOT NULL REFERENCES app.comparison_plans(id) ON DELETE RESTRICT,
            user_id uuid,
            legacy_user_ref text,
            status text NOT NULL CHECK (status IN ('active', 'completed')),
            snapshot_json jsonb NOT NULL,
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (user_id IS NOT NULL OR legacy_user_ref IS NOT NULL)
        );

        CREATE TABLE app.shopping_session_items (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id uuid NOT NULL REFERENCES app.shopping_sessions(id) ON DELETE CASCADE,
            line_item_id text NOT NULL,
            de_product_id uuid NOT NULL,
            product_name text NOT NULL,
            image_url text,
            quantity integer NOT NULL CHECK (quantity > 0),
            retailer_id uuid NOT NULL,
            retailer_name text NOT NULL,
            price_amount numeric(14,2) NOT NULL CHECK (price_amount > 0),
            currency char(3) NOT NULL CHECK (currency = 'AUD'),
            product_url text,
            checked boolean NOT NULL DEFAULT false,
            position integer NOT NULL CHECK (position >= 0),
            snapshot_json jsonb NOT NULL,
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (session_id, line_item_id)
        );

        CREATE INDEX shopping_sessions_user_updated_idx
            ON app.shopping_sessions (user_id, updated_at DESC);
        CREATE INDEX shopping_sessions_legacy_user_updated_idx
            ON app.shopping_sessions (legacy_user_ref, updated_at DESC);

        ALTER TABLE app.comparison_events
            DROP CONSTRAINT IF EXISTS comparison_events_event_name_check;
        ALTER TABLE app.comparison_events
            ADD CONSTRAINT comparison_events_event_name_check CHECK (event_name IN (
                'comparison_viewed', 'comparison_failed', 'product_selected',
                'retailer_filter_changed', 'similar_products_toggled',
                'comparison_run_completed', 'optimizer_changed',
                'substitution_applied', 'substitution_dismissed',
                'export_completed', 'offer_opened', 'shopping_started',
                'shopping_session_viewed', 'shopping_item_checked',
                'retailer_opened', 'mock_cart_created', 'shopping_completed'
            ));
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        ALTER TABLE app.comparison_events
            DROP CONSTRAINT IF EXISTS comparison_events_event_name_check;
        ALTER TABLE app.comparison_events
            ADD CONSTRAINT comparison_events_event_name_check CHECK (event_name IN (
                'comparison_viewed', 'comparison_failed', 'product_selected',
                'retailer_filter_changed', 'similar_products_toggled',
                'comparison_run_completed', 'optimizer_changed',
                'substitution_applied', 'substitution_dismissed',
                'export_completed', 'offer_opened', 'shopping_started'
            ));
        DROP TABLE IF EXISTS app.shopping_session_items;
        DROP TABLE IF EXISTS app.shopping_sessions;
        DROP TABLE IF EXISTS app.comparison_product_mappings;
    `);
};
