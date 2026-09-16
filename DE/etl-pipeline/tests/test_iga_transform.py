from __future__ import annotations

import csv
import unittest
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory

import duckdb

from common.duckdb_utils import render_sql_template
from features.products.iga.job import _load_input_files, _workflow_sql_context

TRANSFORM_SQL = (
    Path(__file__).parents[1]
    / "features"
    / "products"
    / "iga"
    / "workflow_sql"
    / "transform.sql"
).read_text(encoding="utf-8")
SYNC_DIM_PRODUCTS_SQL = (
    Path(__file__).parents[1]
    / "features"
    / "products"
    / "iga"
    / "workflow_sql"
    / "sync_dim_products.sql"
)


def load_raw_input(
    connection: duckdb.DuckDBPyConnection,
    row: dict[str, str],
) -> None:
    with TemporaryDirectory() as directory:
        input_path = Path(directory) / "iga_sample_20260504.csv"
        with input_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(row))
            writer.writeheader()
            writer.writerow(row)
        _load_input_files(connection, [str(input_path)])


def create_canonical_raw_input(connection: duckdb.DuckDBPyConnection) -> None:
    load_raw_input(
        connection,
        {
            "iga_product_id": "iga-123",
            "sku": "sku-123",
            "iga_sku": "iga-sku-123",
            "barcode": "9300657174101",
            "iga_barcode": "9300657174101",
            "name": "Cottee's Instant Vanilla Pudding",
            "iga_name": "Cottee's Instant Vanilla Pudding",
            "brand_name": "Cottee's",
            "iga_brand": "Cottee's",
            "primary_image_url": "https://example.test/pudding.jpg",
            "iga_image_default": "",
            "iga_image_cell": "",
            "iga_image_details": "",
            "iga_image_zoom": "",
            "iga_categories": '[{"category":"Pantry"},{"category":"Pantry"}]',
            "iga_default_category": '[{"category":"Desserts"}]',
            "price_label": "Regular price",
            "iga_price_label": "",
            "price_source": "regular",
            "iga_price_source": "",
            "price_numeric": "1.80",
            "iga_price_numeric": "",
            "price_per_unit": "$1.80 per 100g",
            "iga_price_per_unit": "",
            "iga_unit_of_size_size": "100",
            "iga_unit_of_measure_size": "",
            "iga_unit_of_size_type": "gram",
            "iga_unit_of_measure_type": "",
            "scraped_at": "2026-05-04T16:00:00",
        },
    )


def create_legacy_raw_input(connection: duckdb.DuckDBPyConnection) -> None:
    load_raw_input(
        connection,
        {
            "IGA_ProductID": "iga-123",
            "sku": "",
            "iga_sku": "",
            "barcode": "9300657174101",
            "iga_barcode": "",
            "name": "Cottee's Instant Vanilla Pudding",
            "iga_name": "",
            "BrandName": "Cottee's",
            "iga_brand": "",
            "PrimaryImageUrl": "https://example.test/pudding.jpg",
            "iga_image_default": "",
            "iga_image_cell": "",
            "iga_image_details": "",
            "iga_image_zoom": "",
            "iga_categories": '[{"category":"Pantry"},{"category":"Unknown"}]',
            "IGA_DefaultCategory": '[{"category":"Snacks"}]',
            "PriceLabel": "On special",
            "iga_price_label": "",
            "PriceSource": "tpr",
            "iga_price_source": "",
            "PriceNumeric": "1.80",
            "iga_price_numeric": "",
            "PricePerUnit": "$1.80 per 100g",
            "iga_price_per_unit": "",
            "IGA_UnitOfSize_Size": "100",
            "iga_unit_of_measure_size": "",
            "IGA_UnitOfSize_Type": "gram",
            "iga_unit_of_measure_type": "",
            "ScrapedAt": "2026-05-04T16:00:00",
        },
    )


