import pandas as pd
from ML.true_value_promotion.pipeline import run_pipeline
from ML.true_value_promotion.harmonisation import UNIFIED_COLUMNS


def test_harmonisation_schema():
    """
    Test 1 — Unified schema correctness

    Ensures that:
    - All harmonised dataframes contain the unified schema
    - No extra columns appear
    - No required columns are missing

    This matches Sharon’s notebook requirement:
    “All retailers must expose the same harmonised columns.”
    """

    outputs = run_pipeline()

    coles_h = outputs["coles_harmonised"]
    wool_h = outputs["wool_harmonised"]
    iga_h = outputs["iga_harmonised"]
    combined = outputs["combined_harmonised"]

    for df in [coles_h, wool_h, iga_h, combined]:
        assert list(df.columns) == UNIFIED_COLUMNS, \
            f"Schema mismatch in dataframe: {df.columns}"


def test_retailer_column_values():
    """
    Test 2 — Retailer correctness

    Ensures:
    - Coles rows have retailer='coles'
    - Woolworths rows have retailer='woolworths'
    - IGA rows have retailer='iga'

    This matches Sharon’s notebook:
    “Retailer identity must be preserved through harmonisation.”
    """

    outputs = run_pipeline()

    coles_h = outputs["coles_harmonised"]
    wool_h = outputs["wool_harmonised"]
    iga_h = outputs["iga_harmonised"]

    assert (coles_h["retailer"] == "coles").all()
    assert (wool_h["retailer"] == "woolworths").all()
    assert (iga_h["retailer"] == "iga").all()


def test_product_id_not_null():
    """
    Test 3 — Product ID must exist

    Ensures:
    - No harmonised dataframe has missing product_id values

    Sharon’s notebook:
    “Product ID is mandatory for scoring and promotion detection.”
    """

    outputs = run_pipeline()

    for key in ["coles_harmonised", "wool_harmonised", "iga_harmonised"]:
        df = outputs[key]
        assert df["product_id"].notna().all(), f"Missing product_id in {key}"


def test_price_columns_numeric():
    """
    Test 4 — Price columns must be numeric

    Ensures:
    - price_now and price_was are numeric for all retailers

    This matches Sharon’s notebook:
    “Price fields must be numeric before scoring.”
    """

    outputs = run_pipeline()

    for key in ["coles_harmonised", "wool_harmonised", "iga_harmonised"]:
        df = outputs[key]
        assert pd.api.types.is_numeric_dtype(df["price_now"])
        assert pd.api.types.is_numeric_dtype(df["price_was"])


def test_combined_retailer_distribution():
    """
    Test 5 — Combined harmonised dataset contains all retailers

    Ensures:
    - combined_harmonised contains rows from all three retailers

    This matches Sharon’s notebook:
    “Unified dataset must contain all retailers before scoring.”
    """

    outputs = run_pipeline()
    combined = outputs["combined_harmonised"]

    retailers = set(combined["retailer"].unique())

    assert "coles" in retailers
    assert "woolworths" in retailers
    assert "iga" in retailers


def test_expected_nans_are_allowed():
    """
    Test 6 — Expected NaNs are allowed

    Sharon’s notebook explicitly shows NaNs for:
    - Woolworths size_value / size_unit
    - Woolworths category
    - IGA missing fields
    - Coles missing fields in rare cases

    This test ensures NaNs exist ONLY in fields where they are expected.
    """

    outputs = run_pipeline()

    wool = outputs["wool_harmonised"]

    # Woolworths does NOT have size fields → NaN expected
    assert wool["size_value"].isna().any()
    assert wool["size_unit"].isna().any()

    # Woolworths category is empty string → no NaN expected
    assert not wool["category"].isna().any()

    # Coles should NOT have NaNs in core fields
    coles = outputs["coles_harmonised"]
    assert coles["name"].notna().all()
    assert coles["brand"].notna().all()
    assert coles["price_now"].notna().all()


def test_no_duplicate_rows():
    """
    Test 7 — No duplicate rows in harmonised output

    Sharon’s notebook ensures:
    “Unified dataset must not contain duplicate rows.”

    This test checks that combined_harmonised has no duplicates.
    """

    outputs = run_pipeline()
    combined = outputs["combined_harmonised"]

    assert combined.duplicated().sum() == 0, "Duplicate rows found in harmonised dataset"
