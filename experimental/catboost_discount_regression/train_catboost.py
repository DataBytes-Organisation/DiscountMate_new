from pathlib import Path

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

print("=" * 80)
print("DISCOUNTMATE - CATBOOST DISCOUNT DEPTH BASELINE")
print("=" * 80)

# ------------------------------------------------------------------
# 1. Load prepared datasets
# ------------------------------------------------------------------
train_df = pd.read_csv(TRAIN_PATH, low_memory=False)
validation_df = pd.read_csv(VALIDATION_PATH, low_memory=False)

print(f"\nTraining rows:   {len(train_df):,}")
print(f"Validation rows: {len(validation_df):,}")

# ------------------------------------------------------------------
# 2. Define target and features
# ------------------------------------------------------------------
target = "discount_percentage"

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

# IMPORTANT:
# SKU is deliberately NOT used as a model feature.
# It was used only to create leakage-safe grouped splits.

X_train = train_df[feature_columns].copy()
y_train = train_df[target].copy()

X_validation = validation_df[feature_columns].copy()
y_validation = validation_df[target].copy()

# ------------------------------------------------------------------
# 3. Clean categorical values
# ------------------------------------------------------------------
for column in categorical_features:
    X_train[column] = X_train[column].fillna("Unknown").astype(str)
    X_validation[column] = X_validation[column].fillna("Unknown").astype(str)

# ------------------------------------------------------------------
# 4. Simple median baseline
# ------------------------------------------------------------------
median_prediction = y_train.median()

baseline_predictions = np.full(
    len(y_validation),
    median_prediction
)

baseline_mae = mean_absolute_error(
    y_validation,
    baseline_predictions
)

baseline_rmse = root_mean_squared_error(
    y_validation,
    baseline_predictions
)

baseline_r2 = r2_score(
    y_validation,
    baseline_predictions
)

print("\n" + "-" * 80)
print("MEDIAN BASELINE")
print("-" * 80)

print(f"Training median discount: {median_prediction:.2f}%")
print(f"Validation MAE:           {baseline_mae:.4f}")
print(f"Validation RMSE:          {baseline_rmse:.4f}")
print(f"Validation R2:            {baseline_r2:.4f}")

# ------------------------------------------------------------------
# 5. Create CatBoost model
# ------------------------------------------------------------------
model = CatBoostRegressor(
    loss_function="RMSE",
    eval_metric="RMSE",
    iterations=1000,
    learning_rate=0.05,
    depth=8,
    l2_leaf_reg=5,
    random_seed=42,
    verbose=100,
    allow_writing_files=False,
)

print("\n" + "-" * 80)
print("TRAINING CATBOOST")
print("-" * 80)

model.fit(
    X_train,
    y_train,
    cat_features=categorical_features,
    eval_set=(X_validation, y_validation),
    early_stopping_rounds=100,
    use_best_model=True,
)

# ------------------------------------------------------------------
# 6. Validation predictions
# ------------------------------------------------------------------
validation_predictions = model.predict(X_validation)

catboost_mae = mean_absolute_error(
    y_validation,
    validation_predictions
)

catboost_rmse = root_mean_squared_error(
    y_validation,
    validation_predictions
)

catboost_r2 = r2_score(
    y_validation,
    validation_predictions
)

print("\n" + "-" * 80)
print("CATBOOST VALIDATION RESULTS")
print("-" * 80)

print(f"Best iteration: {model.get_best_iteration()}")
print(f"MAE:            {catboost_mae:.4f}")
print(f"RMSE:           {catboost_rmse:.4f}")
print(f"R2:             {catboost_r2:.4f}")

# ------------------------------------------------------------------
# 7. Compare against baseline
# ------------------------------------------------------------------
mae_improvement = (
    (baseline_mae - catboost_mae)
    / baseline_mae
    * 100
)

rmse_improvement = (
    (baseline_rmse - catboost_rmse)
    / baseline_rmse
    * 100
)

print("\n" + "-" * 80)
print("IMPROVEMENT OVER MEDIAN BASELINE")
print("-" * 80)

print(f"MAE improvement:  {mae_improvement:.2f}%")
print(f"RMSE improvement: {rmse_improvement:.2f}%")

# ------------------------------------------------------------------
# 8. Feature importance
# ------------------------------------------------------------------
importance = pd.DataFrame({
    "feature": feature_columns,
    "importance": model.get_feature_importance(),
}).sort_values(
    "importance",
    ascending=False
)

print("\n" + "-" * 80)
print("FEATURE IMPORTANCE")
print("-" * 80)

print(importance.to_string(index=False))

# ------------------------------------------------------------------
# 9. Save validation predictions locally
# ------------------------------------------------------------------
results = validation_df[
    ["Sku", "discount_percentage"]
].copy()

results["predicted_discount_percentage"] = validation_predictions

results["absolute_error"] = (
    results["discount_percentage"]
    - results["predicted_discount_percentage"]
).abs()

results.to_csv(
    "data/validation_predictions.csv",
    index=False
)

print("\nSaved:")
print("  data/validation_predictions.csv")

print("\nNOTE:")
print("The test dataset has deliberately NOT been evaluated yet.")
print("It remains untouched for final model evaluation.")

print("\n" + "=" * 80)
print("CATBOOST BASELINE COMPLETE")
print("=" * 80)
