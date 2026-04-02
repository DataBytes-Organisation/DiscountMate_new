"""create demo product pricing summary table"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260401_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS silver")
    op.create_table(
        "demo_product_pricing_summary",
        sa.Column("retailer", sa.Text(), nullable=False),
        sa.Column("run_date", sa.Date(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("product_count", sa.Integer(), nullable=False),
        sa.Column("priced_product_count", sa.Integer(), nullable=False),
        sa.Column("avg_current_price", sa.Double(), nullable=True),
        sa.Column("min_current_price", sa.Double(), nullable=True),
        sa.Column("max_current_price", sa.Double(), nullable=True),
        sa.Column("discounted_product_count", sa.Integer(), nullable=False),
        sa.Column("loaded_at", sa.DateTime(), nullable=False),
        schema="silver",
    )
    op.create_index(
        "idx_demo_product_pricing_summary_slice",
        "demo_product_pricing_summary",
        ["retailer", "run_date"],
        unique=False,
        schema="silver",
    )


def downgrade() -> None:
    op.drop_index(
        "idx_demo_product_pricing_summary_slice",
        table_name="demo_product_pricing_summary",
        schema="silver",
    )
    op.drop_table("demo_product_pricing_summary", schema="silver")
