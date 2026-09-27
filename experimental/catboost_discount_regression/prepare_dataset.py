from pathlib import Path

import pandas as pd
from sklearn.model_selection import GroupShuffleSplit

DATA_PATH = Path("data/Australia_Grocery_2022Sep.csv")

print("=" * 80)
print("DISCOUNTMATE CATBOOST - DATA PREPARATION")
print("=" * 80)

# ------------------------------------------------------------------
# 1. Load data
# ------------------------------------------------------------------
df = pd.read_csv(DATA_PATH, low_memory=False)

print(f"\nOriginal rows: {len(df):,}")

# ------------------------------------------------------------------
# 2. Convert prices to numeric
# ------------------------------------------------------------------
df["Package_price"] = pd.to_numeric(
    df["Package_price"], errors="coerce"
)

df["Retail_price"] = pd.to_numeric(
    df["Retail_price"], errors="coerce"
)

# ------------------------------------------------------------------
# 3. Keep genuine special rows
# ------------------------------------------------------------------
special_mask = df["is_special"].eq(1)

valid_price_mask = (
    df["Package_price"].notna()
    & df["Retail_price"].notna()
    & (df["Package_price"] > 0)
    & (df["Retail_price"] > 0)
    & (df["Package_price"] < df["Retail_price"])
)

model_df = df.loc[
    special_mask & valid_price_mask
].copy()

# ------------------------------------------------------------------
# 4. Create regression target
# ------------------------------------------------------------------
model_df["discount_percentage"] = (
    (
        model_df["Retail_price"]
        - model_df["Package_price"]
    )
    / model_df["Retail_price"]
    * 100
)

print(f"Usable special rows: {len(model_df):,}")
print(
    f"Unique SKUs: "
    f"{model_df['Sku'].nunique():,}"
)

print("\nTarget statistics:")
print(
    model_df["discount_percentage"]
    .describe()
    .round(2)
    .to_string()
)

# ------------------------------------------------------------------
# 5. Define safe features
# ------------------------------------------------------------------
# IMPORTANT:
# Package_price is excluded because the target is calculated from it.
#
# Price_per_unit and unit_price are also excluded because they are
# derived from the current selling price and can leak target info.
#
# Product_URL, RunDate and tid are identifiers / non-predictive fields.
#
# is_special is excluded because every modelling row is already special.

categorical_features = [
    "Category",
    "Sub_category",
    "Product_Group",
    "Brand",
    "Sku",
    "state",
    "city",
    "package_size",
]

numerical_features = [
    "Retail_price",
    "is_estimated",
]

feature_columns = categorical_features + numerical_features

# ------------------------------------------------------------------
# 6. Keep only modelling fields
# ------------------------------------------------------------------
prepared = model_df[
    feature_columns
    + ["discount_percentage"]
].copy()

# CatBoost cannot accept missing categorical values directly as NaN
# reliably, so replace them with an explicit category.
for column in categorical_features:
    prepared[column] = (
        prepared[column]
        .fillna("Unknown")
        .astype(str)
    )

# Fill numeric missing values using median
for column in numerical_features:
    prepared[column] = pd.to_numeric(
        prepared[column],
        errors="coerce"
    )

    prepared[column] = prepared[column].fillna(
        prepared[column].median()
    )

print("\nSelected features:")
for feature in feature_columns:
    print(f"  - {feature}")

# ------------------------------------------------------------------
# 7. SKU-GROUPED TRAIN / VALIDATION / TEST SPLIT
# ------------------------------------------------------------------
# Never randomly split individual rows because the same SKU occurs in
# many cities. We keep each SKU entirely inside one dataset split.

groups = prepared["Sku"]

first_split = GroupShuffleSplit(
    n_splits=1,
    train_size=0.70,
    random_state=42,
)

train_idx, temp_idx = next(
    first_split.split(
        prepared,
        groups=groups
    )
)

train_df = prepared.iloc[train_idx].copy()
temp_df = prepared.iloc[temp_idx].copy()

second_split = GroupShuffleSplit(
    n_splits=1,
    train_size=0.50,
    random_state=42,
)

validation_idx, test_idx = next(
    second_split.split(
        temp_df,
        groups=temp_df["Sku"]
    )
)

validation_df = temp_df.iloc[validation_idx].copy()
test_df = temp_df.iloc[test_idx].copy()

# ------------------------------------------------------------------
# 8. Verify no SKU leakage
# ------------------------------------------------------------------
train_skus = set(train_df["Sku"])
validation_skus = set(validation_df["Sku"])
test_skus = set(test_df["Sku"])

train_val_overlap = train_skus & validation_skus
train_test_overlap = train_skus & test_skus
val_test_overlap = validation_skus & test_skus

print("\n" + "-" * 80)
print("DATASET SPLITS")
print("-" * 80)

print(
    f"Training rows:   {len(train_df):,} "
    f"({len(train_df) / len(prepared) * 100:.1f}%)"
)

print(
    f"Validation rows: {len(validation_df):,} "
    f"({len(validation_df) / len(prepared) * 100:.1f}%)"
)

print(
    f"Test rows:       {len(test_df):,} "
    f"({len(test_df) / len(prepared) * 100:.1f}%)"
)

print("\nUnique SKUs:")
print(f"Training:   {len(train_skus):,}")
print(f"Validation: {len(validation_skus):,}")
print(f"Test:       {len(test_skus):,}")

print("\nSKU leakage check:")
print(
    f"Train ? Validation overlap: "
    f"{len(train_val_overlap)}"
)

print(
    f"Train ? Test overlap:       "
    f"{len(train_test_overlap)}"
)

print(
    f"Validation ? Test overlap:  "
    f"{len(val_test_overlap)}"
)

if (
    len(train_val_overlap) == 0
    and len(train_test_overlap) == 0
    and len(val_test_overlap) == 0
):
    print("\nPASS: No SKU leakage between splits.")
else:
    print("\nWARNING: SKU leakage detected.")

# ------------------------------------------------------------------
# 9. Save local derived datasets
# ------------------------------------------------------------------
train_df.to_csv(
    "data/train_specials.csv",
    index=False
)

validation_df.to_csv(
    "data/validation_specials.csv",
    index=False
)

test_df.to_csv(
    "data/test_specials.csv",
    index=False
)

print("\nLocal prepared datasets saved:")
print("  data/train_specials.csv")
print("  data/validation_specials.csv")
print("  data/test_specials.csv")

print("\n" + "=" * 80)
print("DATA PREPARATION COMPLETE")
print("=" * 80)
