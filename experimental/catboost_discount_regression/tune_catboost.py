import time

import pandas as pd

from catboost import CatBoostRegressor
from sklearn.metrics import (
    mean_absolute_error,
    root_mean_squared_error,
    r2_score,
)

TRAIN_PATH = "data/train_specials.csv"
VALIDATION_PATH = "data/validation_specials.csv"

print("=" * 90)
print("DISCOUNTMATE - CATBOOST HYPERPARAMETER TUNING")
print("=" * 90)

train_df = pd.read_csv(
    TRAIN_PATH,
    low_memory=False,
)

validation_df = pd.read_csv(
    VALIDATION_PATH,
    low_memory=False,
)

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

features = (
    categorical_features
    + numerical_features
)

X_train = train_df[features].copy()
y_train = train_df[TARGET].copy()

X_validation = validation_df[features].copy()
y_validation = validation_df[TARGET].copy()

# ---------------------------------------------------------------
# Clean data
# ---------------------------------------------------------------
for column in categorical_features:

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

for column in numerical_features:

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
        X_train[column]
        .fillna(median)
    )

    X_validation[column] = (
        X_validation[column]
        .fillna(median)
    )

# ---------------------------------------------------------------
# Controlled experiments
# ---------------------------------------------------------------
experiments = [

    {
        "name": "baseline_d8_lr005",
        "depth": 8,
        "learning_rate": 0.05,
        "l2_leaf_reg": 5,
    },

    {
        "name": "shallower_d6",
        "depth": 6,
        "learning_rate": 0.05,
        "l2_leaf_reg": 5,
    },

    {
        "name": "deeper_d10",
        "depth": 10,
        "learning_rate": 0.05,
        "l2_leaf_reg": 5,
    },

    {
        "name": "stronger_regularisation",
        "depth": 8,
        "learning_rate": 0.05,
        "l2_leaf_reg": 10,
    },

    {
        "name": "slower_learning",
        "depth": 8,
        "learning_rate": 0.03,
        "l2_leaf_reg": 5,
    },

    {
        "name": "faster_learning",
        "depth": 8,
        "learning_rate": 0.08,
        "l2_leaf_reg": 5,
    },
]

results = []

for experiment in experiments:

    print("\n" + "=" * 90)
    print(
        f"EXPERIMENT: "
        f"{experiment['name']}"
    )
    print("=" * 90)

    start_time = time.time()

    model = CatBoostRegressor(
        loss_function="RMSE",
        eval_metric="RMSE",
        iterations=1500,

        depth=experiment["depth"],
        learning_rate=(
            experiment["learning_rate"]
        ),
        l2_leaf_reg=(
            experiment["l2_leaf_reg"]
        ),

        random_seed=42,
        verbose=False,
        allow_writing_files=False,
    )

    model.fit(
        X_train,
        y_train,

        cat_features=categorical_features,

        eval_set=(
            X_validation,
            y_validation,
        ),

        early_stopping_rounds=120,
        use_best_model=True,
    )

    predictions = model.predict(
        X_validation
    )

    mae = mean_absolute_error(
        y_validation,
        predictions,
    )

    rmse = root_mean_squared_error(
        y_validation,
        predictions,
    )

    r2 = r2_score(
        y_validation,
        predictions,
    )

    elapsed = time.time() - start_time

    result = {
        "experiment":
            experiment["name"],

        "depth":
            experiment["depth"],

        "learning_rate":
            experiment["learning_rate"],

        "l2_leaf_reg":
            experiment["l2_leaf_reg"],

        "best_iteration":
            model.get_best_iteration(),

        "MAE":
            mae,

        "RMSE":
            rmse,

        "R2":
            r2,

        "seconds":
            elapsed,
    }

    results.append(result)

    print(
        f"Best iteration: "
        f"{result['best_iteration']}"
    )

    print(
        f"MAE:            "
        f"{mae:.4f}"
    )

    print(
        f"RMSE:           "
        f"{rmse:.4f}"
    )

    print(
        f"R2:             "
        f"{r2:.4f}"
    )

    print(
        f"Training time:  "
        f"{elapsed:.1f} sec"
    )

# ---------------------------------------------------------------
# Ranking
# ---------------------------------------------------------------
results_df = pd.DataFrame(
    results
)

results_df = results_df.sort_values(
    ["MAE", "RMSE"],
    ascending=True,
)

print("\n" + "=" * 90)
print("FINAL TUNING RESULTS")
print("=" * 90)

print(
    results_df
    .round(4)
    .to_string(index=False)
)

winner = results_df.iloc[0]

print("\n" + "-" * 90)
print("BEST CONFIGURATION")
print("-" * 90)

print(
    f"Experiment:    "
    f"{winner['experiment']}"
)

print(
    f"Depth:         "
    f"{int(winner['depth'])}"
)

print(
    f"Learning rate: "
    f"{winner['learning_rate']}"
)

print(
    f"L2 leaf reg:   "
    f"{winner['l2_leaf_reg']}"
)

print(
    f"Best MAE:      "
    f"{winner['MAE']:.4f}"
)

print(
    f"Best RMSE:     "
    f"{winner['RMSE']:.4f}"
)

print(
    f"Best R2:       "
    f"{winner['R2']:.4f}"
)

results_df.to_csv(
    "data/tuning_results.csv",
    index=False,
)

print(
    "\nSaved locally: "
    "data/tuning_results.csv"
)

print("\n" + "=" * 90)
print("TUNING COMPLETE")
print("=" * 90)
