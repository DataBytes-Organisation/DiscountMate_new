import pandas as pd
import numpy as np

from catboost import CatBoostRegressor
from sklearn.metrics import (
    mean_absolute_error,
    root_mean_squared_error,
    r2_score,
)

TRAIN_PATH = "data/train_specials.csv"
VALIDATION_PATH = "data/validation_specials.csv"

print("=" * 90)
print("DISCOUNTMATE - CATBOOST FEATURE ABLATION")
print("=" * 90)

train_df = pd.read_csv(TRAIN_PATH, low_memory=False)
validation_df = pd.read_csv(
    VALIDATION_PATH,
    low_memory=False,
)

TARGET = "discount_percentage"

experiments = {
    "A_full_model": {
        "categorical": [
            "Category",
            "Sub_category",
            "Product_Group",
            "Brand",
            "state",
            "city",
            "package_size",
        ],
        "numeric": [
            "Retail_price",
            "is_estimated",
        ],
    },

    "B_no_brand": {
        "categorical": [
            "Category",
            "Sub_category",
            "Product_Group",
            "state",
            "city",
            "package_size",
        ],
        "numeric": [
            "Retail_price",
            "is_estimated",
        ],
    },

    "C_no_retail_price": {
        "categorical": [
            "Category",
            "Sub_category",
            "Product_Group",
            "Brand",
            "state",
            "city",
            "package_size",
        ],
        "numeric": [
            "is_estimated",
        ],
    },

    "D_metadata_only": {
        "categorical": [
            "Category",
            "Sub_category",
            "Product_Group",
            "state",
            "city",
            "package_size",
        ],
        "numeric": [
            "is_estimated",
        ],
    },
}

results = []

train_brands = set(
    train_df["Brand"]
    .fillna("Unknown")
    .astype(str)
)

validation_brands = (
    validation_df["Brand"]
    .fillna("Unknown")
    .astype(str)
)

seen_brand_mask = validation_brands.isin(
    train_brands
)

unseen_brand_mask = ~seen_brand_mask

print("\nBRAND GENERALISATION CHECK")
print("-" * 90)

print(
    f"Validation rows with seen brands:   "
    f"{seen_brand_mask.sum():,}"
)

print(
    f"Validation rows with unseen brands: "
    f"{unseen_brand_mask.sum():,}"
)

print(
    f"Unseen-brand percentage: "
    f"{unseen_brand_mask.mean() * 100:.2f}%"
)

for name, config in experiments.items():

    print("\n" + "=" * 90)
    print(f"EXPERIMENT: {name}")
    print("=" * 90)

    categorical = config["categorical"]
    numeric = config["numeric"]

    features = categorical + numeric

    X_train = train_df[features].copy()
    y_train = train_df[TARGET].copy()

    X_validation = (
        validation_df[features].copy()
    )

    y_validation = (
        validation_df[TARGET].copy()
    )

    for column in categorical:

        X_train[column] = (
            X_train[column]
            .fillna("Unknown")
            .astype(str)
        )

        X_validation[column] = (
            X_validation[column]
            .fillna("Unknown")
            .astype(str)
        )

    for column in numeric:

        X_train[column] = pd.to_numeric(
            X_train[column],
            errors="coerce",
        )

        X_validation[column] = pd.to_numeric(
            X_validation[column],
            errors="coerce",
        )

        median = X_train[column].median()

        X_train[column] = (
            X_train[column].fillna(median)
        )

        X_validation[column] = (
            X_validation[column].fillna(median)
        )

    model = CatBoostRegressor(
        loss_function="RMSE",
        eval_metric="RMSE",
        iterations=1000,
        learning_rate=0.05,
        depth=8,
        l2_leaf_reg=5,
        random_seed=42,
        verbose=False,
        allow_writing_files=False,
    )

    model.fit(
        X_train,
        y_train,
        cat_features=categorical,
        eval_set=(
            X_validation,
            y_validation,
        ),
        early_stopping_rounds=100,
        use_best_model=True,
    )

    predictions = model.predict(
        X_validation
    )

    overall_mae = mean_absolute_error(
        y_validation,
        predictions,
    )

    overall_rmse = root_mean_squared_error(
        y_validation,
        predictions,
    )

    overall_r2 = r2_score(
        y_validation,
        predictions,
    )

    seen_mae = mean_absolute_error(
        y_validation[seen_brand_mask],
        predictions[seen_brand_mask],
    )

    unseen_mae = mean_absolute_error(
        y_validation[unseen_brand_mask],
        predictions[unseen_brand_mask],
    )

    results.append({
        "experiment": name,
        "best_iteration":
            model.get_best_iteration(),

        "MAE":
            overall_mae,

        "RMSE":
            overall_rmse,

        "R2":
            overall_r2,

        "seen_brand_MAE":
            seen_mae,

        "unseen_brand_MAE":
            unseen_mae,
    })

    print(
        f"Best iteration:   "
        f"{model.get_best_iteration()}"
    )

    print(
        f"Overall MAE:      "
        f"{overall_mae:.4f}"
    )

    print(
        f"Overall RMSE:     "
        f"{overall_rmse:.4f}"
    )

    print(
        f"R2:               "
        f"{overall_r2:.4f}"
    )

    print(
        f"Seen-brand MAE:   "
        f"{seen_mae:.4f}"
    )

    print(
        f"Unseen-brand MAE: "
        f"{unseen_mae:.4f}"
    )

results_df = pd.DataFrame(results)

results_df = results_df.sort_values(
    "MAE"
)

print("\n" + "=" * 90)
print("FINAL ABLATION COMPARISON")
print("=" * 90)

print(
    results_df
    .round(4)
    .to_string(index=False)
)

results_df.to_csv(
    "data/ablation_results.csv",
    index=False,
)

print(
    "\nSaved locally: "
    "data/ablation_results.csv"
)

print("\n" + "=" * 90)
print("ABLATION COMPLETE")
print("=" * 90)
