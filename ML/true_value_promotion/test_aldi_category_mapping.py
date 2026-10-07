import os

from true_value_promotion.ingestion import load_aldi
from true_value_promotion.aldi_adapter import adapt_aldi_to_tvp
from true_value_promotion.feature_engineering import (
    add_aldi_historical_pricing,
    add_base_tvp_score,
)
from true_value_promotion.category_mapping import (
    add_aldi_categories,
)


ALDI_DATA_PATH = os.getenv("ALDI_DATA_PATH")

if not ALDI_DATA_PATH:
    raise RuntimeError(
        "Set ALDI_DATA_PATH to the Silver Layer pricing CSV."
    )


aldi = load_aldi(ALDI_DATA_PATH)

tvp_aldi = adapt_aldi_to_tvp(aldi)

features = add_aldi_historical_pricing(tvp_aldi)

promotions = features[
    features["has_measurable_saving"]
].copy()

scored = add_base_tvp_score(promotions)

scored = add_aldi_categories(scored)


print(
    scored[
        [
            "product_name",
            "category_id",
            "category_name",
            "main_category",
            "discount_percent",
            "base_score",
        ]
    ].to_string(index=False)
)

print(
    "\nUnmapped category names:",
    scored["category_name"].isna().sum()
)

print(
    "Unmapped main categories:",
    scored["main_category"].isna().sum()
)


assert len(scored) == 10
assert scored["category_name"].notna().all()
assert scored["main_category"].notna().all()

print("\nAldi category mapping test passed.")