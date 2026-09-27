"""
Harmonisation module for True Value Promotion (TVP).

Goal:
    Convert cleaned retailer-specific dataframes (Coles, Woolworths, IGA)
    into a single unified schema so scoring and promotion logic can operate
    consistently across all retailers.

This follows Sharon's notebook:
    - Standardise column names
    - Standardise key fields (product id, name, brand, category, size, price)
    - Drop retailer-specific metadata
    - Produce a harmonised dataframe with a common set of columns
"""

import pandas as pd
from typing import Tuple

# -------------------------------------------------------------------
# Unified schema (matches notebook scoring requirements)
# -------------------------------------------------------------------
UNIFIED_COLUMNS = [
    "retailer",
    "product_id",
    "name",
    "brand",
    "category",
    "size_value",
    "size_unit",
    "price_now",
    "price_was",
    "unit_price",
    "timestamp",
    "image_url",
    "promotiontype",
]


# -------------------------------------------------------------------
# Harmonise Coles
# -------------------------------------------------------------------
def harmonise_coles(coles_df: pd.DataFrame) -> pd.DataFrame:
    """
    Harmonise cleaned Coles dataframe into unified schema.
    """

    harmonised = pd.DataFrame()

    # Retailer
    # harmonised["retailer"] = "coles"
    harmonised["retailer"] = ["coles"] * len(coles_df)
    harmonised["retailer"] = harmonised["retailer"].astype(str)

    # Product ID
    harmonised["product_id"] = coles_df["productid"]

    # Name
    harmonised["name"] = coles_df["name"]

    # Brand
    harmonised["brand"] = coles_df["brand"]

    # Category
    harmonised["category"] = coles_df["category"]

    # Size fields
    harmonised["size_value"] = coles_df["size_value"]
    harmonised["size_unit"] = coles_df["size_unit"]

    # Price fields
    harmonised["price_now"] = coles_df["price_now"]
    harmonised["price_was"] = coles_df["price_was"]

    # Unit price
    harmonised["unit_price"] = coles_df["unitprice"]

    # Timestamp
    harmonised["timestamp"] = coles_df["timestamp"]

    # Image URL
    harmonised["image_url"] = coles_df["imageuri"]

    # Promotion type
    harmonised["promotiontype"] = ""

    return harmonised[UNIFIED_COLUMNS]


# -------------------------------------------------------------------
# Harmonise Woolworths
# -------------------------------------------------------------------
def harmonise_woolworths(wool_df: pd.DataFrame) -> pd.DataFrame:
    """
    Harmonise cleaned Woolworths dataframe into unified schema.
    """

    harmonised = pd.DataFrame()

    # Retailer
    # harmonised["retailer"] = "woolworths"
    harmonised["retailer"] = ["woolworths"] * len(wool_df)
    harmonised["retailer"] = harmonised["retailer"].astype(str)

    # Product ID
    harmonised["product_id"] = wool_df["stockcode"]

    # Name
    harmonised["name"] = wool_df["name"]

    # Brand (best-effort mapping)
    harmonised["brand"] = wool_df["displayname"]

    # Category (Woolworths category fields removed during cleaning)
    harmonised["category"] = ""

    # Size fields (not parsed yet)
    harmonised["size_value"] = pd.NA
    harmonised["size_unit"] = pd.NA

    # Price fields
    harmonised["price_now"] = wool_df["price_now"]
    harmonised["price_was"] = wool_df["price_was"]

    # Unit price (cupprice)
    harmonised["unit_price"] = wool_df["cupprice"]

    # Timestamp
    harmonised["timestamp"] = wool_df["timestamp"]

    # Image URL
    harmonised["image_url"] = wool_df["mediumimagefile"]

    # Promotion type
    harmonised["promotiontype"] = wool_df.get("promotiontype", "").fillna("").astype(str)

    return harmonised[UNIFIED_COLUMNS]


# -------------------------------------------------------------------
# Harmonise IGA
# -------------------------------------------------------------------
def harmonise_iga(iga_df: pd.DataFrame) -> pd.DataFrame:
    """
    Harmonise cleaned IGA dataframe into unified schema.
    """

    harmonised = pd.DataFrame()

    # Retailer
    # harmonised["retailer"] = "iga"
    harmonised["retailer"] = ["iga"] * len(iga_df)
    harmonised["retailer"] = harmonised["retailer"].astype(str)

    # Product ID
    harmonised["product_id"] = iga_df["iga_product_id"]

    # Name
    harmonised["name"] = iga_df["iga_name"]

    # Brand
    harmonised["brand"] = iga_df["iga_brand"]

    # Category (flattened during cleaning)
    harmonised["category"] = iga_df["category"]

    # Size fields (best-effort mapping)
    harmonised["size_value"] = iga_df["iga_unit_of_size_size"]
    harmonised["size_unit"] = iga_df["iga_unit_of_size_abbreviation"]

    # Price fields
    harmonised["price_now"] = iga_df["price_now"]
    harmonised["price_was"] = iga_df["price_was"]

    # Unit price
    harmonised["unit_price"] = iga_df["iga_price_per_unit"]

    # Timestamp
    harmonised["timestamp"] = iga_df["scraped_at"]

    # Image URL
    harmonised["image_url"] = iga_df["primary_image_url"]

    # Promotion type
    harmonised["promotiontype"] = ""

    return harmonised[UNIFIED_COLUMNS]


# -------------------------------------------------------------------
# Harmonise all retailers together
# -------------------------------------------------------------------
def harmonise_all(
    coles_df: pd.DataFrame,
    wool_df: pd.DataFrame,
    iga_df: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Harmonise all retailers and return:
        - harmonised_coles
        - harmonised_woolworths
        - harmonised_iga
        - combined_harmonised
    """

    harmonised_coles = harmonise_coles(coles_df)
    harmonised_wool = harmonise_woolworths(wool_df)
    harmonised_iga = harmonise_iga(iga_df)

    # Concatenate safely
    combined = pd.concat(
        [harmonised_coles, harmonised_wool, harmonised_iga],
        ignore_index=True,
        sort=False
    )

    # Ensure retailer dtype stays string (fixes NaN issue)
    combined["retailer"] = combined["retailer"].astype(str)

    return harmonised_coles, harmonised_wool, harmonised_iga, combined
