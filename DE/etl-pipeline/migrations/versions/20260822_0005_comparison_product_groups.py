"""add stable cross-retailer comparison product groups and ETL audit"""

from __future__ import annotations

from alembic import op

revision = "20260822_0005"
down_revision = "20260821_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        """
        CREATE TABLE silver.comparison_store_brands (
            normalized_brand text PRIMARY KEY,
            display_brand text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    op.execute(
        """
        INSERT INTO silver.comparison_store_brands (normalized_brand, display_brand)
        VALUES ('aldi', 'ALDI'), ('coles', 'Coles'), ('woolworths', 'Woolworths'),
               ('iga', 'IGA'), ('farmdale', 'Farmdale'), ('homebrand', 'Homebrand'),
               ('black & gold', 'Black & Gold'), ('community co', 'Community Co'),
               ('essentials', 'Essentials'), ('dairy fine', 'Dairy Fine'),
               ('belmont', 'Belmont'), ('choceur', 'Choceur')
        ON CONFLICT DO NOTHING
        """
    )
    op.execute(
        """
        CREATE TABLE silver.comparison_product_groups (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            canonical_product_id uuid NOT NULL UNIQUE
                REFERENCES silver.dim_products(id),
            canonical_product_name text NOT NULL,
            canonical_brand_name text,
            category_id uuid NOT NULL REFERENCES silver.dim_categories(id),
            pack_quantity numeric(10, 3),
            pack_uom text,
            match_version text NOT NULL DEFAULT 'comparison-group-v1',
            status text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'merged')),
            merged_into_group_id uuid REFERENCES silver.comparison_product_groups(id),
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    op.execute(
        """
        CREATE TABLE silver.comparison_product_members (
            group_id uuid NOT NULL REFERENCES silver.comparison_product_groups(id),
            dim_product_id uuid NOT NULL REFERENCES silver.dim_products(id),
            retailer_id uuid NOT NULL REFERENCES silver.dim_retailers(id),
            match_method text NOT NULL
                CHECK (match_method IN ('singleton', 'gtin', 'normalized_identity', 'reviewed')),
            match_score numeric(5, 4) NOT NULL CHECK (match_score BETWEEN 0 AND 1),
            is_primary boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (dim_product_id, retailer_id)
        )
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_comparison_group_primary_retailer
        ON silver.comparison_product_members(group_id, retailer_id)
        WHERE is_primary
        """
    )
    op.execute(
        """
        CREATE TABLE silver.comparison_match_review_queue (
            id bigserial PRIMARY KEY,
            left_dim_product_id uuid NOT NULL REFERENCES silver.dim_products(id),
            right_dim_product_id uuid NOT NULL REFERENCES silver.dim_products(id),
            match_score numeric(5, 4) NOT NULL CHECK (match_score BETWEEN 0 AND 1),
            reason text NOT NULL,
            status text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
            match_version text NOT NULL DEFAULT 'comparison-group-v1',
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            reviewed_at timestamptz
        )
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_comparison_match_review_pair_version
        ON silver.comparison_match_review_queue(
            LEAST(left_dim_product_id, right_dim_product_id),
            GREATEST(left_dim_product_id, right_dim_product_id),
            match_version
        )
        """
    )
    op.execute(
        """
        CREATE TABLE silver.etl_run_audit (
            id bigserial PRIMARY KEY,
            model_name text NOT NULL,
            retailer_name text,
            source_files jsonb NOT NULL DEFAULT '[]'::jsonb,
            requested_start_date date NOT NULL,
            requested_end_date date,
            observation_date date,
            input_row_count bigint NOT NULL DEFAULT 0,
            output_row_count bigint NOT NULL DEFAULT 0,
            silver_watermark timestamptz,
            status text NOT NULL CHECK (status IN ('succeeded', 'failed')),
            error_message text,
            started_at timestamptz NOT NULL,
            completed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    op.execute(_refresh_function_sql())
    op.execute("SELECT silver.refresh_comparison_product_groups()")
    _replace_comparison_views()
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'comparison_reader') THEN
                GRANT SELECT ON silver.comparison_product_groups,
                                silver.comparison_product_members,
                                silver.comparison_store_brands,
                                silver.comparison_products,
                                silver.comparison_latest_offers,
                                silver.comparison_price_history
                TO comparison_reader;
            END IF;
        END
        $$
        """
    )


def _refresh_function_sql() -> str:
    return r"""
    CREATE OR REPLACE FUNCTION silver.refresh_comparison_product_groups()
    RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE candidate record;
    DECLARE target_group uuid;
    DECLARE losing_group uuid;
    BEGIN
        INSERT INTO silver.comparison_product_groups (
            canonical_product_id, canonical_product_name, canonical_brand_name,
            category_id, pack_quantity, pack_uom
        )
        SELECT DISTINCT p.id, p.product_name, p.brand_name, p.category_id,
               p.pack_quantity, p.pack_uom
        FROM silver.dim_products p
        JOIN silver.fct_product_prices price ON price.product_id = p.id
        ON CONFLICT (canonical_product_id) DO UPDATE
        SET canonical_product_name = EXCLUDED.canonical_product_name,
            canonical_brand_name = EXCLUDED.canonical_brand_name,
            category_id = EXCLUDED.category_id,
            pack_quantity = EXCLUDED.pack_quantity,
            pack_uom = EXCLUDED.pack_uom,
            updated_at = CURRENT_TIMESTAMP;

        INSERT INTO silver.comparison_product_members (
            group_id, dim_product_id, retailer_id, match_method, match_score
        )
        SELECT COALESCE(existing.group_id, canonical.id), facts.product_id,
               facts.retailer_id, 'singleton', 1
        FROM (SELECT DISTINCT product_id, retailer_id FROM silver.fct_product_prices) facts
        JOIN silver.comparison_product_groups canonical
          ON canonical.canonical_product_id = facts.product_id
        LEFT JOIN LATERAL (
            SELECT member.group_id
            FROM silver.comparison_product_members member
            JOIN silver.comparison_product_groups active_group ON active_group.id = member.group_id
            WHERE member.dim_product_id = facts.product_id
              AND active_group.status = 'active'
            ORDER BY member.group_id
            LIMIT 1
        ) existing ON TRUE
        WHERE NOT EXISTS (
            SELECT 1 FROM silver.comparison_product_members occupied
            WHERE occupied.group_id = COALESCE(existing.group_id, canonical.id)
              AND occupied.retailer_id = facts.retailer_id
              AND occupied.is_primary
        )
        ON CONFLICT (dim_product_id, retailer_id) DO NOTHING;

        -- GTIN is the strongest automatic identity signal, but only when the
        -- code is valid and does not identify multiple products at one retailer.
        FOR candidate IN
            WITH product_groups AS (
                SELECT member.dim_product_id, member.group_id,
                       array_agg(DISTINCT member.retailer_id) AS retailer_ids
                FROM silver.comparison_product_members member
                JOIN silver.comparison_product_groups active_group
                  ON active_group.id = member.group_id AND active_group.status = 'active'
                GROUP BY member.dim_product_id, member.group_id
            )
            SELECT left_group.group_id AS left_group_id,
                   right_group.group_id AS right_group_id,
                   1.0::numeric AS score
            FROM silver.dim_products left_product
            JOIN product_groups left_group ON left_group.dim_product_id = left_product.id
            JOIN silver.dim_products right_product ON left_product.id < right_product.id
            JOIN product_groups right_group ON right_group.dim_product_id = right_product.id
            WHERE left_group.group_id <> right_group.group_id
              AND left_product.gtin ~ '^[0-9]{8,14}$'
              AND left_product.gtin = right_product.gtin
              AND NOT (left_group.retailer_ids && right_group.retailer_ids)
              AND NOT EXISTS (
                  SELECT 1
                  FROM silver.fct_product_prices conflict_price
                  JOIN silver.dim_products conflict_product
                    ON conflict_product.id = conflict_price.product_id
                  WHERE conflict_product.gtin = left_product.gtin
                  GROUP BY conflict_price.retailer_id
                  HAVING count(DISTINCT conflict_price.product_id) > 1
              )
            ORDER BY left_group.group_id, right_group.group_id
        LOOP
            target_group := LEAST(candidate.left_group_id, candidate.right_group_id);
            losing_group := GREATEST(candidate.left_group_id, candidate.right_group_id);
            IF EXISTS (
                SELECT 1 FROM silver.comparison_product_groups
                WHERE id = target_group AND status = 'active'
            ) AND EXISTS (
                SELECT 1 FROM silver.comparison_product_groups
                WHERE id = losing_group AND status = 'active'
            ) AND NOT EXISTS (
                SELECT 1
                FROM silver.comparison_product_members target_member
                JOIN silver.comparison_product_members losing_member
                  ON losing_member.retailer_id = target_member.retailer_id
                WHERE target_member.group_id = target_group
                  AND losing_member.group_id = losing_group
                  AND target_member.is_primary AND losing_member.is_primary
            ) THEN
                UPDATE silver.comparison_product_members
                SET group_id = target_group,
                    match_method = 'gtin',
                    match_score = 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE group_id = losing_group;
                UPDATE silver.comparison_product_groups
                SET status = 'merged', merged_into_group_id = target_group,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = losing_group;
            END IF;
        END LOOP;

        FOR candidate IN
            WITH product_groups AS (
                SELECT member.dim_product_id, member.group_id,
                       array_agg(DISTINCT member.retailer_id) AS retailer_ids
                FROM silver.comparison_product_members member
                JOIN silver.comparison_product_groups active_group
                  ON active_group.id = member.group_id AND active_group.status = 'active'
                GROUP BY member.dim_product_id, member.group_id
            )
            SELECT left_group.group_id AS left_group_id,
                   right_group.group_id AS right_group_id,
                   similarity(
                       lower(regexp_replace(left_product.product_name, '[^a-z0-9]+', ' ', 'g')),
                       lower(regexp_replace(right_product.product_name, '[^a-z0-9]+', ' ', 'g'))
                   ) AS score
            FROM silver.dim_products left_product
            JOIN product_groups left_group ON left_group.dim_product_id = left_product.id
            JOIN silver.dim_products right_product ON left_product.id < right_product.id
            JOIN product_groups right_group ON right_group.dim_product_id = right_product.id
            WHERE left_group.group_id <> right_group.group_id
              AND left_product.category_id = right_product.category_id
              AND lower(coalesce(left_product.brand_name, '')) = lower(coalesce(right_product.brand_name, ''))
              AND lower(coalesce(left_product.brand_name, '')) <> ''
              AND NOT EXISTS (
                  SELECT 1 FROM silver.comparison_store_brands store_brand
                  WHERE store_brand.normalized_brand = lower(trim(left_product.brand_name))
              )
              AND CASE
                    WHEN lower(left_product.pack_uom) IN ('g', 'kg') THEN 'mass'
                    WHEN lower(left_product.pack_uom) IN ('ml', 'l') THEN 'volume'
                    WHEN lower(left_product.pack_uom) IN ('ea', 'pack') THEN 'count'
                    ELSE 'other'
                  END = CASE
                    WHEN lower(right_product.pack_uom) IN ('g', 'kg') THEN 'mass'
                    WHEN lower(right_product.pack_uom) IN ('ml', 'l') THEN 'volume'
                    WHEN lower(right_product.pack_uom) IN ('ea', 'pack') THEN 'count'
                    ELSE 'other'
                  END
              AND abs(
                    (left_product.pack_quantity * CASE lower(left_product.pack_uom) WHEN 'g' THEN 0.001 WHEN 'ml' THEN 0.001 ELSE 1 END) -
                    (right_product.pack_quantity * CASE lower(right_product.pack_uom) WHEN 'g' THEN 0.001 WHEN 'ml' THEN 0.001 ELSE 1 END)
                  ) <= 0.001
              AND NOT (left_group.retailer_ids && right_group.retailer_ids)
              AND similarity(
                    lower(regexp_replace(left_product.product_name, '[^a-z0-9]+', ' ', 'g')),
                    lower(regexp_replace(right_product.product_name, '[^a-z0-9]+', ' ', 'g'))
                  ) >= 0.90
            ORDER BY score DESC, left_group.group_id, right_group.group_id
        LOOP
            target_group := LEAST(candidate.left_group_id, candidate.right_group_id);
            losing_group := GREATEST(candidate.left_group_id, candidate.right_group_id);
            IF EXISTS (
                SELECT 1 FROM silver.comparison_product_groups
                WHERE id = target_group AND status = 'active'
            ) AND EXISTS (
                SELECT 1 FROM silver.comparison_product_groups
                WHERE id = losing_group AND status = 'active'
            ) AND NOT EXISTS (
                SELECT 1
                FROM silver.comparison_product_members target_member
                JOIN silver.comparison_product_members losing_member
                  ON losing_member.retailer_id = target_member.retailer_id
                WHERE target_member.group_id = target_group
                  AND losing_member.group_id = losing_group
                  AND target_member.is_primary AND losing_member.is_primary
            ) THEN
                UPDATE silver.comparison_product_members
                SET group_id = target_group,
                    match_method = 'normalized_identity',
                    match_score = candidate.score,
                    updated_at = CURRENT_TIMESTAMP
                WHERE group_id = losing_group;
                UPDATE silver.comparison_product_groups
                SET status = 'merged', merged_into_group_id = target_group,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = losing_group;
            END IF;
        END LOOP;

        INSERT INTO silver.comparison_match_review_queue (
            left_dim_product_id, right_dim_product_id, match_score, reason
        )
        SELECT left_product.id, right_product.id,
               similarity(lower(left_product.product_name), lower(right_product.product_name)),
               'possible compatible product identity'
        FROM silver.dim_products left_product
        JOIN silver.dim_products right_product ON left_product.id < right_product.id
        WHERE left_product.category_id = right_product.category_id
          AND similarity(lower(left_product.product_name), lower(right_product.product_name)) >= 0.55
          AND similarity(lower(left_product.product_name), lower(right_product.product_name)) < 0.90
          AND EXISTS (
              SELECT 1 FROM silver.fct_product_prices left_price
              JOIN silver.fct_product_prices right_price
                ON right_price.retailer_id <> left_price.retailer_id
              WHERE left_price.product_id = left_product.id
                AND right_price.product_id = right_product.id
          )
        ON CONFLICT DO NOTHING;

        INSERT INTO silver.comparison_match_review_queue (
            left_dim_product_id, right_dim_product_id, match_score, reason
        )
        SELECT left_product.id, right_product.id, 1,
               'conflicting GTIN; manual retailer identity review required'
        FROM silver.dim_products left_product
        JOIN silver.dim_products right_product ON left_product.id < right_product.id
        WHERE left_product.gtin ~ '^[0-9]{8,14}$'
          AND left_product.gtin = right_product.gtin
          AND EXISTS (
              SELECT 1
              FROM silver.fct_product_prices left_price
              JOIN silver.fct_product_prices right_price
                ON right_price.retailer_id = left_price.retailer_id
              WHERE left_price.product_id = left_product.id
                AND right_price.product_id = right_product.id
          )
        ON CONFLICT DO NOTHING;
    END
    $$
    """


def _replace_comparison_views() -> None:
    op.execute(
        """
        CREATE OR REPLACE VIEW silver.comparison_products AS
        SELECT groups.id AS product_id,
               groups.category_id, category.category_name,
               groups.canonical_product_name AS product_name,
               groups.canonical_brand_name AS brand_name,
               product.gtin, groups.pack_quantity, groups.pack_uom,
               COALESCE(product.image_link_side, product.image_link_back) AS image_url,
               groups.updated_at,
               groups.canonical_product_id AS source_product_id
        FROM silver.comparison_product_groups groups
        JOIN silver.dim_products product ON product.id = groups.canonical_product_id
        JOIN silver.dim_categories category ON category.id = groups.category_id
        WHERE groups.status = 'active'
        """
    )
    op.execute(
        """
        CREATE OR REPLACE VIEW silver.comparison_latest_offers AS
        SELECT DISTINCT ON (member.group_id, price.retailer_id)
               member.group_id AS product_id,
               price.retailer_id, retailer.retailer_name,
               product.pack_quantity, product.pack_uom,
               price.price, price.unit_price, price.is_on_special,
               price.special_text, price.product_url,
               price.recorded_at AS observed_at,
               price.product_id AS retailer_product_id
        FROM silver.fct_product_prices price
        JOIN silver.comparison_product_members member
          ON member.dim_product_id = price.product_id
         AND member.retailer_id = price.retailer_id
         AND member.is_primary
        JOIN silver.comparison_product_groups groups
          ON groups.id = member.group_id AND groups.status = 'active'
        JOIN silver.dim_products product ON product.id = price.product_id
        JOIN silver.dim_retailers retailer ON retailer.id = price.retailer_id
        WHERE price.price > 0
        ORDER BY member.group_id, price.retailer_id, price.recorded_at DESC, price.id DESC
        """
    )
    op.execute(
        """
        CREATE OR REPLACE VIEW silver.comparison_price_history AS
        SELECT member.group_id AS product_id,
               price.retailer_id, retailer.retailer_name,
               price.price, price.unit_price, price.is_on_special,
               price.special_text, price.recorded_at AS observed_at,
               price.product_id AS retailer_product_id
        FROM silver.fct_product_prices price
        JOIN silver.comparison_product_members member
          ON member.dim_product_id = price.product_id
         AND member.retailer_id = price.retailer_id
         AND member.is_primary
        JOIN silver.comparison_product_groups groups
          ON groups.id = member.group_id AND groups.status = 'active'
        JOIN silver.dim_retailers retailer ON retailer.id = price.retailer_id
        WHERE price.price > 0
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS silver.comparison_price_history")
    op.execute("DROP VIEW IF EXISTS silver.comparison_latest_offers")
    op.execute("DROP VIEW IF EXISTS silver.comparison_products")
    op.execute("DROP FUNCTION IF EXISTS silver.refresh_comparison_product_groups()")
    op.execute("DROP TABLE IF EXISTS silver.etl_run_audit")
    op.execute("DROP TABLE IF EXISTS silver.comparison_match_review_queue")
    op.execute("DROP TABLE IF EXISTS silver.comparison_product_members")
    op.execute("DROP TABLE IF EXISTS silver.comparison_product_groups")
    op.execute("DROP TABLE IF EXISTS silver.comparison_store_brands")
