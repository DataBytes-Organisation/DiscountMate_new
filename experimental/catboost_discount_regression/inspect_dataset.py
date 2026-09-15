from pathlib import Path
import pandas as pd
import numpy as np

DATA_PATH = Path("data/Australia_Grocery_2022Sep.csv")

print("=" * 80)
print("DISCOUNTMATE CATBOOST - DATASET INSPECTION")
print("=" * 80)

# ------------------------------------------------------------------
# 1. Load dataset
# ------------------------------------------------------------------
df = pd.read_csv(DATA_PATH, low_memory=False)

print("\n1. DATASET SIZE")
print("-" * 80)
print(f"Rows:    {len(df):,}")
print(f"Columns: {len(df.columns)}")

# ------------------------------------------------------------------
# 2. Column names and data types
# ------------------------------------------------------------------
print("\n2. COLUMNS AND DATA TYPES")
print("-" * 80)

for column in df.columns:
    print(f"{column:<30} {str(df[column].dtype):<15}")

# ------------------------------------------------------------------
# 3. First records
# ------------------------------------------------------------------
print("\n3. FIRST 5 ROWS")
print("-" * 80)
print(df.head().to_string())

# ------------------------------------------------------------------
# 4. Missing values
# ------------------------------------------------------------------
print("\n4. MISSING VALUES")
print("-" * 80)

missing = pd.DataFrame({
    "missing_count": df.isna().sum(),
    "missing_percent": (df.isna().mean() * 100).round(2)
})

missing = missing.sort_values("missing_count", ascending=False)

print(missing.to_string())

# ------------------------------------------------------------------
# 5. Unique values
# ------------------------------------------------------------------
print("\n5. UNIQUE VALUE COUNTS")
print("-" * 80)

unique_counts = df.nunique(dropna=False).sort_values()

print(unique_counts.to_string())

# ------------------------------------------------------------------
# 6. Duplicate rows
# ------------------------------------------------------------------
print("\n6. DUPLICATES")
print("-" * 80)

print(f"Exact duplicate rows: {df.duplicated().sum():,}")

# ------------------------------------------------------------------
# 7. Important DiscountMate fields
# ------------------------------------------------------------------
print("\n7. IMPORTANT FIELD CHECKS")
print("-" * 80)

important_columns = [
    "Sku",
    "Product_Name",
    "Category",
    "Sub_category",
    "Product_Group",
    "Brand",
    "Package_price",
    "Retail_price",
    "Price_per_unit",
    "is_special",
    "RunDate",
    "state",
    "city",
]

for column in important_columns:
    if column in df.columns:
        print(f"{column:<20}: FOUND")
    else:
        print(f"{column:<20}: NOT FOUND")

# ------------------------------------------------------------------
# 8. Date analysis
# ------------------------------------------------------------------
print("\n8. DATE ANALYSIS")
print("-" * 80)

if "RunDate" in df.columns:
    run_dates = pd.to_datetime(df["RunDate"], errors="coerce")

    print(f"Earliest date:     {run_dates.min()}")
    print(f"Latest date:       {run_dates.max()}")
    print(f"Unique timestamps: {run_dates.nunique():,}")
    print(f"Invalid dates:     {run_dates.isna().sum():,}")

# ------------------------------------------------------------------
# 9. SKU analysis
# ------------------------------------------------------------------
print("\n9. SKU / PRODUCT ANALYSIS")
print("-" * 80)

if "Sku" in df.columns:
    print(f"Unique SKUs: {df['Sku'].nunique():,}")

    sku_counts = df.groupby("Sku").size()

    print(f"Minimum rows per SKU: {sku_counts.min():,}")
    print(f"Median rows per SKU:  {sku_counts.median():,.1f}")
    print(f"Maximum rows per SKU: {sku_counts.max():,}")

# ------------------------------------------------------------------
# 10. Geographic analysis
# ------------------------------------------------------------------
print("\n10. GEOGRAPHIC COVERAGE")
print("-" * 80)

if "state" in df.columns:
    print(f"States: {df['state'].nunique():,}")
    print(df["state"].value_counts(dropna=False).to_string())

if "city" in df.columns:
    print(f"\nUnique cities: {df['city'].nunique():,}")

# ------------------------------------------------------------------
# 11. Specials analysis
# ------------------------------------------------------------------
print("\n11. SPECIAL / PROMOTION ANALYSIS")
print("-" * 80)

if "is_special" in df.columns:
    print(df["is_special"].value_counts(dropna=False).to_string())

# ------------------------------------------------------------------
# 12. Create candidate discount regression target
# ------------------------------------------------------------------
print("\n12. DISCOUNT PERCENTAGE TARGET")
print("-" * 80)

if {"Package_price", "Retail_price"}.issubset(df.columns):

    package_price = pd.to_numeric(df["Package_price"], errors="coerce")
    retail_price = pd.to_numeric(df["Retail_price"], errors="coerce")

    valid_target = (
        retail_price.notna()
        & package_price.notna()
        & (retail_price > 0)
        & (package_price > 0)
        & (package_price <= retail_price)
    )

    df.loc[valid_target, "discount_percentage"] = (
        (retail_price[valid_target] - package_price[valid_target])
        / retail_price[valid_target]
        * 100
    )

    target = df["discount_percentage"].dropna()

    print(f"Rows with valid target: {len(target):,}")
    print(f"Percentage of dataset:  {(len(target) / len(df) * 100):.2f}%")

    if len(target) > 0:
        print("\nDiscount percentage statistics:")
        print(target.describe().round(2).to_string())

        print(f"\nMinimum: {target.min():.2f}%")
        print(f"Median:  {target.median():.2f}%")
        print(f"Mean:    {target.mean():.2f}%")
        print(f"Maximum: {target.max():.2f}%")

# ------------------------------------------------------------------
# 13. Special rows with usable regression target
# ------------------------------------------------------------------
print("\n13. SPECIAL ROWS WITH VALID TARGET")
print("-" * 80)

if "is_special" in df.columns and "discount_percentage" in df.columns:

    special_mask = (
        df["is_special"].astype(str).str.lower().isin(
            ["true", "1", "yes", "y"]
        )
    )

    usable_specials = df[
        special_mask & df["discount_percentage"].notna()
    ]

    print(f"Special rows:              {special_mask.sum():,}")
    print(f"Special rows + target:     {len(usable_specials):,}")

    if len(usable_specials) > 0:
        print("\nSpecial discount statistics:")
        print(
            usable_specials["discount_percentage"]
            .describe()
            .round(2)
            .to_string()
        )

print("\n" + "=" * 80)
print("INSPECTION COMPLETE")
print("=" * 80)
