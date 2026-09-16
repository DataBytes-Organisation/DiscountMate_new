import os
import pandas as pd

from true_value_promotion.ingestion import load_aldi
from true_value_promotion.aldi_adapter import adapt_aldi_to_tvp
from true_value_promotion.category_mapping import add_aldi_categories
from true_value_promotion.feature_engineering import (
    add_aldi_historical_pricing,
    add_base_tvp_score,
    add_category_relative_score,
    add_final_tvp_score,
)

ALDI_DATA_PATH = os.getenv("ALDI_DATA_PATH")

if not ALDI_DATA_PATH:
    raise RuntimeError("Set ALDI_DATA_PATH.")


# -----------------------------
# Build Aldi final scores
# -----------------------------

aldi = load_aldi(ALDI_DATA_PATH)
tvp_aldi = adapt_aldi_to_tvp(aldi)
features = add_aldi_historical_pricing(tvp_aldi)

aldi_promos = features[
    features["has_measurable_saving"]
].copy()

aldi_scored = add_base_tvp_score(aldi_promos)
aldi_scored = add_aldi_categories(aldi_scored)


# -----------------------------
# Load V1 reference output
# -----------------------------

v1_path = (
    "Sharon_Roy_true_value_promotion/"
    "true_value_customer_deals_v1.csv"
)

v1 = pd.read_csv(v1_path)


# Category benchmarks
benchmarks = (
    v1.groupby("main_category")["discount_percent"]
    .agg(
        category_median_discount="median",
        category_q25_discount=lambda x: x.quantile(0.25),
        category_q75_discount=lambda x: x.quantile(0.75),
    )
    .reset_index()
)


# -----------------------------
# Finish Aldi scoring
# -----------------------------

aldi_scored = aldi_scored.merge(
    benchmarks,
    on="main_category",
    how="left"
)

aldi_scored = add_category_relative_score(aldi_scored)
aldi_scored = add_final_tvp_score(aldi_scored)


# -----------------------------
# Create comparison dataset
# -----------------------------

v1_compare = v1[
    [
        "retailer",
        "discount_percent",
        "true_value_score",
        "discount_class"
    ]
].copy()

aldi_compare = aldi_scored[
    [
        "retailer",
        "discount_percent",
        "true_value_score",
        "discount_class"
    ]
].copy()

combined = pd.concat(
    [v1_compare, aldi_compare],
    ignore_index=True
)


# -----------------------------
# Retailer-level summary
# -----------------------------

summary = (
    combined
    .groupby("retailer")
    .agg(
        deals_scored=("true_value_score", "count"),
        average_discount=("discount_percent", "mean"),
        median_discount=("discount_percent", "median"),
        average_tvp_score=("true_value_score", "mean"),
        median_tvp_score=("true_value_score", "median"),
        max_tvp_score=("true_value_score", "max"),
    )
    .round(2)
)

print("\n=== Retailer Comparison ===")
print(summary)


# -----------------------------
# Discount class distribution
# -----------------------------

class_distribution = pd.crosstab(
    combined["retailer"],
    combined["discount_class"]
)

print("\n=== Discount Class Distribution ===")
print(class_distribution)


# -----------------------------
# Aldi top deals
# -----------------------------

print("\n=== Aldi Top Deals ===")

print(
    aldi_scored[
        [
            "product_name",
            "main_category",
            "discount_percent",
            "true_value_score",
            "discount_class"
        ]
    ]
    .sort_values(
        "true_value_score",
        ascending=False
    )
    .to_string(index=False)
)