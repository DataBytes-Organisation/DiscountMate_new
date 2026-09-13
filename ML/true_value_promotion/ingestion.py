# import pandas as pd

# def load_coles(path: str):
#     return pd.read_csv(path)

# def load_woolworths(path: str):
#     return pd.read_csv(path)

# def load_iga(path: str):
#     return pd.read_csv(path)

# def load_all_retailers(coles_path: str, woolworths_path: str, iga_path: str):
#     coles_df = load_coles(coles_path)
#     woolworths_df = load_woolworths(woolworths_path)
#     iga_df = load_iga(iga_path)
#     return coles_df, woolworths_df, iga_df

import pandas as pd
import os

# Determine the directory of this file (ingestion.py)
BASE_DIR = os.path.dirname(__file__)

# Build the path to the data folder inside true_value_promotion
DATA_DIR = os.path.join(BASE_DIR, "data")

def load_coles():
    """Load the Coles CSV file from the data directory."""
    path = os.path.join(DATA_DIR, "coles_brands_20260504_053141.csv")
    return pd.read_csv(path)

def load_woolworths():
    """Load the Woolworths CSV file from the data directory."""
    path = os.path.join(DATA_DIR, "woolworths_brands_20260504_074111.csv")
    return pd.read_csv(path)

def load_iga():
    """Load the IGA CSV file from the data directory."""
    path = os.path.join(DATA_DIR, "iga_all_products_20260504_053210.csv")
    return pd.read_csv(path)

def load_all_retailers():
    """Load all three retailer datasets at once."""
    coles_df = load_coles()
    woolworths_df = load_woolworths()
    iga_df = load_iga()
    return coles_df, woolworths_df, iga_df
