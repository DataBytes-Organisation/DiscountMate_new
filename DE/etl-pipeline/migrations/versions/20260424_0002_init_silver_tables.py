"""initialize silver warehouse tables"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260424_0002"
down_revision = "20260401_0001"
branch_labels = None
depends_on = None

RETAILER_SEED_ROWS = [
    ("aldi", "https://www.aldi.com.au/"),
    ("coles", "https://www.coles.com.au/"),
    ("iga", "https://www.iga.com.au/"),
    ("woolworths", "https://www.woolworths.com.au/"),
]

CATEGORY_SEED_ROWS = [
    "ALCOHOL",
    "BABY FOOD & ACCESSORIES",
    "BAKERY",
    "BEVERAGES",
    "CONTINENTAL",
    "CONVENIENCE FOOD",
    "DAIRY & REFRIGERATED",
    "DELI & CHILLED MEALS",
    "FROZEN FOODS",
    "FRUIT, VEG & PRODUCE",
    "HEALTH & BEAUTY",
    "HEALTH FOOD & SUPPLEMENTS",
    "HOUSEHOLD ITEMS",
    "MISCELLANEOUS",
    "PANTRY",
    "PET FOOD & ACCESSORIES",
    "POULTRY, MEAT & SEAFOOD",
    "SEASONAL",
    "SNACKS & CONFECTIONARY",
    "SPECIALS",
]


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE SCHEMA IF NOT EXISTS silver")

    op.create_table(
        "dim_retailers",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("retailer_name", sa.Text(), nullable=False),
        sa.Column("website_url", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("retailer_name", name="uq_dim_retailers_retailer_name"),
        schema="silver",
    )

    op.create_table(
        "dim_categories",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("category_name", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("category_name", name="uq_dim_categories_category_name"),
        schema="silver",
    )

    op.create_table(
        "dim_products",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.Column("product_name", sa.Text(), nullable=False),
        sa.Column("brand_name", sa.Text(), nullable=True),
        sa.Column("gtin", sa.String(length=14), nullable=True),
        sa.Column("pack_quantity", sa.Numeric(10, 3), nullable=True),
        sa.Column("pack_uom", sa.Text(), nullable=True),
        sa.Column("price_current_coles", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_last_coles", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_current_woolworths", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_last_woolworths", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_current_aldi", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_last_aldi", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_current_iga", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_last_iga", sa.Numeric(10, 2), nullable=True),
        sa.Column("unit_price_current_coles", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_price_last_coles", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_price_current_woolworths", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_price_last_woolworths", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_price_current_aldi", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_price_last_aldi", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_price_current_iga", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_price_last_iga", sa.Numeric(12, 4), nullable=True),
        sa.Column("image_link_side", sa.Text(), nullable=True),
        sa.Column("image_link_back", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "pack_quantity IS NULL OR pack_quantity > 0",
            name="ck_dim_products_pack_quantity_positive",
        ),
        sa.CheckConstraint(
            "pack_uom IS NULL OR lower(pack_uom) IN ('g', 'kg', 'ml', 'l', 'ea', 'pack', 'm')",
            name="ck_dim_products_pack_uom_allowed",
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["silver.dim_categories.id"],
            name="fk_dim_products_category_id",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("gtin", name="uq_dim_products_gtin"),
        schema="silver",
    )

    op.create_table(
        "fct_product_prices",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.Column("retailer_id", sa.UUID(), nullable=False),
        sa.Column("item_name", sa.Text(), nullable=False),
        sa.Column("special_text", sa.Text(), nullable=True),
        sa.Column("product_url", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("unit_price", sa.Numeric(12, 4), nullable=True),
        sa.Column("is_on_special", sa.Boolean(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["silver.dim_categories.id"],
            name="fk_fct_product_prices_category_id",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["silver.dim_products.id"],
            name="fk_fct_product_prices_product_id",
        ),
        sa.ForeignKeyConstraint(
            ["retailer_id"],
            ["silver.dim_retailers.id"],
            name="fk_fct_product_prices_retailer_id",
        ),
        sa.PrimaryKeyConstraint("id", "recorded_at"),
        schema="silver",
    )

    op.create_table(
        "static_master_coles_products",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("product_id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("brand", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("long_description", sa.Text(), nullable=True),
        sa.Column("size", sa.Text(), nullable=True),
        sa.Column("gtin", sa.String(length=14), nullable=True),
        sa.Column("merchandise_category", sa.Text(), nullable=False),
        sa.Column("online_aisle", sa.Text(), nullable=True),
        sa.Column("brand_name", sa.Text(), nullable=True),
        sa.Column("price_now", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_was", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_comparable", sa.Text(), nullable=True),
        sa.Column("variations_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("images_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("local_image_paths", sa.Text(), nullable=True),
        sa.Column("image_count", sa.Integer(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("scraped_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scrape_status", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema="silver",
    )

    op.create_index(
        "idx_dim_products_category_id",
        "dim_products",
        ["category_id"],
        unique=False,
        schema="silver",
    )
    op.create_index(
        "idx_fct_product_prices_product_recorded_at",
        "fct_product_prices",
        ["product_id", "recorded_at"],
        unique=False,
        schema="silver",
    )
    op.create_index(
        "idx_fct_product_prices_retailer_recorded_at",
        "fct_product_prices",
        ["retailer_id", "recorded_at"],
        unique=False,
        schema="silver",
    )
    op.create_index(
        "idx_static_master_coles_products_product_id_scraped_at",
        "static_master_coles_products",
        ["product_id", "scraped_at"],
        unique=False,
        schema="silver",
    )
    op.create_index(
        "idx_static_master_coles_products_gtin_scraped_at",
        "static_master_coles_products",
        ["gtin", "scraped_at"],
        unique=False,
        schema="silver",
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_dim_products_canonical_key
        ON silver.dim_products (
            COALESCE(lower(brand_name), ''),
            lower(product_name),
            COALESCE(pack_quantity, -1),
            COALESCE(lower(pack_uom), '')
        )
        """
    )

    for retailer_name, website_url in RETAILER_SEED_ROWS:
        op.execute(
            sa.text(
                """
                INSERT INTO silver.dim_retailers (retailer_name, website_url)
                VALUES (:retailer_name, :website_url)
                ON CONFLICT (retailer_name) DO NOTHING
                """
            ).bindparams(retailer_name=retailer_name, website_url=website_url)
        )

    for category_name in CATEGORY_SEED_ROWS:
        op.execute(
            sa.text(
                """
                INSERT INTO silver.dim_categories (category_name)
                VALUES (:category_name)
                ON CONFLICT (category_name) DO NOTHING
                """
            ).bindparams(category_name=category_name)
        )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS silver.uq_dim_products_canonical_key")
    op.drop_index(
        "idx_static_master_coles_products_gtin_scraped_at",
        table_name="static_master_coles_products",
        schema="silver",
    )
    op.drop_index(
        "idx_static_master_coles_products_product_id_scraped_at",
        table_name="static_master_coles_products",
        schema="silver",
    )
    op.drop_index(
        "idx_fct_product_prices_retailer_recorded_at",
        table_name="fct_product_prices",
        schema="silver",
    )
    op.drop_index(
        "idx_fct_product_prices_product_recorded_at",
        table_name="fct_product_prices",
        schema="silver",
    )
    op.drop_index(
        "idx_dim_products_category_id",
        table_name="dim_products",
        schema="silver",
    )
    op.drop_table("static_master_coles_products", schema="silver")
    op.drop_table("fct_product_prices", schema="silver")
    op.drop_table("dim_products", schema="silver")
    op.drop_table("dim_categories", schema="silver")
    op.drop_table("dim_retailers", schema="silver")
