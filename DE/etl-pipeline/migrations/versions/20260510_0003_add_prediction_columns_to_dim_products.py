"""add prediction columns to dim_products"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260510_0003"
down_revision = "20260424_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "dim_products",
        sa.Column("prophet_price_pred", sa.Float(), nullable=True),
        schema="silver",
    )
    op.add_column(
        "dim_products",
        sa.Column("prophet_on_sale_pred", sa.Boolean(), nullable=True),
        schema="silver",
    )
    op.add_column(
        "dim_products",
        sa.Column("xgboost_price_pred", sa.Float(), nullable=True),
        schema="silver",
    )
    op.add_column(
        "dim_products",
        sa.Column(
            "true_value_classification",
            sa.Text(),
            nullable=True,
            comment=(
                "Customer-facing true value label derived from discount scoring, "
                "for example: OK Discount, Good Discount, Excellent Discount, "
                "or DiscountMate Recommends."
            ),
        ),
        schema="silver",
    )


def downgrade() -> None:
    op.drop_column("dim_products", "true_value_classification", schema="silver")
    op.drop_column("dim_products", "xgboost_price_pred", schema="silver")
    op.drop_column("dim_products", "prophet_on_sale_pred", schema="silver")
    op.drop_column("dim_products", "prophet_price_pred", schema="silver")
