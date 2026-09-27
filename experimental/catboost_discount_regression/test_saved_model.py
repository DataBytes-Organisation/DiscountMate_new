from pathlib import Path
import json

import pandas as pd
from catboost import CatBoostRegressor

MODEL_PATH = Path("artifacts/catboost_discount_depth.cbm")
TEST_PATH = Path("data/test_specials.csv")

categorical_features = [
    "Category",
    "Sub_category",
    "Product_Group",
    "Brand",
    "state",
    "city",
    "package_size",
]

numerical_features = [
    "Retail_price",
    "is_estimated",
]

feature_columns = categorical_features + numerical_features

print("=" * 80)
print("DISCOUNTMATE - SAVED CATBOOST MODEL TEST")
print("=" * 80)

# Load saved model
model = CatBoostRegressor()
model.load_model(str(MODEL_PATH))

print("\nSaved model loaded successfully.")

# Load one unseen test example
df = pd.read_csv(TEST_PATH, low_memory=False)

row = df.iloc[[0]].copy()

X = row[feature_columns].copy()

for column in categorical_features:
    X[column] = X[column].fillna("Unknown").astype(str)

for column in numerical_features:
    X[column] = pd.to_numeric(
        X[column],
        errors="coerce"
    ).fillna(0)

predicted_discount = float(model.predict(X)[0])

regular_price = float(row.iloc[0]["Retail_price"])

predicted_sale_price = regular_price * (
    1 - predicted_discount / 100
)

actual_discount = float(
    row.iloc[0]["discount_percentage"]
)

output = {
    "success": True,

    "product": {
        "sku": str(row.iloc[0]["Sku"]),
        "brand": str(row.iloc[0]["Brand"]),
        "category": str(row.iloc[0]["Category"]),
    },

    "prediction": {
        "type": "discount_depth",
        "predicted_discount_percentage": round(
            predicted_discount, 2
        ),
        "regular_price": round(
            regular_price, 2
        ),
        "estimated_sale_price": round(
            predicted_sale_price, 2
        ),
    },

    "model": {
        "name": "catboost_discount_depth",
        "type": "CatBoostRegressor",
        "status": "experimental",
    },

    "limitations": {
        "temporal_forecast": False,
        "note": (
            "Current model predicts promotional discount depth "
            "from product attributes. It is not yet a future "
            "time-series price forecast."
        ),
    },
}

print("\nSTANDARDISED JSON OUTPUT")
print("-" * 80)

print(
    json.dumps(
        output,
        indent=2
    )
)

print("\nInternal test reference:")
print(f"Actual discount:    {actual_discount:.2f}%")
print(f"Predicted discount: {predicted_discount:.2f}%")

print("\n" + "=" * 80)
print("SAVED MODEL TEST COMPLETE")
print("=" * 80)
