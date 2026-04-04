"""create dim_retailers table"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260404_0002"
down_revision = "20260401_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dim_retailers",
        sa.Column("store_chain", sa.Text(), primary_key=True, nullable=False),
        sa.Column("store_name", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        schema="silver",
    )
    op.execute(
        sa.text(
            """
            INSERT INTO silver.dim_retailers (store_chain, store_name, created_at, updated_at)
            VALUES
                ('coles', 'Coles', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                ('woolworths', 'Woolworths', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                ('iga', 'IGA', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                ('aldi', 'ALDI', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """
        )
    )


def downgrade() -> None:
    op.drop_table("dim_retailers", schema="silver")
