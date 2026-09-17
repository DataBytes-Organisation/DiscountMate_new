"""grant the comparison runtime its complete read-only Silver contract"""

from __future__ import annotations

from alembic import op

revision = "20260828_0011"
down_revision = "20260827_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'comparison_reader') THEN
                IF EXISTS (
                    SELECT 1
                    FROM pg_roles
                    WHERE rolname = 'comparison_reader'
                      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit)
                ) THEN
                    RAISE EXCEPTION
                        'comparison_reader must be a least-privilege NOINHERIT role';
                END IF;

                GRANT USAGE ON SCHEMA silver TO comparison_reader;
                GRANT SELECT ON
                    silver.comparison_latest_offers,
                    silver.comparison_match_review_queue,
                    silver.comparison_price_history,
                    silver.comparison_product_groups,
                    silver.comparison_product_members,
                    silver.comparison_products,
                    silver.dim_retailers
                TO comparison_reader;
            ELSE
                RAISE NOTICE
                    'comparison_reader is absent; retaining the existing shared database user rollout';
            END IF;
        END
        $$
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'comparison_reader') THEN
                REVOKE SELECT ON
                    silver.comparison_latest_offers,
                    silver.comparison_match_review_queue,
                    silver.comparison_price_history,
                    silver.comparison_product_groups,
                    silver.comparison_product_members,
                    silver.comparison_products,
                    silver.dim_retailers
                FROM comparison_reader;
            END IF;
        END
        $$
        """
    )
