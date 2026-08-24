import pandas as pd


def load_coles(path: str):
    return pd.read_csv(path)


def load_woolworths(path: str):
    return pd.read_csv(path)


def load_iga(path: str):
    return pd.read_csv(path)


def load_aldi(path: str):
    df = pd.read_csv(path)

    # Keep only Aldi rows from the shared Silver Layer dataset
    aldi_df = df[
        df["retailer_id"] == "c4275d24-3945-4825-8399-e5a87e86557e"
    ].copy()

    return aldi_df