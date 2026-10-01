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


# --------------------------------
# Prepare Aldi scoring candidates
# --------------------------------

aldi = load_aldi(ALDI_DATA_PATH)

tvp_aldi = adapt_aldi_to_tvp(aldi)

features = add_aldi_historical_pricing(tvp_aldi)

promotions = features[
    features["has_measurable_saving"]
].copy()

scored = add_base_tvp_score(promotions)

scored = add_aldi_categories(scored)


# --------------------------------
# Build category benchmarks from V1
# --------------------------------

v1 = pd.read_csv(
    "Sharon_Roy_true_value_promotion/"
    "master_true_value_dataset_v1.csv"
)

v1_promos = v1[
    v1["discount_percent"].notna()
    & (v1["discount_percent"] > 0)
].copy()

benchmarks = (
    v1_promos
    .groupby("main_category")["discount_percent"]
    .agg(
        category_median_discount="median",
        category_q25_discount=lambda x: x.quantile(0.25),
        category_q75_discount=lambda x: x.quantile(0.75),
    )
    .reset_index()
)


# --------------------------------
# Attach benchmarks to Aldi
# --------------------------------

scored = scored.merge(
    benchmarks,
    on="main_category",
    how="left"
)


# --------------------------------
# Final TVP scoring
# --------------------------------

scored = add_category_relative_score(scored)

scored = add_final_tvp_score(scored)


print(
    scored[
        [
            "product_name",
            "main_category",
            "discount_percent",
            "base_score",
            "category_relative_score",
            "true_value_score",
            "discount_class",
        ]
    ]
    .sort_values("true_value_score", ascending=False)
    .to_string(index=False)
)


print(
    "\nMissing benchmarks:",
    scored[
        [
            "category_q25_discount",
            "category_median_discount",
            "category_q75_discount",
        ]
    ].isna().any(axis=1).sum()
)

print(
    "Missing final scores:",
    scored["true_value_score"].isna().sum()
)

print("\nDiscount classes:")
print(scored["discount_class"].value_counts())


assert len(scored) == 10
assert scored["true_value_score"].notna().all()
assert scored["category_relative_score"].notna().all()

print("\nAldi final TVP scoring test passed.")