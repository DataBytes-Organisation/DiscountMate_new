"""
CLEANING MODULE — TRUE VALUE PROMOTION (TVP)
--------------------------------------------

This file refactors the "Cleaning" section of Sharon’s True Value Promotion
development notebook into clean, reusable Python functions.

The notebook shows that retailer datasets (Coles, Woolworths, IGA) contain:
- inconsistent column names
- messy text fields
- inconsistent size formats (250g, 3L, 1Kg, 1 Each…)
- inconsistent price fields (Price_Now, WasPrice, iga_price_numeric…)
- missing values
- retailer-specific noise columns
- category fields that differ across retailers
- mixed data types (IGA warning)

This module converts all of that into a clean, unified format that prepares
the data for harmonisation and scoring.

Each section below corresponds directly to the notebook’s cleaning logic.
"""

import re
import pandas as pd


# ------------------------------------------------------------
# 1. STANDARDISE COLUMN NAMES
# ------------------------------------------------------------
"""
Notebook evidence:
Columns appear with leading/trailing spaces, mixed casing, and inconsistent
separators. Examples from the PDF:

- ' Price_Was'
- ' SaveStatement '
- 'SapCategoryName '
- 'iga_weight_increment '

fix this by:
- stripping whitespace
- converting to lowercase
- replacing spaces and hyphens with underscores

This makes harmonisation MUCH easier later.
"""

