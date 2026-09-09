from __future__ import annotations

import importlib.util
from pathlib import Path


def test_comparison_group_migration_is_non_destructive_and_versioned() -> None:
    path = Path(__file__).parents[1] / "migrations/versions/20260822_0005_comparison_product_groups.py"
    assert path.exists()
    text = path.read_text(encoding="utf-8")

    assert 'down_revision = "20260821_0004"' in text
    for table in (
        "comparison_product_groups",
        "comparison_product_members",
        "comparison_match_review_queue",
        "comparison_store_brands",
        "etl_run_audit",
    ):
        assert table in text
    assert "refresh_comparison_product_groups" in text
    assert "similarity(" in text
    assert "0.90" in text or "0.9" in text
    assert "match_method = 'gtin'" in text
    assert "left_product.gtin = right_product.gtin" in text
    assert "DELETE FROM silver.dim_products" not in text
    assert "UPDATE silver.dim_products" not in text


def test_migration_revision_metadata_imports_without_running_sql() -> None:
    path = Path(__file__).parents[1] / "migrations/versions/20260822_0005_comparison_product_groups.py"
    spec = importlib.util.spec_from_file_location("comparison_groups_migration", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    assert module.revision == "20260822_0005"
    assert module.down_revision == "20260821_0004"


def test_follow_up_grouping_migration_repeats_safe_merge_passes_until_stable() -> None:
    path = (
        Path(__file__).parents[1]
        / "migrations/versions/20260823_0006_convergent_comparison_grouping.py"
    )
    assert path.exists()
    text = path.read_text(encoding="utf-8")

    assert 'down_revision = "20260822_0005"' in text
    assert "refresh_comparison_product_groups_pass" in text
    assert "LOOP" in text
    assert "merged_group_count" in text
    assert "EXIT WHEN" in text


def test_retailer_scoped_identity_migration_follows_grouping_revision() -> None:
    path = (
        Path(__file__).parents[1]
        / "migrations/versions/20260824_0007_retailer_scoped_product_identity.py"
    )
    spec = importlib.util.spec_from_file_location("retailer_scoped_identity", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)

    assert module.revision == "20260824_0007"
    assert module.down_revision == "20260823_0006"


def test_bounded_group_refresh_migration_is_latest_revision() -> None:
    path = (
        Path(__file__).parents[1]
        / "migrations/versions/20260825_0008_bound_group_refresh.py"
    )
    spec = importlib.util.spec_from_file_location("bounded_group_refresh", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)

    assert module.revision == "20260825_0008"
    assert module.down_revision == "20260824_0007"
