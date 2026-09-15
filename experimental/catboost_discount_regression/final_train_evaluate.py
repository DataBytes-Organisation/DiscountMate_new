from pathlib import Path
from datetime import datetime, timezone
import json

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from sklearn.metrics import (
    mean_absolute_error,
    root_mean_squared_error,
    r2_score,
)

TRAIN_PATH = Path("data/train_specials.csv")
VALIDATION_PATH = Path("data/validation_specials.csv")
TEST_PATH = Path("data/test_specials.csv")

ARTIFACT_DIR = Path("artifacts")
ARTIFACT_DIR.mkdir(exist_ok=True)

MODEL_PATH = ARTIFACT_DIR / "catboost_discount_depth.cbm"
METADATA_PATH = ARTIFACT_DIR / "catboost_discount_depth_metadata.json"

print("=" * 90)
print("DISCOUNTMATE - FINAL CATBOOST TEST EVALUATION")
print("=" * 90)

# ------------------------------------------------------------------
# 1. Load data
# ------------------------------------------------------------------
train_df = pd.read_csv(TRAIN_PATH, low_memory=False)
validation_df = pd.read_csv(VALIDATION_PATH, low_memory=False)
test_df = pd.read_csv(TEST_PATH, low_memory=False)

print(f"\nOriginal training rows:   {len(train_df):,}")
print(f"Validation rows:          {len(validation_df):,}")
print(f"Untouched test rows:      {len(test_df):,}")

# ------------------------------------------------------------------
# 2. Combine train + validation
# ------------------------------------------------------------------
# Hyperparameters are already locked.
# Validation can now be added back into final training data.

final_train_df = pd.concat(
    [train_df, validation_df],
    ignore_index=True,
)

print(f"Final training rows:      {len(final_train_df):,}")

# ------------------------------------------------------------------
# 3. Define features
# ------------------------------------------------------------------
TARGET = "discount_percentage"

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

X_train = final_train_df[feature_columns].copy()
y_train = final_train_df[TARGET].copy()

X_test = test_df[feature_columns].copy()
y_test = test_df[TARGET].copy()

# ------------------------------------------------------------------
# 4. Clean features
# ------------------------------------------------------------------
for column in categorical_features:

    X_train[column] = (
        X_train[column]
        .fillna("Unknown")
        .astype(str)
    )

    X_test[column] = (
        X_test[column]
        .fillna("Unknown")
        .astype(str)
    )

for column in numerical_features:

    X_train[column] = pd.to_numeric(
        X_train[column],
        errors="coerce",
    )

    X_test[column] = pd.to_numeric(
        X_test[column],
        errors="coerce",
    )

    median = X_train[column].median()

    X_train[column] = X_train[column].fillna(median)
    X_test[column] = X_test[column].fillna(median)

# ------------------------------------------------------------------
# 5. Verify test SKUs remain unseen
# ------------------------------------------------------------------
train_skus = set(final_train_df["Sku"].astype(str))
test_skus = set(test_df["Sku"].astype(str))

sku_overlap = train_skus & test_skus

print("\n" + "-" * 90)
print("FINAL LEAKAGE CHECK")
print("-" * 90)

print(f"Final training SKUs: {len(train_skus):,}")
print(f"Test SKUs:           {len(test_skus):,}")
print(f"SKU overlap:         {len(sku_overlap):,}")

if len(sku_overlap) == 0:
    print("PASS: Test SKUs are completely unseen.")
else:
    print("WARNING: SKU overlap detected.")

# ------------------------------------------------------------------
# 6. Test-set median baseline
# ------------------------------------------------------------------
training_median = y_train.median()

baseline_predictions = np.full(
    len(y_test),
    training_median,
)

baseline_mae = mean_absolute_error(
    y_test,
    baseline_predictions,
)

baseline_rmse = root_mean_squared_error(
    y_test,
    baseline_predictions,
)

baseline_r2 = r2_score(
    y_test,
    baseline_predictions,
)

print("\n" + "-" * 90)
print("TEST MEDIAN BASELINE")
print("-" * 90)

print(f"Training median discount: {training_median:.2f}%")
print(f"MAE:                      {baseline_mae:.4f}")
print(f"RMSE:                     {baseline_rmse:.4f}")
print(f"R2:                       {baseline_r2:.4f}")

# ------------------------------------------------------------------
# 7. Train locked final CatBoost model
# ------------------------------------------------------------------
# Tuning selected:
# depth = 8
# learning_rate = 0.03
# l2_leaf_reg = 5
#
# CatBoost best_iteration was 1248 (zero-based),
# therefore final model uses 1249 iterations.

FINAL_ITERATIONS = 1249

model = CatBoostRegressor(
    loss_function="RMSE",
    eval_metric="RMSE",
    iterations=FINAL_ITERATIONS,
    learning_rate=0.03,
    depth=8,
    l2_leaf_reg=5,
    random_seed=42,
    verbose=100,
    allow_writing_files=False,
)

