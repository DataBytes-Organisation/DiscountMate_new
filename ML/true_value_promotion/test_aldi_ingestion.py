from true_value_promotion.ingestion import load_aldi

import os

ALDI_DATA_PATH = os.getenv("ALDI_DATA_PATH")

if not ALDI_DATA_PATH:
    raise RuntimeError(
        "Set ALDI_DATA_PATH to the Silver Layer fct_product_pricing CSV."
    )

aldi = load_aldi(ALDI_DATA_PATH)

print("Aldi shape:", aldi.shape)
print("Unique retailers:", aldi["retailer_id"].nunique())
print("Unique products:", aldi["product_id"].nunique())

assert len(aldi) > 0
assert aldi["retailer_id"].nunique() == 1
assert aldi["retailer_id"].iloc[0] == "c4275d24-3945-4825-8399-e5a87e86557e"

print("Aldi ingestion test passed.")