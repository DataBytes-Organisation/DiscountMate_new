"""Bound synchronous comparison grouping to deterministic identities.

Revision ID: 20260825_0008
Revises: 20260824_0007
"""

from __future__ import annotations

from alembic import op

revision = "20260825_0008"
down_revision = "20260824_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        r"""
        CREATE OR REPLACE FUNCTION silver.refresh_comparison_product_groups_pass()
        RETURNS void
        LANGUAGE plpgsql
        AS $$
        BEGIN
            INSERT INTO silver.comparison_product_groups (
                canonical_product_id, canonical_product_name, canonical_brand_name,
                category_id, pack_quantity, pack_uom
            )
            SELECT DISTINCT product.id, product.product_name, product.brand_name,
                   product.category_id, product.pack_quantity, product.pack_uom
            FROM silver.dim_products product
            JOIN silver.fct_product_prices price ON price.product_id = product.id
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
                JOIN silver.comparison_product_groups active_group
                  ON active_group.id = member.group_id
                 AND active_group.status = 'active'
                WHERE member.dim_product_id = facts.product_id
                ORDER BY member.group_id
                LIMIT 1
            ) existing ON TRUE
            WHERE NOT EXISTS (
                SELECT 1
                FROM silver.comparison_product_members occupied
                WHERE occupied.group_id = COALESCE(existing.group_id, canonical.id)
                  AND occupied.retailer_id = facts.retailer_id
                  AND occupied.is_primary
            )
            ON CONFLICT (dim_product_id, retailer_id) DO NOTHING;
        END
        $$;

        CREATE OR REPLACE FUNCTION silver.merge_comparison_product_groups_pass()
        RETURNS integer
        LANGUAGE plpgsql
        AS $$
        DECLARE candidate record;
        DECLARE target_group uuid;
        DECLARE losing_group uuid;
        DECLARE merged_group_count integer := 0;
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
                    JOIN silver.dim_products right_product
                      ON right_product.gtin = left_product.gtin
                     AND left_product.id < right_product.id
                    JOIN product_groups right_group ON right_group.dim_product_id = right_product.id
                    WHERE left_group.group_id <> right_group.group_id
                      AND left_product.gtin ~ '^[0-9]{8,14}$'
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

                    SELECT left_group.group_id, right_group.group_id,
                           'normalized_identity'::text, 1.0::numeric, 1
                    FROM silver.dim_products left_product
                    JOIN product_groups left_group ON left_group.dim_product_id = left_product.id
                    JOIN silver.dim_products right_product
                      ON right_product.category_id = left_product.category_id
                     AND lower(coalesce(right_product.brand_name, '')) =
                         lower(coalesce(left_product.brand_name, ''))
                     AND lower(regexp_replace(right_product.product_name, '[^a-z0-9]+', ' ', 'g')) =
                         lower(regexp_replace(left_product.product_name, '[^a-z0-9]+', ' ', 'g'))
                     AND coalesce(right_product.pack_quantity, -1) =
                         coalesce(left_product.pack_quantity, -1)
                     AND coalesce(lower(right_product.pack_uom), '') =
                         coalesce(lower(left_product.pack_uom), '')
                     AND left_product.id < right_product.id
                    JOIN product_groups right_group ON right_group.dim_product_id = right_product.id
                    WHERE left_group.group_id <> right_group.group_id
                      AND lower(coalesce(left_product.brand_name, '')) <> ''
                      AND NOT EXISTS (
                          SELECT 1 FROM silver.comparison_store_brands store_brand
                          WHERE store_brand.normalized_brand = lower(trim(left_product.brand_name))
                      )
                      AND NOT (left_group.retailer_ids && right_group.retailer_ids)
                )
                SELECT DISTINCT ON (
                    LEAST(left_group_id, right_group_id),
                    GREATEST(left_group_id, right_group_id)
                ) left_group_id, right_group_id, match_method, score
                FROM candidates
                ORDER BY LEAST(left_group_id, right_group_id),
                         GREATEST(left_group_id, right_group_id), method_rank
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
        END
        $$;

        COMMENT ON FUNCTION silver.refresh_comparison_product_groups_pass() IS
        'Synchronous singleton maintenance only; fuzzy review candidates are generated offline.';
        """
    )


def downgrade() -> None:
    # Restoring the unbounded implementation requires the prior migration code;
    # disabling grouping v2 is the supported rollback path.
    pass
