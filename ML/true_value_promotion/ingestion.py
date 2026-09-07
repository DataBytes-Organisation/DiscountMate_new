import pandas as pd


def load_coles(path: str):
    return pd.read_csv(path)


def load_woolworths(path: str):
    return pd.read_csv(path)


def load_iga(path: str):
    return pd.read_csv(path)


def load_aldi(path: str):
    """Load Aldi records from the Silver Layer pricing dataset."""
    df = pd.read_csv(path)

    aldi_df = df[
        df["retailer_id"] == "c4275d24-3945-4825-8399-e5a87e86557e"
    ].copy()

    validate_aldi_data(aldi_df)

    return aldi_df
def validate_aldi_data(df):
    """Validate Aldi Silver Layer data before TVP processing."""

    required_columns = [
        "product_id",
        "retailer_id",
        "item_name",
        "price",
        "category_id",
    ]

    missing_columns = [
        column for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Aldi data missing required columns: {missing_columns}"
        )

    if df.empty:
        raise ValueError("No Aldi records found.")

    if df["product_id"].isna().all():
        raise ValueError("Aldi product_id contains no usable values.")

    if df["price"].isna().all():
        raise ValueError("Aldi current_price contains no usable values.")

    return True

def load_all_retailers(
    coles_path: str,
    woolworths_path: str,
    iga_path: str
):
    coles_df = load_coles(coles_path)
    woolworths_df = load_woolworths(woolworths_path)
    iga_df = load_iga(iga_path)

    return coles_df, woolworths_df, iga_df