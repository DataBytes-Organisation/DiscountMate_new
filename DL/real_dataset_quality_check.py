import pandas as pd

# ======================================================
# DL-04 Dataset Quality & Profiling
# DiscountMate - Price Forecasting
# Author: Vidhi Patel
# ======================================================

# Update with your dataset filename if required
FILE_PATH = "fct_product_pricing_20260802_1900(in).csv"

# ------------------------------------------------------
# Load Dataset
# ------------------------------------------------------

df = pd.read_csv(FILE_PATH)

print("=" * 60)
print("DL-04 DATASET QUALITY REPORT")
print("=" * 60)

print(f"Rows: {len(df):,}")
print(f"Columns: {len(df.columns)}")

print("\nColumns")
print("-" * 60)
print(df.columns.tolist())

# ------------------------------------------------------
# Data Types
# ------------------------------------------------------

print("\n")
print("=" * 60)
print("DATA TYPES")
print("=" * 60)

print(df.dtypes)

# ------------------------------------------------------
# Convert Timestamp
# ------------------------------------------------------

df["recorded_at"] = pd.to_datetime(df["recorded_at"])

# ------------------------------------------------------
# Missing Values
# ------------------------------------------------------

print("\n")
print("=" * 60)
print("MISSING VALUES")
print("=" * 60)

missing = df.isnull().sum()

print(missing)

# ------------------------------------------------------
# Duplicate Checks
# ------------------------------------------------------

print("\n")
print("=" * 60)
print("DUPLICATE CHECKS")
print("=" * 60)

exact_duplicates = df.duplicated().sum()

product_duplicates = df.duplicated(
    subset=[
        "product_id",
        "retailer_id",
        "recorded_at"
    ]
).sum()

print(f"Exact duplicate rows: {exact_duplicates}")
print(f"Duplicate product-retailer-date rows: {product_duplicates}")

# ------------------------------------------------------
# Price Validation
# ------------------------------------------------------

print("\n")
print("=" * 60)
print("PRICE VALIDATION")
print("=" * 60)

print(f"Rows with price <= 0 : {(df['price'] <= 0).sum()}")
print(f"Rows with unit_price <= 0 : {(df['unit_price'] <= 0).sum()}")

# ------------------------------------------------------
# Dataset Summary
# ------------------------------------------------------

print("\n")
print("=" * 60)
print("DATASET SUMMARY")
print("=" * 60)

print(f"Retailers : {df['retailer_id'].nunique()}")
print(f"Products  : {df['product_id'].nunique()}")
print(f"Categories: {df['category_id'].nunique()}")

print(f"Products on Special: {df['is_on_special'].sum()}")

print("\nDate Range")
print(df["recorded_at"].min())
print(df["recorded_at"].max())

# ------------------------------------------------------
# Promotion Information
# ------------------------------------------------------

print("\n")
print("=" * 60)
print("PROMOTION INFORMATION")
print("=" * 60)

print(df["special_text"].value_counts(dropna=False).head(15))

print("\nPromotion Percentage")

promotion_percentage = (
    df["is_on_special"].mean() * 100
)

print(f"{promotion_percentage:.2f}% of products are on special.")

# ------------------------------------------------------
# Missing Unit Price Investigation
# ------------------------------------------------------

print("\n")
print("=" * 60)
print("MISSING UNIT PRICE ANALYSIS")
print("=" * 60)

missing_unit = df[df["unit_price"].isna()]

print(f"Rows with missing unit_price: {len(missing_unit)}")

print("\nMissing unit_price by retailer")

print(
    missing_unit.groupby("retailer_id")
    .size()
)

print("\nSample rows")

print(
    missing_unit[
        [
            "item_name",
            "price",
            "unit_price",
            "retailer_id",
            "recorded_at"
        ]
    ].head(10)
)

# ------------------------------------------------------
# Retailer Distribution
# ------------------------------------------------------

print("\n")
print("=" * 60)
print("RETAILER DISTRIBUTION")
print("=" * 60)

print(df["retailer_id"].value_counts())

# ------------------------------------------------------
# Category Distribution
# ------------------------------------------------------

print("\n")
print("=" * 60)
print("TOP 15 CATEGORIES")
print("=" * 60)

print(
    df["category_id"]
    .value_counts()
    .head(15)
)

# ------------------------------------------------------
# Price Statistics
# ------------------------------------------------------

print("\n")
print("=" * 60)
print("PRICE STATISTICS")
print("=" * 60)

print(df["price"].describe())

print("\nUnit Price Statistics")

print(df["unit_price"].describe())

# ------------------------------------------------------
# Time Series Validation
# ------------------------------------------------------

print("\n")
print("=" * 60)
print("TIME SERIES VALIDATION")
print("=" * 60)

records_per_month = (
    df.assign(month=df["recorded_at"].dt.strftime("%Y-%m"))
      .groupby("month")
      .size()
)

print(records_per_month)

# ------------------------------------------------------
# Product History Length
# ------------------------------------------------------

print("\n")
print("=" * 60)
print("PRODUCT HISTORY")
print("=" * 60)

history = (
    df.groupby("product_id")
      .size()
)

print(history.describe())

# ------------------------------------------------------
# Finish
# ------------------------------------------------------

print("\n")
print("=" * 60)
print("DATASET PROFILING COMPLETED SUCCESSFULLY")
print("=" * 60)