class IgaTransformTest(unittest.TestCase):
    def test_transform_accepts_canonical_snake_case_scrape_columns(self) -> None:
        connection = duckdb.connect()
        self.addCleanup(connection.close)
        create_canonical_raw_input(connection)

        try:
            connection.execute(TRANSFORM_SQL)
        except duckdb.Error as error:
            self.fail(f"canonical IGA scrape columns must bind successfully: {error}")

        row = connection.execute(
            """
            SELECT raw_product_id, item_name, brand_name, price, pack_quantity, pack_uom
            FROM raw_input_normalized
            """
        ).fetchone()
        self.assertEqual(
            row,
            (
                "iga-123",
                "Cottee's Instant Vanilla Pudding",
                "Cottee's",
                1.8,
                100.0,
                "g",
            ),
        )

    def test_transform_accepts_legacy_no_underscore_scrape_columns(self) -> None:
        connection = duckdb.connect()
        self.addCleanup(connection.close)
        create_legacy_raw_input(connection)

        connection.execute(TRANSFORM_SQL)

        row = connection.execute(
            """
            SELECT
                raw_product_id,
                brand_name,
                image_link_side,
                category_name,
                special_text,
                product_url,
                price,
                unit_price,
                recorded_at,
                is_on_special,
                pack_quantity,
                pack_uom
            FROM raw_input_normalized
            """
        ).fetchone()
        self.assertEqual(
            row,
            (
                "iga-123",
                "Cottee's",
                "https://example.test/pudding.jpg",
                "SNACKS & CONFECTIONARY",
                "On special",
                "https://www.igashop.com.au/product/iga-123",
                1.8,
                0.018,
                datetime(2026, 5, 4, 16, 0),
                True,
                100.0,
                "g",
            ),
        )

    def test_exact_gtin_match_wins_over_weaker_canonical_match(self) -> None:
        connection = duckdb.connect()
        self.addCleanup(connection.close)
        create_canonical_raw_input(connection)
        connection.execute(TRANSFORM_SQL)
        connection.execute(
            """
            CREATE TABLE dim_retailers (id UUID PRIMARY KEY, retailer_name VARCHAR);
            INSERT INTO dim_retailers VALUES
                ('10000000-0000-4000-8000-000000000001', 'iga');

            CREATE TABLE dim_categories (id UUID PRIMARY KEY, category_name VARCHAR);
            INSERT INTO dim_categories VALUES
                ('20000000-0000-4000-8000-000000000001', 'PANTRY');

            CREATE TABLE dim_products (
                id UUID PRIMARY KEY,
                category_id UUID,
                product_name VARCHAR,
                brand_name VARCHAR,
                gtin VARCHAR,
                pack_quantity DECIMAL(10, 3),
                pack_uom VARCHAR,
                price_current_iga DECIMAL(10, 2),
                price_last_iga DECIMAL(10, 2),
                unit_price_current_iga DECIMAL(12, 4),
                unit_price_last_iga DECIMAL(12, 4),
                image_link_side VARCHAR,
                image_link_back VARCHAR,
                created_at TIMESTAMPTZ,
                updated_at TIMESTAMPTZ
            );
            CREATE UNIQUE INDEX uq_test_dim_products_gtin ON dim_products (gtin);
            CREATE UNIQUE INDEX uq_test_dim_products_canonical_key ON dim_products (
                COALESCE(lower(brand_name), ''),
                lower(product_name),
                COALESCE(pack_quantity, -1),
                COALESCE(lower(pack_uom), '')
            );
            INSERT INTO dim_products (
                id, category_id, product_name, brand_name, gtin,
                pack_quantity, pack_uom, created_at, updated_at
            ) VALUES
                (
                    '30000000-0000-4000-8000-000000000001',
                    '20000000-0000-4000-8000-000000000001',
                    'Cottee''s Instant Vanilla Pudding 100g', '', '9300657174101',
                    100, 'g', current_timestamp, current_timestamp
                ),
                (
                    '30000000-0000-4000-8000-000000000002',
                    '20000000-0000-4000-8000-000000000001',
                    'Instant Vanilla Pudding', 'Cottee''s', NULL,
                    100, 'g', current_timestamp, current_timestamp
                );

            CREATE TABLE fct_product_prices (
                product_id UUID,
                category_id UUID,
                retailer_id UUID,
                price DECIMAL(10, 2),
                unit_price DECIMAL(12, 4),
                recorded_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ
            );
            INSERT INTO fct_product_prices (
                product_id, category_id, retailer_id, price, unit_price,
                recorded_at, created_at
            ) VALUES (
                '30000000-0000-4000-8000-000000000001',
                '20000000-0000-4000-8000-000000000001',
                '10000000-0000-4000-8000-000000000001',
                2.00, 0.02, TIMESTAMPTZ '2026-05-01 00:00:00+00', current_timestamp
            );
            """
        )
        context = _workflow_sql_context()
        context.update(
            {
                "dim_retailers_table": "dim_retailers",
                "dim_categories_table": "dim_categories",
                "dim_products_table": "dim_products",
                "fct_product_prices_table": "fct_product_prices",
            }
        )

        try:
            connection.execute(render_sql_template(SYNC_DIM_PRODUCTS_SQL, **context))
        except duckdb.Error as error:
            self.fail(f"exact GTIN identity must not violate the unique GTIN constraint: {error}")

        rows = connection.execute(
            """
            SELECT id::VARCHAR, gtin, price_current_iga
            FROM dim_products
            ORDER BY id
            """
        ).fetchall()
        self.assertEqual(
            rows,
            [
                (
                    "30000000-0000-4000-8000-000000000001",
                    "9300657174101",
                    Decimal("1.80"),
                ),
                ("30000000-0000-4000-8000-000000000002", None, None),
            ],
        )


if __name__ == "__main__":
    unittest.main()
