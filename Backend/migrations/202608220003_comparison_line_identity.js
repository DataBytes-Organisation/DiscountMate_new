exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.sql(`
        ALTER TABLE app.comparison_item_results
            ADD COLUMN IF NOT EXISTS line_item_id text;
        ALTER TABLE app.comparison_item_results
            DISABLE TRIGGER comparison_item_results_immutable;
        UPDATE app.comparison_item_results
            SET line_item_id = de_product_id::text
            WHERE line_item_id IS NULL;
        ALTER TABLE app.comparison_item_results
            ENABLE TRIGGER comparison_item_results_immutable;
        ALTER TABLE app.comparison_item_results
            ALTER COLUMN line_item_id SET NOT NULL;
        ALTER TABLE app.comparison_item_results
            DROP CONSTRAINT IF EXISTS comparison_item_results_retailer_result_id_de_product_id_key;
        ALTER TABLE app.comparison_item_results
            ADD CONSTRAINT comparison_item_results_retailer_line_key
            UNIQUE (retailer_result_id, line_item_id);

        ALTER TABLE app.comparison_plan_items
            ADD COLUMN IF NOT EXISTS line_item_id text;
        ALTER TABLE app.comparison_plan_items
            DISABLE TRIGGER comparison_plan_items_immutable;
        UPDATE app.comparison_plan_items
            SET line_item_id = de_product_id::text
            WHERE line_item_id IS NULL;
        ALTER TABLE app.comparison_plan_items
            ENABLE TRIGGER comparison_plan_items_immutable;
        ALTER TABLE app.comparison_plan_items
            ALTER COLUMN line_item_id SET NOT NULL;
        ALTER TABLE app.comparison_plan_items
            DROP CONSTRAINT IF EXISTS comparison_plan_items_plan_id_de_product_id_key;
        ALTER TABLE app.comparison_plan_items
            ADD CONSTRAINT comparison_plan_items_plan_line_key
            UNIQUE (plan_id, line_item_id);
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        ALTER TABLE app.comparison_plan_items
            DROP CONSTRAINT IF EXISTS comparison_plan_items_plan_line_key;
        ALTER TABLE app.comparison_plan_items
            ADD CONSTRAINT comparison_plan_items_plan_id_de_product_id_key
            UNIQUE (plan_id, de_product_id);
        ALTER TABLE app.comparison_plan_items DROP COLUMN IF EXISTS line_item_id;

        ALTER TABLE app.comparison_item_results
            DROP CONSTRAINT IF EXISTS comparison_item_results_retailer_line_key;
        ALTER TABLE app.comparison_item_results
            ADD CONSTRAINT comparison_item_results_retailer_result_id_de_product_id_key
            UNIQUE (retailer_result_id, de_product_id);
        ALTER TABLE app.comparison_item_results DROP COLUMN IF EXISTS line_item_id;
    `);
};
