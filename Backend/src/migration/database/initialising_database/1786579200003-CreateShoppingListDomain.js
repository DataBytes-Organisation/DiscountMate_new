class CreateShoppingListDomain1786579200003 {
  name = 'CreateShoppingListDomain1786579200003';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE app.shopping_lists (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        name text NOT NULL,
        description text NOT NULL DEFAULT '',
        accent text NOT NULL DEFAULT 'emerald'
          CHECK (accent IN ('emerald', 'amber', 'sky', 'violet', 'rose')),
        is_active boolean NOT NULL DEFAULT false,
        total numeric(12, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
        savings numeric(12, 2) NOT NULL DEFAULT 0 CHECK (savings >= 0),
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_shopping_lists_one_active
      ON app.shopping_lists (user_id)
      WHERE is_active = true
    `);

    await queryRunner.query(`
      CREATE INDEX idx_shopping_lists_user_updated
      ON app.shopping_lists (user_id, updated_at DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE app.shopping_list_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shopping_list_id uuid NOT NULL REFERENCES app.shopping_lists(id) ON DELETE CASCADE,
        line_number integer NOT NULL CHECK (line_number >= 1),
        product_id uuid,
        legacy_product_identifier text NOT NULL,
        product_name text NOT NULL,
        quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
        unit_price numeric(12, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
        retailer_id uuid,
        selected_retailer_key text
          CHECK (selected_retailer_key IS NULL OR selected_retailer_key IN ('aldi', 'coles', 'woolworths', 'iga')),
        image_url text,
        category_id uuid,
        legacy_category_identifier text,
        category_name text,
        retailer_prices jsonb NOT NULL DEFAULT '{}'::jsonb,
        raw_payload jsonb,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_shopping_list_item_line UNIQUE (shopping_list_id, line_number)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_shopping_list_items_product
      ON app.shopping_list_items (product_id)
      WHERE product_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE app.list_pricing_snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        shopping_list_id uuid REFERENCES app.shopping_lists(id) ON DELETE SET NULL,
        legacy_shopping_list_id text NOT NULL,
        list_name text NOT NULL,
        selected_retailer_id uuid,
        selected_retailer_key text
          CHECK (selected_retailer_key IS NULL OR selected_retailer_key IN ('aldi', 'coles', 'woolworths', 'iga')),
        retailer_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
        comparison_status text NOT NULL
          CHECK (comparison_status IN ('comparable', 'single_retailer', 'no_pricing', 'unpriceable')),
        comparable_retailer_count integer NOT NULL DEFAULT 0 CHECK (comparable_retailer_count >= 0),
        available_retailers text[] NOT NULL DEFAULT ARRAY[]::text[],
        cheapest_retailer_id uuid,
        cheapest_retailer_key text,
        cheapest_total numeric(12, 2) NOT NULL DEFAULT 0 CHECK (cheapest_total >= 0),
        highest_retailer_id uuid,
        highest_retailer_key text,
        highest_total numeric(12, 2) NOT NULL DEFAULT 0 CHECK (highest_total >= 0),
        selected_total numeric(12, 2) NOT NULL DEFAULT 0 CHECK (selected_total >= 0),
        total_saved numeric(12, 2) NOT NULL DEFAULT 0 CHECK (total_saved >= 0),
        savings_rate numeric(7, 2) NOT NULL DEFAULT 0 CHECK (savings_rate >= 0),
        comparison_label text NOT NULL,
        item_count integer NOT NULL DEFAULT 0 CHECK (item_count >= 0),
        source text NOT NULL,
        raw_payload jsonb,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_list_pricing_snapshots_user_created
      ON app.list_pricing_snapshots (user_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_list_pricing_snapshots_list_created
      ON app.list_pricing_snapshots (shopping_list_id, created_at DESC)
    `);

    await queryRunner.query(`
      ALTER TABLE app.user_dashboard_preferences
      ADD CONSTRAINT fk_user_dashboard_selected_list
      FOREIGN KEY (selected_list_id)
      REFERENCES app.shopping_lists(id)
      ON DELETE SET NULL
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE app.user_dashboard_preferences
      DROP CONSTRAINT IF EXISTS fk_user_dashboard_selected_list
    `);
    await queryRunner.query('DROP TABLE IF EXISTS app.list_pricing_snapshots');
    await queryRunner.query('DROP TABLE IF EXISTS app.shopping_list_items');
    await queryRunner.query('DROP TABLE IF EXISTS app.shopping_lists');
  }
}

module.exports = { CreateShoppingListDomain1786579200003 };
