import pandas as pd
import numpy as np

VALIDATION_PATH = "data/validation_specials.csv"
PREDICTIONS_PATH = "data/validation_predictions.csv"

print("=" * 80)
print("DISCOUNTMATE - CATBOOST VALIDATION ERROR ANALYSIS")
print("=" * 80)

validation = pd.read_csv(VALIDATION_PATH, low_memory=False)
predictions = pd.read_csv(PREDICTIONS_PATH, low_memory=False)

# Add predictions back to the full validation dataset
validation["predicted_discount_percentage"] = (
    predictions["predicted_discount_percentage"].values
)

validation["absolute_error"] = (
    validation["discount_percentage"]
    - validation["predicted_discount_percentage"]
).abs()

validation["signed_error"] = (
    validation["predicted_discount_percentage"]
    - validation["discount_percentage"]
)

# ---------------------------------------------------------------
# 1. Overall prediction behaviour
# ---------------------------------------------------------------
print("\n1. PREDICTION RANGE")
print("-" * 80)

print(
    validation[
        [
            "discount_percentage",
            "predicted_discount_percentage",
            "absolute_error",
        ]
    ]
    .describe()
    .round(2)
    .to_string()
)

outside_range = (
    (validation["predicted_discount_percentage"] < 0)
    | (validation["predicted_discount_percentage"] > 100)
)

print(
    f"\nPredictions outside 0-100%: "
    f"{outside_range.sum():,}"
)

# ---------------------------------------------------------------
# 2. Error percentiles
# ---------------------------------------------------------------
print("\n2. ABSOLUTE ERROR PERCENTILES")
print("-" * 80)

for percentile in [50, 75, 90, 95, 99]:
    value = np.percentile(
        validation["absolute_error"],
        percentile
    )

    print(
        f"{percentile:>2}th percentile: "
        f"{value:.2f} percentage points"
    )

# ---------------------------------------------------------------
# 3. Accuracy within useful tolerances
# ---------------------------------------------------------------
print("\n3. PREDICTIONS WITHIN ERROR TOLERANCE")
print("-" * 80)

for tolerance in [2, 5, 10]:
    within = (
        validation["absolute_error"] <= tolerance
    ).mean() * 100

    print(
        f"Within +/-{tolerance:>2} percentage points: "
        f"{within:.2f}%"
    )

# ---------------------------------------------------------------
# 4. Error by actual discount band
# ---------------------------------------------------------------
print("\n4. ERROR BY DISCOUNT DEPTH")
print("-" * 80)

validation["discount_band"] = pd.cut(
    validation["discount_percentage"],
    bins=[0, 10, 20, 30, 40, 50, 100],
    labels=[
        "0-10%",
        "10-20%",
        "20-30%",
        "30-40%",
        "40-50%",
        "50%+",
    ],
)

band_results = (
    validation
    .groupby(
        "discount_band",
        observed=True
    )
    .agg(
        rows=("absolute_error", "size"),
        mae=("absolute_error", "mean"),
        actual_mean=("discount_percentage", "mean"),
        prediction_mean=(
            "predicted_discount_percentage",
            "mean"
        ),
    )
    .round(2)
)

print(band_results.to_string())

# ---------------------------------------------------------------
# 5. Error by category
# ---------------------------------------------------------------
print("\n5. ERROR BY CATEGORY")
print("-" * 80)

category_results = (
    validation
    .groupby("Category")
    .agg(
        rows=("absolute_error", "size"),
        mae=("absolute_error", "mean"),
    )
    .query("rows >= 50")
    .sort_values("mae", ascending=False)
    .round(2)
)

print(category_results.to_string())

# ---------------------------------------------------------------
# 6. Error by brand
# ---------------------------------------------------------------
print("\n6. HIGHEST-ERROR BRANDS")
print("-" * 80)

brand_results = (
    validation
    .groupby("Brand")
    .agg(
        rows=("absolute_error", "size"),
        mae=("absolute_error", "mean"),
    )
    .query("rows >= 30")
    .sort_values("mae", ascending=False)
    .head(20)
    .round(2)
)

print(brand_results.to_string())

# ---------------------------------------------------------------
# 7. Worst individual predictions
# ---------------------------------------------------------------
print("\n7. WORST 20 PREDICTIONS")
print("-" * 80)

worst = (
    validation
    .sort_values(
        "absolute_error",
        ascending=False
    )
    .head(20)
)

columns = [
    "Sku",
    "Brand",
    "Category",
    "Product_Group",
    "Retail_price",
    "discount_percentage",
    "predicted_discount_percentage",
    "absolute_error",
]

print(
    worst[columns]
    .round(2)
    .to_string(index=False)
)

print("\n" + "=" * 80)
print("ERROR ANALYSIS COMPLETE")
print("=" * 80)
