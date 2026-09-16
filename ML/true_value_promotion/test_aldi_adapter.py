import os

from true_value_promotion.ingestion import load_aldi
from true_value_promotion.aldi_adapter import adapt_aldi_to_tvp


ALDI_DATA_PATH = os.getenv("ALDI_DATA_PATH")

if not ALDI_DATA_PATH:
    raise RuntimeError(
        "Set ALDI_DATA_PATH to the Silver Layer fct_product_pricing CSV."
    )


# Load Aldi Silver Layer records
aldi = load_aldi(ALDI_DATA_PATH)

# Convert to TVP-compatible structure
tvp_aldi = adapt_aldi_to_tvp(aldi)


print("Input Aldi shape:", aldi.shape)
print("TVP Aldi shape:", tvp_aldi.shape)

print("\nTVP columns:")
print(tvp_aldi.columns.tolist())

print("\nRetailers:")
print(tvp_aldi["retailer"].value_counts())


# Validation
assert len(tvp_aldi) == len(aldi)
assert len(tvp_aldi) == 1000

assert (tvp_aldi["retailer"] == "Aldi").all()

assert tvp_aldi["product_id"].notna().all()
assert tvp_aldi["product_name"].notna().all()
assert tvp_aldi["current_price"].notna().all()
assert tvp_aldi["category_id"].notna().all()

assert tvp_aldi["original_price"].isna().all()
assert tvp_aldi["saving_amount"].isna().all()

print("\nAldi TVP adapter test passed.")