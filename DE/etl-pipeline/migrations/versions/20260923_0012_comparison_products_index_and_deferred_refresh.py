"""Use the indexed primary-member lookup for the image fallback and defer group refresh.

Revision ID: 20260923_0012
Revises: 20260828_0011

Two fixes:

1. silver.comparison_products' image-fallback LATERAL join (added in
   20260826_0009) filters silver.comparison_product_members by group_id
   only. The only index covering group_id is the partial index
   uq_comparison_group_primary_retailer (WHERE is_primary), so without an
   is_primary predicate in this query Postgres cannot prove the index is
   safe to use and falls back to a full scan of comparison_product_members
   for every row the view touches. In production (~492k members) this made
   both product search and single-product lookups take 15-90+ seconds,
   since silver.comparison_products backs both. Adding "AND member.is_primary"
   lets the planner use the existing index; every inserted member row is
   already is_primary = true today, so this changes no results.

2. 20260822_0005's upgrade() used to call
   silver.refresh_comparison_product_groups() inline, using that revision's
   own O(n**2) self-join implementation (fixed later, but only for later
   callers, by 20260825_0008). That call has been removed from 20260822_0005
   so a full migration run from an empty database no longer executes the
   unbounded self-join. The initial group population now happens here
   instead, once the bounded/equi-join passes from 20260825_0008 are in
   place, so it uses the fast path on any fresh environment.
"""

from __future__ import annotations

from alembic import op

revision = "20260923_0012"
down_revision = "20260828_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE VIEW silver.comparison_products AS
        SELECT groups.id AS product_id,
               groups.category_id, category.category_name,
               groups.canonical_product_name AS product_name,
               groups.canonical_brand_name AS brand_name,
               product.gtin, groups.pack_quantity, groups.pack_uom,
               COALESCE(
                   product.image_link_side,
                   product.image_link_back,
                   member_image.image_url
               ) AS image_url,
               groups.updated_at,
               groups.canonical_product_id AS source_product_id
        FROM silver.comparison_product_groups groups
        JOIN silver.dim_products product ON product.id = groups.canonical_product_id
        JOIN silver.dim_categories category ON category.id = groups.category_id
        LEFT JOIN LATERAL (
            SELECT COALESCE(member_product.image_link_side, member_product.image_link_back) AS image_url
            FROM silver.comparison_product_members member
            JOIN silver.dim_products member_product ON member_product.id = member.dim_product_id
            WHERE member.group_id = groups.id
              AND member.is_primary
              AND COALESCE(member_product.image_link_side, member_product.image_link_back) IS NOT NULL
            ORDER BY member.updated_at DESC
            LIMIT 1
        ) member_image ON TRUE
        WHERE groups.status = 'active'
        """
    )
    op.execute("SELECT silver.refresh_comparison_product_groups()")


def downgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE VIEW silver.comparison_products AS
        SELECT groups.id AS product_id,
               groups.category_id, category.category_name,
               groups.canonical_product_name AS product_name,
               groups.canonical_brand_name AS brand_name,
               product.gtin, groups.pack_quantity, groups.pack_uom,
               COALESCE(
                   product.image_link_side,
                   product.image_link_back,
                   member_image.image_url
               ) AS image_url,
               groups.updated_at,
               groups.canonical_product_id AS source_product_id
        FROM silver.comparison_product_groups groups
        JOIN silver.dim_products product ON product.id = groups.canonical_product_id
        JOIN silver.dim_categories category ON category.id = groups.category_id
        LEFT JOIN LATERAL (
            SELECT COALESCE(member_product.image_link_side, member_product.image_link_back) AS image_url
            FROM silver.comparison_product_members member
            JOIN silver.dim_products member_product ON member_product.id = member.dim_product_id
            WHERE member.group_id = groups.id
              AND COALESCE(member_product.image_link_side, member_product.image_link_back) IS NOT NULL
            ORDER BY member.updated_at DESC
            LIMIT 1
        ) member_image ON TRUE
        WHERE groups.status = 'active'
        """
    )