def standardise_column_names(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = (
        df.columns
        .str.strip()
        .str.replace(" ", "_")
        .str.replace("-", "_")
        .str.lower()
    )
    return df



# ------------------------------------------------------------
# 2. DROP IRRELEVANT / NOISE COLUMNS
# ------------------------------------------------------------
"""
Notebook evidence:
Many columns are retailer-specific metadata that do NOT contribute to TVP
scoring or harmonisation. Examples:

- onlineaisle
- onlinesubcategory
- sapdepartmentname
- sapcategoryname
- sapsubcategoryname
- iga_image_zoom
- raw_json
- productwarningmessage
- productrestrictionmessage

drop these to simplify the dataset.
"""

def drop_irrelevant_columns(df: pd.DataFrame) -> pd.DataFrame:
    drop_cols = [
        "onlineaisle", "onlinesubcategory",
        "sapdepartmentname", "sapcategoryname", "sapsubcategoryname",
        "iga_image_zoom", "iga_shopping_rule_messages",
        "raw_json", "productwarningmessage", "productrestrictionmessage"
    ]
    df = df.drop(columns=[c for c in drop_cols if c in df.columns], errors="ignore")
    return df



# ------------------------------------------------------------
# 3. FILL MISSING VALUES
# ------------------------------------------------------------
"""
Notebook evidence:
Large portions of retailer data contain NaN values:

- SaveStatement: 3943 non-null out of 16947
- PackageSize: 24826 non-null out of 31122
- iga_description: 12023 non-null out of 20445

fill:
- object/text columns → empty string ""
- numeric columns → 0

This prevents errors in harmonisation and scoring.
"""

def fill_missing_values(df: pd.DataFrame) -> pd.DataFrame:
    df = df.fillna({
        col: "" for col in df.select_dtypes(include="object").columns
    })
    df = df.fillna({
        col: 0 for col in df.select_dtypes(include=["float64", "int64"]).columns
    })
    return df



# ------------------------------------------------------------
# 4. CLEAN SIZE COLUMN
# ------------------------------------------------------------
"""
Notebook evidence:
Sizes appear in inconsistent formats:

- "250g"
- "3L"
- "1Kg"
- "1 Each"
- "224 Pack"

extract:
- numeric value → size_value
- unit → size_unit

This is essential for later unit-price fairness scoring.
"""

def parse_size(size):
    if not isinstance(size, str):
        return None, None
    match = re.match(r"(\d+\.?\d*)\s*([a-zA-Z]+)", size)
    if match:
        value, unit = match.groups()
        return float(value), unit.lower()
    return None, None


def clean_size_column(df: pd.DataFrame) -> pd.DataFrame:
    if "size" not in df.columns:
        return df

    df["size_value"], df["size_unit"] = zip(*df["size"].apply(parse_size))
    return df



# ------------------------------------------------------------
# 5. CLEAN PRICE COLUMNS
# ------------------------------------------------------------
"""
Notebook evidence:
Different retailers use different price fields:

Coles:
- price_now
- price_was

Woolworths:
- price
- wasprice

IGA:
- iga_price_numeric
- iga_was_price_numeric

unify these into:
- price_now
- price_was

And convert them to numeric.
"""

def clean_price_columns(df: pd.DataFrame, retailer: str) -> pd.DataFrame:

    if retailer == "coles":
        df.rename(columns={
            "price_now": "price_now",
            "price_was": "price_was"
        }, inplace=True)

    if retailer == "woolworths":
        df.rename(columns={
            "price": "price_now",
            "wasprice": "price_was"
        }, inplace=True)

    if retailer == "iga":
        df.rename(columns={
            "iga_price_numeric": "price_now",
            "iga_was_price_numeric": "price_was"
        }, inplace=True)

    df["price_now"] = pd.to_numeric(df.get("price_now", 0), errors="coerce").fillna(0)
    df["price_was"] = pd.to_numeric(df.get("price_was", 0), errors="coerce").fillna(0)

    return df



# ------------------------------------------------------------
# 6. CLEAN TEXT FIELDS
# ------------------------------------------------------------
"""
Notebook evidence:
Descriptions contain repeated punctuation and inconsistent formatting:

Examples:
- "STRAWBERRIES : BERRIES : . : 250 GRAM"
- "LETTUCE ICEBERG: : . : 1 EACH"

remove:
- colons
- repeated whitespace
- stray punctuation
"""

def clean_text_fields(df: pd.DataFrame) -> pd.DataFrame:
    text_cols = ["description", "name", "brand"]

    for col in text_cols:
        if col in df.columns:
            df[col] = (
                df[col]
                .str.replace(":", " ", regex=False)
                .str.replace(r"\s+", " ", regex=True)
                .str.strip()
            )
    return df



# ------------------------------------------------------------
# 7. CLEAN CATEGORY FIELDS
# ------------------------------------------------------------
"""
Notebook evidence:
Retailers use different category structures:

Coles:
- category
- subcategory

Woolworths:
- sapcategoryname
- sapsubcategoryname

IGA:
- iga_default_category → JSON list

unify these into:
- category
- subcategory
"""

def clean_category_fields(df: pd.DataFrame, retailer: str) -> pd.DataFrame:

    if retailer == "coles":
        return df

    if retailer == "woolworths":
        df.rename(columns={
            "sapcategoryname": "category",
            "sapsubcategoryname": "subcategory"
        }, inplace=True)
        return df

    if retailer == "iga":
        if "iga_default_category" in df.columns:
            df["category"] = df["iga_default_category"].apply(
                lambda x: x[0]["category"] if isinstance(x, list) and len(x) else ""
            )
        return df

    return df



# ------------------------------------------------------------
# 8. MASTER CLEANING FUNCTION
# ------------------------------------------------------------
"""
This function is called by the pipeline.

It applies ALL cleaning steps in the correct order:
1. standardise column names
2. drop irrelevant columns
3. fill missing values
4. clean size column
5. clean price columns
6. clean text fields
7. clean category fields

This produces a clean, unified dataset ready for harmonisation.
"""

def clean_all(df: pd.DataFrame, retailer: str) -> pd.DataFrame:
    df = standardise_column_names(df)
    df["retailer"] = retailer
    df = drop_irrelevant_columns(df)
    df = fill_missing_values(df)
    df = clean_size_column(df)
    df = clean_price_columns(df, retailer)
    df = clean_text_fields(df)
    df = clean_category_fields(df, retailer)
    return df
