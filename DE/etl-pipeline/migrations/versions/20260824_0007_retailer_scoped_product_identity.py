"""Allow retailer-scoped products to share comparison identity keys.

Revision ID: 20260824_0007
Revises: 20260823_0006
"""

from __future__ import annotations

from alembic import op

revision = "20260824_0007"
down_revision = "20260823_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE silver.dim_products
        DROP CONSTRAINT IF EXISTS uq_dim_products_gtin;

        DROP INDEX IF EXISTS silver.uq_dim_products_canonical_key;

        CREATE INDEX IF NOT EXISTS idx_dim_products_gtin
        ON silver.dim_products(gtin)
        WHERE gtin IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_dim_products_canonical_key
        ON silver.dim_products (
            COALESCE(lower(brand_name), ''),
            lower(product_name),
            COALESCE(pack_quantity, -1),
            COALESCE(lower(pack_uom), '')
        );

        COMMENT ON INDEX silver.idx_dim_products_gtin IS
        'Non-unique lookup: exact cross-retailer identity is owned by comparison product groups.';
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS silver.idx_dim_products_gtin;
        DROP INDEX IF EXISTS silver.idx_dim_products_canonical_key;

        CREATE UNIQUE INDEX uq_dim_products_canonical_key
        ON silver.dim_products (
            COALESCE(lower(brand_name), ''),
            lower(product_name),
            COALESCE(pack_quantity, -1),
            COALESCE(lower(pack_uom), '')
        );

        ALTER TABLE silver.dim_products
        ADD CONSTRAINT uq_dim_products_gtin UNIQUE (gtin);
        """
    )
