"""Backfill relative Coles image paths to absolute URLs.

Revision ID: 20260827_0010
Revises: 20260826_0009

The Coles pricing feed's ImageUri column has always contained a
domain-relative path (e.g. "/1/1613640.jpg") rather than a full URL.
features/products/coles/workflow_sql/transform.sql previously stored
that value in dim_products.image_link_side verbatim, so ~360k Coles
products (and any product matched cross-retailer onto a Coles dim_products
row) ended up with an unusable image URL that <Image> can't load. The
transform now prepends the Coles product-image CDN base
(https://productimages.coles.com.au/productimages) for future loads;
this migration backfills the rows already in the table.
"""

from __future__ import annotations

from alembic import op

revision = "20260827_0010"
down_revision = "20260826_0009"
branch_labels = None
depends_on = None

IMAGE_BASE_URL = "https://productimages.coles.com.au/productimages"


def upgrade() -> None:
    op.execute(
        f"""
        UPDATE silver.dim_products
        SET image_link_side = '{IMAGE_BASE_URL}' || image_link_side,
            updated_at = CURRENT_TIMESTAMP
        WHERE image_link_side ~ '^/'
        """
    )
    op.execute(
        f"""
        UPDATE silver.dim_products
        SET image_link_back = '{IMAGE_BASE_URL}' || image_link_back,
            updated_at = CURRENT_TIMESTAMP
        WHERE image_link_back ~ '^/'
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        UPDATE silver.dim_products
        SET image_link_side = regexp_replace(image_link_side, '^{IMAGE_BASE_URL}', '')
        WHERE image_link_side ~ '^{IMAGE_BASE_URL}'
        """
    )
    op.execute(
        f"""
        UPDATE silver.dim_products
        SET image_link_back = regexp_replace(image_link_back, '^{IMAGE_BASE_URL}', '')
        WHERE image_link_back ~ '^{IMAGE_BASE_URL}'
        """
    )
