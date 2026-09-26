import pandas as pd


# Experimental mapping for the Aldi Silver Layer sample.
# Replace with silver.dim_categories lookup when database access is available.
ALDI_CATEGORY_UUID_MAP = {
    "7dbede88-eafa-4f6d-8549-01d5433d38af": "ALCOHOL",
    "f3cb7e6c-23f2-42ad-b7c0-cdc29d8bd4d3": "FRUIT, VEG & PRODUCE",
    "94e9a96c-c9a2-4f7b-a688-c166e6a3cb2b": "PANTRY",
    "624ac99f-6b92-410c-b875-7f9a233abf72": "FROZEN FOODS",
    "98a328e1-c26f-4287-bc3f-c7c888144185": "BABY FOOD & ACCESSORIES",
    "de7fc3c8-5a8d-4df9-b4b8-d145e4cab6d7": "SNACKS & CONFECTIONARY",
}


# Convert current canonical categories to the broader V1 TVP categories.
TVP_MAIN_CATEGORY_MAP = {
    "ALCOHOL": "Liquor",
    "FRUIT, VEG & PRODUCE": "Fresh Food",
    "PANTRY": "Pantry",
    "FROZEN FOODS": "Frozen",
    "BABY FOOD & ACCESSORIES": "Baby",
    "SNACKS & CONFECTIONARY": "Snacks & Confectionery",
}


def add_aldi_categories(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()

    result["category_name"] = (
        result["category_id"].map(ALDI_CATEGORY_UUID_MAP)
    )

    result["main_category"] = (
        result["category_name"].map(TVP_MAIN_CATEGORY_MAP)
    )

    return result