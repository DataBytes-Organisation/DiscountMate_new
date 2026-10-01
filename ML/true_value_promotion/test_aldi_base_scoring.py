import os

from true_value_promotion.ingestion import load_aldi
from true_value_promotion.aldi_adapter import adapt_aldi_to_tvp
from true_value_promotion.feature_engineering import (
    add_aldi_historical_pricing,
    add_base_tvp_score,
)


ALDI_DATA_PATH = os.getenv("ALDI_DATA_PATH")

if not ALDI_DATA_PATH:
    raise RuntimeError(
        "Set ALDI_DATA_PATH to the Silver Layer pricing CSV."
    )


# Aldi ingestion
aldi = load_aldi(ALDI_DATA_PATH)

# Convert Silver schema to TVP schema
tvp_aldi = adapt_aldi_to_tvp(aldi)

# Derive historical pricing features
features = add_aldi_historical_pricing(tvp_aldi)

# Keep measurable price reductions
promotions = features[
    features["has_measurable_saving"]
].copy()

# Apply inherited V1 base TVP scoring
scored = add_base_tvp_score(promotions)


print("Scored Aldi promotions:", len(scored))

print(
    scored[
        [
            "product_name",
            "original_price",
            "current_price",
            "saving_amount",
            "discount_percent",
            "saving_amount_capped",
            "base_score",
        ]
    ]
    .sort_values("base_score", ascending=False)
    .to_string(index=False)
)


# Validation

assert len(scored) == 10

assert scored["base_score"].notna().all()

assert (scored["base_score"] > 0).all()

assert (
    scored["saving_amount_capped"] <= 20
).all()

print("\nAldi V1 base scoring test passed.")