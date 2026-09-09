exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.sql(`
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
        CREATE SCHEMA IF NOT EXISTS app;

        CREATE TABLE app.comparison_runs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            parent_run_id uuid REFERENCES app.comparison_runs(id) ON DELETE RESTRICT,
            user_id uuid,
            legacy_user_ref text,
            list_id uuid,
            legacy_list_ref text,
            list_name text NOT NULL,
            status text NOT NULL CHECK (status IN ('completed', 'failed')),
            objective text NOT NULL CHECK (objective IN ('lowest_total', 'one_retailer', 'fewest_substitutions')),
            max_retailers smallint NOT NULL CHECK (max_retailers BETWEEN 1 AND 3),
            allow_store_brand_substitutions boolean NOT NULL DEFAULT false,
            calculation_policy_version text NOT NULL,
            de_data_watermark timestamptz,
            warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
            snapshot_json jsonb NOT NULL,
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (user_id IS NOT NULL OR legacy_user_ref IS NOT NULL),
            CHECK (list_id IS NOT NULL OR legacy_list_ref IS NOT NULL)
        );

        CREATE TABLE app.comparison_retailer_results (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            run_id uuid NOT NULL REFERENCES app.comparison_runs(id) ON DELETE RESTRICT,
            retailer_id uuid NOT NULL,
            retailer_name text NOT NULL,
            total_amount numeric(14,2) NOT NULL CHECK (total_amount >= 0),
            currency char(3) NOT NULL CHECK (currency = 'AUD'),
            savings_amount numeric(14,2) NOT NULL CHECK (savings_amount >= 0),
            coverage_found integer NOT NULL CHECK (coverage_found >= 0),
            coverage_total integer NOT NULL CHECK (coverage_total >= coverage_found),
            substitution_count integer NOT NULL DEFAULT 0 CHECK (substitution_count >= 0),
            rank_eligible boolean NOT NULL,
            snapshot_json jsonb NOT NULL,
            UNIQUE (run_id, retailer_id)
        );

        CREATE TABLE app.comparison_item_results (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            run_id uuid NOT NULL REFERENCES app.comparison_runs(id) ON DELETE RESTRICT,
            retailer_result_id uuid NOT NULL REFERENCES app.comparison_retailer_results(id) ON DELETE RESTRICT,
            line_item_id text NOT NULL,
            de_product_id uuid NOT NULL,
            product_name text NOT NULL,
            quantity integer NOT NULL CHECK (quantity > 0),
            retailer_id uuid NOT NULL,
            retailer_name text NOT NULL,
            price_amount numeric(14,2) NOT NULL CHECK (price_amount > 0),
            currency char(3) NOT NULL CHECK (currency = 'AUD'),
            product_url text,
            observed_at timestamptz NOT NULL,
            availability_source text NOT NULL CHECK (availability_source = 'latest_price_inference'),
            snapshot_json jsonb NOT NULL,
            UNIQUE (retailer_result_id, line_item_id)
        );

        CREATE TABLE app.comparison_plans (
            id uuid PRIMARY KEY,
            run_id uuid NOT NULL REFERENCES app.comparison_runs(id) ON DELETE RESTRICT,
            rank integer NOT NULL CHECK (rank > 0),
            total_amount numeric(14,2) NOT NULL CHECK (total_amount >= 0),
            currency char(3) NOT NULL CHECK (currency = 'AUD'),
            savings_amount numeric(14,2) NOT NULL CHECK (savings_amount >= 0),
            coverage_found integer NOT NULL CHECK (coverage_found >= 0),
            coverage_total integer NOT NULL CHECK (coverage_total >= coverage_found),
            retailer_count integer NOT NULL CHECK (retailer_count BETWEEN 1 AND 3),
            substitution_count integer NOT NULL CHECK (substitution_count >= 0),
            snapshot_json jsonb NOT NULL,
            UNIQUE (run_id, rank)
        );

        CREATE TABLE app.comparison_plan_items (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            plan_id uuid NOT NULL REFERENCES app.comparison_plans(id) ON DELETE RESTRICT,
            line_item_id text NOT NULL,
            de_product_id uuid NOT NULL,
            product_name text NOT NULL,
            quantity integer NOT NULL CHECK (quantity > 0),
            retailer_id uuid NOT NULL,
            retailer_name text NOT NULL,
            price_amount numeric(14,2) NOT NULL CHECK (price_amount > 0),
            currency char(3) NOT NULL CHECK (currency = 'AUD'),
            product_url text,
            observed_at timestamptz NOT NULL,
            substitution_json jsonb,
            snapshot_json jsonb NOT NULL,
            UNIQUE (plan_id, line_item_id)
        );

        CREATE TABLE app.comparison_substitution_decisions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            run_id uuid NOT NULL REFERENCES app.comparison_runs(id) ON DELETE RESTRICT,
            replacement_run_id uuid REFERENCES app.comparison_runs(id) ON DELETE RESTRICT,
            user_id uuid,
            legacy_user_ref text,
            original_de_product_id uuid NOT NULL,
            replacement_de_product_id uuid NOT NULL,
            action text NOT NULL CHECK (action IN ('applied', 'dismissed')),
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (user_id IS NOT NULL OR legacy_user_ref IS NOT NULL),
            CHECK ((action = 'applied' AND replacement_run_id IS NOT NULL) OR action = 'dismissed')
        );

        CREATE TABLE app.comparison_events (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            event_name text NOT NULL CHECK (event_name IN (
                'comparison_viewed', 'comparison_failed', 'product_selected',
                'retailer_filter_changed', 'similar_products_toggled',
                'comparison_run_completed', 'optimizer_changed',
                'substitution_applied', 'substitution_dismissed',
                'export_completed', 'offer_opened', 'shopping_started'
            )),
            user_id uuid,
            legacy_user_ref text,
            anonymous_session_id uuid,
            occurred_at timestamptz NOT NULL,
            properties jsonb NOT NULL DEFAULT '{}'::jsonb,
            received_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (octet_length(properties::text) <= 8192)
        );

        CREATE INDEX comparison_runs_user_created_idx
            ON app.comparison_runs (user_id, created_at DESC);
        CREATE INDEX comparison_runs_legacy_user_created_idx
            ON app.comparison_runs (legacy_user_ref, created_at DESC);
        CREATE INDEX comparison_events_name_occurred_idx
            ON app.comparison_events (event_name, occurred_at DESC);

        CREATE OR REPLACE FUNCTION app.reject_comparison_snapshot_mutation()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'Comparison snapshots are immutable';
        END
        $$;

        CREATE TRIGGER comparison_runs_immutable
            BEFORE UPDATE OR DELETE ON app.comparison_runs
            FOR EACH ROW EXECUTE FUNCTION app.reject_comparison_snapshot_mutation();
        CREATE TRIGGER comparison_retailer_results_immutable
            BEFORE UPDATE OR DELETE ON app.comparison_retailer_results
            FOR EACH ROW EXECUTE FUNCTION app.reject_comparison_snapshot_mutation();
        CREATE TRIGGER comparison_item_results_immutable
            BEFORE UPDATE OR DELETE ON app.comparison_item_results
            FOR EACH ROW EXECUTE FUNCTION app.reject_comparison_snapshot_mutation();
        CREATE TRIGGER comparison_plans_immutable
            BEFORE UPDATE OR DELETE ON app.comparison_plans
            FOR EACH ROW EXECUTE FUNCTION app.reject_comparison_snapshot_mutation();
        CREATE TRIGGER comparison_plan_items_immutable
            BEFORE UPDATE OR DELETE ON app.comparison_plan_items
            FOR EACH ROW EXECUTE FUNCTION app.reject_comparison_snapshot_mutation();
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        DROP TABLE IF EXISTS app.comparison_events;
        DROP TABLE IF EXISTS app.comparison_substitution_decisions;
        DROP TABLE IF EXISTS app.comparison_plan_items;
        DROP TABLE IF EXISTS app.comparison_plans;
        DROP TABLE IF EXISTS app.comparison_item_results;
        DROP TABLE IF EXISTS app.comparison_retailer_results;
        DROP TABLE IF EXISTS app.comparison_runs;
        DROP FUNCTION IF EXISTS app.reject_comparison_snapshot_mutation();
    `);
};
