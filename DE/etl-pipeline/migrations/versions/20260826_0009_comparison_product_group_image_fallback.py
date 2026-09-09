"""Fall back to any matched retailer's image for a comparison product group.

Revision ID: 20260826_0009
Revises: 20260825_0008

silver.comparison_products previously sourced image_url only from the
group's canonical_product_id row. A group can span several retailers
(matched by GTIN or name/pack similarity), and the canonical row is
whichever retailer happened to be inserted first -- it is never
reselected as later members join the group. When that specific
retailer's scrape had no image for the item, the comparison UI showed
no image at all even though a matched sibling row from another
retailer had one.
"""

from __future__ import annotations

from alembic import op

revision = "20260826_0009"
down_revision = "20260825_0008"
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
              AND COALESCE(member_product.image_link_side, member_product.image_link_back) IS NOT NULL
            ORDER BY member.updated_at DESC
            LIMIT 1
        ) member_image ON TRUE
        WHERE groups.status = 'active'
        """
    )


def downgrade() -> None:
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
