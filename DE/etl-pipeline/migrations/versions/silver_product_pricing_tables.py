"""create silver product pricing tables"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260430_0002"
down_revision = "20260401_0001"
branch_labels = None
depends_on = None

STANDARD_CATEGORIES = [
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

RETAILERS = [
    ("Coles", "https://www.coles.com.au"),
    ("Woolworths", "https://www.woolworths.com.au"),
    ("IGA", "https://www.iga.com.au"),
    ("Aldi", "https://www.aldi.com.au"),
]


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE SCHEMA IF NOT EXISTS silver")

    op.create_table(
        "dim_categories",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("category_name", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("category_name", name="uq_dim_categories_category_name"),
        schema="silver",
    )

    op.create_table(
        "dim_retailers",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("retailer_name", sa.Text(), nullable=False),
        sa.Column("website_url", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("retailer_name", name="uq_dim_retailers_retailer_name"),
        schema="silver",
    )

    op.create_table(
        "dim_products",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.Column("product_name", sa.Text(), nullable=False),
        sa.Column("brand_name", sa.Text(), nullable=True),
        sa.Column("gtin", sa.String(length=14), nullable=True),
        sa.Column("pack_quantity", sa.Numeric(10, 3), nullable=True),
        sa.Column("pack_uom", sa.Text(), nullable=True),
        sa.Column("price_current_coles", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_current_woolworths", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_current_aldi", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_current_iga", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_last_week_coles", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_last_week_woolworths", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_last_week_aldi", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_last_week_iga", sa.Numeric(10, 2), nullable=True),
        sa.Column("unit_price_current_coles", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_price_current_woolworths", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_price_current_aldi", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_price_current_iga", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_price_last_week_coles", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_price_last_week_woolworths", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_price_last_week_aldi", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_price_last_week_iga", sa.Numeric(12, 4), nullable=True),
        sa.Column("image_link_side", sa.Text(), nullable=True),
        sa.Column("image_link_back", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["silver.dim_categories.id"],
            name="fk_dim_products_category_id",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "pack_quantity IS NULL OR pack_quantity > 0",
            name="ck_dim_products_pack_quantity_positive",
        ),
        schema="silver",
    )
    op.create_index(
        "uq_dim_products_gtin",
        "dim_products",
        ["gtin"],
        unique=True,
        schema="silver",
        postgresql_where=sa.text("gtin IS NOT NULL"),
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_dim_products_natural_no_gtin
        ON silver.dim_products (
            lower(product_name),
            lower(coalesce(brand_name, '')),
            category_id
        )
        WHERE gtin IS NULL
        """
    )

    op.create_table(
        "fct_product_prices",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
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
        sa.Column(
            "is_on_special",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
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
        sa.PrimaryKeyConstraint("id"),
        schema="silver",
    )
    op.create_index(
        "uq_fct_product_prices_snapshot",
        "fct_product_prices",
        ["product_id", "retailer_id", "recorded_at"],
        unique=True,
        schema="silver",
    )

    categories_table = sa.table(
        "dim_categories",
        sa.column("category_name", sa.Text()),
        schema="silver",
    )
    op.bulk_insert(
        categories_table,
        [{"category_name": category} for category in STANDARD_CATEGORIES],
    )

    retailers_table = sa.table(
        "dim_retailers",
        sa.column("retailer_name", sa.Text()),
        sa.column("website_url", sa.Text()),
        schema="silver",
    )
    op.bulk_insert(
        retailers_table,
        [
            {"retailer_name": retailer, "website_url": website_url}
            for retailer, website_url in RETAILERS
        ],
    )


def downgrade() -> None:
    op.drop_index(
        "uq_fct_product_prices_snapshot",
        table_name="fct_product_prices",
        schema="silver",
    )
    op.drop_table("fct_product_prices", schema="silver")
    op.execute("DROP INDEX IF EXISTS silver.uq_dim_products_natural_no_gtin")
    op.drop_index("uq_dim_products_gtin", table_name="dim_products", schema="silver")
    op.drop_table("dim_products", schema="silver")
    op.drop_table("dim_retailers", schema="silver")
    op.drop_table("dim_categories", schema="silver")
