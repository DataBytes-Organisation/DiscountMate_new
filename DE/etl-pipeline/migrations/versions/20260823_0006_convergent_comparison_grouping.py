"""Make comparison grouping refresh converge across safe merge passes.

Revision ID: 20260823_0006
Revises: 20260822_0005
"""

from __future__ import annotations

from alembic import op

revision = "20260823_0006"
down_revision = "20260822_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Preserve the applied implementation as the singleton/review-queue pass.
    # The smaller merge pass omits expensive review-queue generation, making it
    # safe to repeat until transitive three/four-retailer merges converge.
    op.execute(
        r"""
        ALTER FUNCTION silver.refresh_comparison_product_groups()
        RENAME TO refresh_comparison_product_groups_pass;

        CREATE FUNCTION silver.merge_comparison_product_groups_pass()
        RETURNS integer
        LANGUAGE plpgsql
        AS $$
        DECLARE
            candidate record;
            target_group uuid;
            losing_group uuid;
            merged_group_count integer := 0;
        BEGIN
            FOR candidate IN
                WITH group_retailers AS (
                    SELECT member.group_id,
                           array_agg(DISTINCT member.retailer_id) AS retailer_ids
                    FROM silver.comparison_product_members member
                    JOIN silver.comparison_product_groups active_group
                      ON active_group.id = member.group_id
                     AND active_group.status = 'active'
                    WHERE member.is_primary
                    GROUP BY member.group_id
                ), product_groups AS (
                    SELECT member.dim_product_id, member.group_id,
                           group_retailers.retailer_ids
                    FROM silver.comparison_product_members member
                    JOIN group_retailers ON group_retailers.group_id = member.group_id
                    WHERE member.is_primary
                ), candidates AS (
                    SELECT left_group.group_id AS left_group_id,
                           right_group.group_id AS right_group_id,
                           'gtin'::text AS match_method,
                           1.0::numeric AS score,
                           0 AS method_rank
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

                    UNION ALL

                    SELECT left_group.group_id,
                           right_group.group_id,
                           'normalized_identity'::text,
                           similarity(
                               lower(regexp_replace(left_product.product_name, '[^a-z0-9]+', ' ', 'g')),
                               lower(regexp_replace(right_product.product_name, '[^a-z0-9]+', ' ', 'g'))
                           )::numeric,
                           1
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
                            (left_product.pack_quantity * CASE lower(left_product.pack_uom)
                                WHEN 'g' THEN 0.001 WHEN 'ml' THEN 0.001 ELSE 1 END) -
                            (right_product.pack_quantity * CASE lower(right_product.pack_uom)
                                WHEN 'g' THEN 0.001 WHEN 'ml' THEN 0.001 ELSE 1 END)
                          ) <= 0.001
                      AND NOT (left_group.retailer_ids && right_group.retailer_ids)
                      AND similarity(
                            lower(regexp_replace(left_product.product_name, '[^a-z0-9]+', ' ', 'g')),
                            lower(regexp_replace(right_product.product_name, '[^a-z0-9]+', ' ', 'g'))
                          ) >= 0.90
                )
                SELECT DISTINCT ON (
                    LEAST(left_group_id, right_group_id),
                    GREATEST(left_group_id, right_group_id)
                ) left_group_id, right_group_id, match_method, score
                FROM candidates
                ORDER BY LEAST(left_group_id, right_group_id),
                         GREATEST(left_group_id, right_group_id),
                         method_rank, score DESC
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
                      AND target_member.is_primary
                      AND losing_member.is_primary
                ) THEN
                    UPDATE silver.comparison_product_members
                    SET group_id = target_group,
                        match_method = candidate.match_method,
                        match_score = candidate.score,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE group_id = losing_group;

                    UPDATE silver.comparison_product_groups
                    SET status = 'merged', merged_into_group_id = target_group,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = losing_group;

                    merged_group_count := merged_group_count + 1;
                END IF;
            END LOOP;

            RETURN merged_group_count;
        END;
        $$;

        CREATE FUNCTION silver.refresh_comparison_product_groups()
        RETURNS void
        LANGUAGE plpgsql
        AS $$
        DECLARE
            merged_group_count integer;
        BEGIN
            -- Only run the original singleton/review pass when a newly loaded
            -- product-retailer identity has no active membership yet.
            IF EXISTS (
                SELECT 1
                FROM (
                    SELECT DISTINCT product_id, retailer_id
                    FROM silver.fct_product_prices
                ) facts
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM silver.comparison_product_members member
                    JOIN silver.comparison_product_groups active_group
                      ON active_group.id = member.group_id
                     AND active_group.status = 'active'
                    WHERE member.dim_product_id = facts.product_id
                      AND member.retailer_id = facts.retailer_id
                )
            ) THEN
                PERFORM silver.refresh_comparison_product_groups_pass();
            END IF;

            LOOP
                merged_group_count := silver.merge_comparison_product_groups_pass();
                EXIT WHEN merged_group_count = 0;
            END LOOP;
        END;
        $$;

        COMMENT ON FUNCTION silver.refresh_comparison_product_groups() IS
        'Runs singleton/review maintenance once, then conflict-safe group merges until convergence.';
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP FUNCTION IF EXISTS silver.refresh_comparison_product_groups();
        DROP FUNCTION IF EXISTS silver.merge_comparison_product_groups_pass();
        ALTER FUNCTION silver.refresh_comparison_product_groups_pass()
        RENAME TO refresh_comparison_product_groups;
        """
    )
