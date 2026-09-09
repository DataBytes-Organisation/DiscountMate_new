from pathlib import Path

import duckdb
import pytest

from common.duckdb_utils import render_sql_template
from features.products.woolworths import job as woolworths_job

TRANSFORM_SQL = (
    Path(__file__).parents[1]
    / "features"
    / "products"
    / "woolworths"
    / "workflow_sql"
    / "transform.sql"
)


def test_woolworths_transform_preserves_valid_gtin_and_rejects_scientific_notation() -> None:
    conn = duckdb.connect()
    conn.execute(
        """
        CREATE TABLE raw_input (
            Stockcode VARCHAR,
            Barcode VARCHAR,
            DisplayName VARCHAR,
            Name VARCHAR,
            PackageSize VARCHAR,
            SapCategoryName VARCHAR,
            PromotionType VARCHAR,
            UrlFriendlyName VARCHAR,
            LargeImageFile VARCHAR,
            Price VARCHAR,
            CupPrice VARCHAR,
            CupMeasure VARCHAR,
            CupString VARCHAR,
            IsOnSpecial VARCHAR,
            Timestamp VARCHAR,
            source_file VARCHAR
        );

        INSERT INTO raw_input VALUES
            ('100', '9300000000001', 'BrandCo Milk 1L', 'BrandCo Milk 1L', '1L',
             'Milk', NULL, 'brandco-milk-1l', NULL, '3.50', '3.50', '1L', '$3.50 / 1L',
             'false', '2026-05-04T10:00:00', 'woolworths.csv'),
            ('101', '9.3007E+12', 'Broken Barcode Milk 1L', 'Broken Barcode Milk 1L', '1L',
             'Milk', NULL, 'broken-barcode-milk-1l', NULL, '4.00', '4.00', '1L', '$4.00 / 1L',
             'false', '2026-05-04T10:00:00', 'woolworths.csv');

        CREATE TABLE static_master_coles_products (
            product_id VARCHAR,
            gtin VARCHAR,
            brand_name VARCHAR,
            brand VARCHAR,
            scraped_at TIMESTAMP,
            id BIGINT
        );

        INSERT INTO static_master_coles_products VALUES
            ('coles-100', '9300000000001', 'BrandCo', NULL, TIMESTAMP '2026-05-04 09:00:00', 1);
        """
    )

    conn.execute(
        render_sql_template(
            TRANSFORM_SQL,
            static_master_coles_products_table="static_master_coles_products",
        )
    )

    rows = conn.execute(
        """
        SELECT raw_product_id, gtin, match_gtin, brand_name
        FROM raw_input_normalized
        ORDER BY raw_product_id
        """
    ).fetchall()

    assert rows[0] == ('100', '9300000000001', '9300000000001', 'BrandCo')
    assert rows[1] == ('101', None, None, None)


def test_woolworths_job_rejects_a_zero_positive_offer_load() -> None:
    validator = getattr(woolworths_job, "_validate_positive_offer_count", None)
    assert validator is not None

    with pytest.raises(RuntimeError, match="Woolworths.*zero positive offers"):
        validator(0)

    validator(1)
