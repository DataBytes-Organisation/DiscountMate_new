import pandas as pd
from ML.true_value_promotion.ingestion import load_coles, load_woolworths, load_iga
from ML.true_value_promotion.cleaning import clean_all


# ------------------------------------------------------------
# Helper: load + clean datasets
# ------------------------------------------------------------
def get_cleaned_data():
    coles = clean_all(load_coles(), "coles")
    wool = clean_all(load_woolworths(), "woolworths")
    iga = clean_all(load_iga(), "iga")
    return coles, wool, iga


# ------------------------------------------------------------
# 1. Column name tests
# ------------------------------------------------------------
def test_column_names_are_clean():
    coles, wool, iga = get_cleaned_data()

    # All lowercase
    assert all(col.islower() for col in coles.columns)
    assert all(col.islower() for col in wool.columns)
    assert all(col.islower() for col in iga.columns)

    # No spaces
    assert all(" " not in col for col in coles.columns)
    assert all(" " not in col for col in wool.columns)
    assert all(" " not in col for col in iga.columns)


# ------------------------------------------------------------
# 2. Column count tests (matches notebook expectations)
# ------------------------------------------------------------
def test_column_counts():
    coles, wool, iga = get_cleaned_data()

    assert len(coles.columns) == 38
    assert len(wool.columns) == 49
    assert len(iga.columns) == 70


# ------------------------------------------------------------
# 3. Missing value tests
# ------------------------------------------------------------
def test_missing_values_reasonable():
    coles, wool, iga = get_cleaned_data()

    # Coles has optional fields → some NaNs expected
    assert coles.isna().sum().sum() < 500

    # Woolworths should have almost no missing values
    assert wool.isna().sum().sum() == 0

    # IGA should have almost no missing values
    assert iga.isna().sum().sum() == 0


# ------------------------------------------------------------
# 4. Size parsing tests
# ------------------------------------------------------------
def test_size_parsing():
    coles, _, _ = get_cleaned_data()

    assert "size_value" in coles.columns
    assert "size_unit" in coles.columns

    # Check at least one parsed value is numeric
    assert pd.api.types.is_numeric_dtype(coles["size_value"])

    # Units should be strings
    assert coles["size_unit"].dtype == object


# ------------------------------------------------------------
# 5. Price parsing tests
# ------------------------------------------------------------
def test_price_columns_numeric():
    coles, wool, iga = get_cleaned_data()

    for df in [coles, wool, iga]:
        assert pd.api.types.is_numeric_dtype(df["price_now"])
        assert pd.api.types.is_numeric_dtype(df["price_was"])


# ------------------------------------------------------------
# 6. Category flattening tests (IGA)
# ------------------------------------------------------------
def test_iga_category_flattened():
    _, _, iga = get_cleaned_data()

    assert "category" in iga.columns

    # Category should be a string column
    assert iga["category"].dtype == object

    # Some categories may be empty, but column must exist
    assert len(iga["category"]) > 0
