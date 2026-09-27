from __future__ import annotations

from typing import TYPE_CHECKING

import duckdb

from features.products.coles import job as coles_job
from features.products.coles.job import _load_input_files

if TYPE_CHECKING:
    from pathlib import Path


def test_coles_loader_unions_schema_drift_by_column_name(tmp_path: Path) -> None:
    first = tmp_path / "coles_products_20260504_a.csv"
    second = tmp_path / "coles_products_20260504_b.csv"
    first.write_text("product_id,name\n1,Milk\n", encoding="utf-8")
    second.write_text("name,product_id,promotion\nBread,2,Special\n", encoding="utf-8")
    connection = duckdb.connect()
    try:
        assert _load_input_files(connection, [str(first), str(second)]) == 2
        assert connection.execute(
            "SELECT product_id, name, promotion FROM raw_input ORDER BY product_id"
        ).fetchall() == [("1", "Milk", None), ("2", "Bread", "Special")]
    finally:
        connection.close()


def test_coles_job_loads_and_normalizes_the_gtin_master_before_product_matching(
    tmp_path: Path,
) -> None:
    master = tmp_path / "Master_Coles_Scrape.csv"
    master.write_text(
        "product_id,name,brand,description,longDescription,size,gtin,"
        "merchandise_category,online_aisle,brand_name,price_now,price_was,"
        "price_comparable,variations_json,images_json,local_image_paths,"
        "image_count,url,timestamp,scrape_status\n"
        "100,Full Cream Milk,BrandCo,Milk,,1L,9300000000001,DAIRY,Milk,"
        "BrandCo,3.50,,,$null,$null,,2,https://example.test/100,"
        "2026-05-04T09:00:00,Full Scrape True\n"
        "101,Broken Product,BrandCo,Broken,,1L,9.3000E+12,DAIRY,Milk,"
        "BrandCo,4.00,,,$null,$null,,0,https://example.test/101,"
        "2026-05-04T09:00:00,Full Scrape True\n",
        encoding="utf-8",
    )
    loader = getattr(coles_job, "_load_static_master_files", None)
    assert loader is not None, "Coles must load its GTIN master before matching"

    connection = duckdb.connect()
    try:
        assert loader(connection, [str(master)]) == 2
        rows = connection.execute(
            """
            SELECT product_id, gtin, brand_name, variations_json, images_json
            FROM static_master_input_normalized
            ORDER BY product_id
            """
        ).fetchall()
        assert rows == [
            ("100", "9300000000001", "BrandCo", "[]", "[]"),
            ("101", None, "BrandCo", "[]", "[]"),
        ]
    finally:
        connection.close()
