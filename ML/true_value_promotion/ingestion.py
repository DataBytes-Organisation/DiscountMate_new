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

    return aldi_df


def load_all_retailers(
    coles_path: str,
    woolworths_path: str,
    iga_path: str
):
    coles_df = load_coles(coles_path)
    woolworths_df = load_woolworths(woolworths_path)
    iga_df = load_iga(iga_path)

    return coles_df, woolworths_df, iga_df