print("\n" + "-" * 90)
print("TRAINING LOCKED FINAL MODEL")
print("-" * 90)

model.fit(
    X_train,
    y_train,
    cat_features=categorical_features,
)

# ------------------------------------------------------------------
# 8. ONE-TIME TEST EVALUATION
# ------------------------------------------------------------------
test_predictions = model.predict(X_test)

test_mae = mean_absolute_error(
    y_test,
    test_predictions,
)

test_rmse = root_mean_squared_error(
    y_test,
    test_predictions,
)

test_r2 = r2_score(
    y_test,
    test_predictions,
)

print("\n" + "=" * 90)
print("FINAL UNTOUCHED TEST RESULTS")
print("=" * 90)

print(f"MAE:  {test_mae:.4f}")
print(f"RMSE: {test_rmse:.4f}")
print(f"R2:   {test_r2:.4f}")

# ------------------------------------------------------------------
# 9. Baseline improvement
# ------------------------------------------------------------------
mae_improvement = (
    (baseline_mae - test_mae)
    / baseline_mae
    * 100
)

rmse_improvement = (
    (baseline_rmse - test_rmse)
    / baseline_rmse
    * 100
)

print("\nImprovement over median baseline:")
print(f"MAE improvement:  {mae_improvement:.2f}%")
print(f"RMSE improvement: {rmse_improvement:.2f}%")

# ------------------------------------------------------------------
# 10. Useful error tolerances
# ------------------------------------------------------------------
absolute_error = np.abs(
    y_test.to_numpy() - test_predictions
)

print("\nPrediction error tolerance:")

for tolerance in [2, 5, 10]:

    within = (
        absolute_error <= tolerance
    ).mean() * 100

    print(
        f"Within +/-{tolerance:>2} percentage points: "
        f"{within:.2f}%"
    )

# ------------------------------------------------------------------
# 11. Feature importance
# ------------------------------------------------------------------
importance = pd.DataFrame({
    "feature": feature_columns,
    "importance": model.get_feature_importance(),
}).sort_values(
    "importance",
    ascending=False,
)

print("\n" + "-" * 90)
print("FINAL FEATURE IMPORTANCE")
print("-" * 90)

print(importance.round(4).to_string(index=False))

# ------------------------------------------------------------------
# 12. Save test predictions locally
# ------------------------------------------------------------------
prediction_output = test_df[
    ["Sku", TARGET]
].copy()

prediction_output[
    "predicted_discount_percentage"
] = test_predictions

prediction_output[
    "absolute_error"
] = absolute_error

prediction_output.to_csv(
    "data/final_test_predictions.csv",
    index=False,
)

# ------------------------------------------------------------------
# 13. Save trained CatBoost model
# ------------------------------------------------------------------
model.save_model(str(MODEL_PATH))

# ------------------------------------------------------------------
# 14. Save model metadata
# ------------------------------------------------------------------
metadata = {
    "model_name": "DiscountMate CatBoost Discount Depth Regressor",
    "model_type": "CatBoostRegressor",
    "status": "experimental",
    "target": TARGET,

    "features": feature_columns,
    "categorical_features": categorical_features,
    "numerical_features": numerical_features,

    "hyperparameters": {
        "iterations": FINAL_ITERATIONS,
        "depth": 8,
        "learning_rate": 0.03,
        "l2_leaf_reg": 5,
        "random_seed": 42,
        "loss_function": "RMSE",
    },

    "training_rows": int(len(final_train_df)),
    "training_skus": int(len(train_skus)),
    "test_rows": int(len(test_df)),
    "test_skus": int(len(test_skus)),
    "sku_overlap": int(len(sku_overlap)),

    "test_metrics": {
        "mae": float(test_mae),
        "rmse": float(test_rmse),
        "r2": float(test_r2),
        "median_baseline_mae": float(baseline_mae),
        "median_baseline_rmse": float(baseline_rmse),
        "mae_improvement_percent": float(mae_improvement),
        "rmse_improvement_percent": float(rmse_improvement),
    },

    "data_limitation": (
        "Current Australian source dataset contains one timestamp. "
        "This model predicts promotional discount depth and is not "
        "yet a temporal future-price forecasting model."
    ),

    "created_at_utc": datetime.now(
        timezone.utc
    ).isoformat(),
}

with open(
    METADATA_PATH,
    "w",
    encoding="utf-8",
) as file:

    json.dump(
        metadata,
        file,
        indent=2,
    )

print("\nSaved artifacts:")
print(f"  {MODEL_PATH}")
print(f"  {METADATA_PATH}")
print("  data/final_test_predictions.csv")

print("\nIMPORTANT:")
print(
    "The test set has now been evaluated. "
    "Do not tune the model using these test results."
)

print("\n" + "=" * 90)
print("FINAL MODEL EVALUATION COMPLETE")
print("=" * 90)
