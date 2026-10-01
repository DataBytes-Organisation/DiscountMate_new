"""add stable read-only comparison views"""

from __future__ import annotations

from alembic import op

revision = "20260821_0004"
down_revision = "20260510_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE VIEW silver.comparison_products AS
        SELECT
            p.id AS product_id,
            p.category_id,
            c.category_name,
            p.product_name,
            p.brand_name,
            p.gtin,
            p.pack_quantity,
            p.pack_uom,
            COALESCE(p.image_link_side, p.image_link_back) AS image_url,
            p.updated_at
        FROM silver.dim_products p
        JOIN silver.dim_categories c ON c.id = p.category_id
        WHERE p.pack_quantity IS NOT NULL
          AND p.pack_uom IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE OR REPLACE VIEW silver.comparison_latest_offers AS
        SELECT DISTINCT ON (price.product_id, price.retailer_id)
            price.product_id,
            price.retailer_id,
            retailer.retailer_name,
            product.pack_quantity,
            product.pack_uom,
            price.price,
            price.unit_price,
            price.is_on_special,
            price.special_text,
            price.product_url,
            price.recorded_at AS observed_at
        FROM silver.fct_product_prices price
        JOIN silver.dim_products product ON product.id = price.product_id
        JOIN silver.dim_retailers retailer ON retailer.id = price.retailer_id
        WHERE price.price > 0
        ORDER BY price.product_id, price.retailer_id, price.recorded_at DESC, price.id DESC
        """
    )
    op.execute(
        """
        CREATE OR REPLACE VIEW silver.comparison_price_history AS
        SELECT
            price.product_id,
            price.retailer_id,
            retailer.retailer_name,
            price.price,
            price.unit_price,
            price.is_on_special,
            price.special_text,
            price.recorded_at AS observed_at
        FROM silver.fct_product_prices price
        JOIN silver.dim_retailers retailer ON retailer.id = price.retailer_id
        WHERE price.price > 0
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'comparison_reader') THEN
                GRANT USAGE ON SCHEMA silver TO comparison_reader;
                GRANT SELECT ON silver.comparison_products,
                                silver.comparison_latest_offers,
                                silver.comparison_price_history
                TO comparison_reader;
            END IF;
        END
        $$
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS silver.comparison_price_history")
    op.execute("DROP VIEW IF EXISTS silver.comparison_latest_offers")
    op.execute("DROP VIEW IF EXISTS silver.comparison_products")
