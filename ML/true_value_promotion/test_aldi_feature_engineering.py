import os

from true_value_promotion.ingestion import load_aldi
from true_value_promotion.aldi_adapter import adapt_aldi_to_tvp
from true_value_promotion.feature_engineering import (
    add_aldi_historical_pricing,
)


ALDI_DATA_PATH = os.getenv("ALDI_DATA_PATH")

if not ALDI_DATA_PATH:
    raise RuntimeError(
        "Set ALDI_DATA_PATH to the Silver Layer pricing CSV."
    )


# Ingestion
aldi = load_aldi(ALDI_DATA_PATH)

# Schema conversion
tvp_aldi = adapt_aldi_to_tvp(aldi)

# Historical pricing features
result = add_aldi_historical_pricing(tvp_aldi)

reductions = result[result["has_measurable_saving"]].copy()


print("Total Aldi rows:", len(result))
print(
    "Rows with previous price:",
    result["previous_price"].notna().sum()
)
print("Genuine price reductions:", len(reductions))
print(
    "Products with reductions:",
    reductions["product_id"].nunique()
)

print(
    reductions[
        [
            "product_name",
            "original_price",
            "current_price",
            "saving_amount",
            "discount_percent",
        ]
    ].to_string(index=False)
)


# Validation

assert len(result) == 1000

assert result["previous_price"].notna().sum() == 131

assert len(reductions) == 10

assert reductions["product_id"].nunique() == 10

assert (reductions["saving_amount"] > 0).all()

assert (reductions["discount_percent"] > 0).all()

print("\nAldi historical pricing feature test passed.")