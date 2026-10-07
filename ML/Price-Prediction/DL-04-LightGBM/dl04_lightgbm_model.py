from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

LOCAL_DEPS = Path(__file__).resolve().parent / ".python_deps"
if LOCAL_DEPS.exists():
    sys.path.insert(0, str(LOCAL_DEPS))

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor


# ============================================================
# CONFIGURATION
# ============================================================

CATEGORICAL_FEATURES = [
    "product_id",
    "retailer_id",
]

NUMERIC_FEATURES = [
    "price",
    "unit_price",
    "unit_price_missing",
    "is_on_special",
    "has_special_text",
    "discount_percent",
    "discount_amount",
    "recorded_month",
    "recorded_day_of_week",
    "recorded_day_of_month",
    "previous_price",
    "previous_unit_price",
    "previous_is_on_special",
    "days_since_previous_observation",
    "previous_price_change",
    "previous_price_change_pct",
    "observation_number",
]

FEATURE_COLUMNS = CATEGORICAL_FEATURES + NUMERIC_FEATURES

TARGET_COLUMN = "target_next_price"
TARGET_CHANGE_COLUMN = "target_price_change"

MODEL_VARIANTS = [
    {
        "name": "lightgbm_direct_all_features",
        "target": TARGET_COLUMN,
        "features": FEATURE_COLUMNS,
        "prediction_mode": "direct",
    },
    {
        "name": "lightgbm_direct_numeric_features",
        "target": TARGET_COLUMN,
        "features": NUMERIC_FEATURES,
        "prediction_mode": "direct",
    },
    {
        "name": "lightgbm_residual_all_features",
        "target": TARGET_CHANGE_COLUMN,
        "features": FEATURE_COLUMNS,
        "prediction_mode": "residual",
    },
    {
        "name": "lightgbm_residual_numeric_features",
        "target": TARGET_CHANGE_COLUMN,
        "features": NUMERIC_FEATURES,
        "prediction_mode": "residual",
    },
]


# ============================================================
# ARGUMENTS
# ============================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train and evaluate DL-04 LightGBM next-price models."
    )

    parser.add_argument(
        "--input",
        required=True,
        help="Path to dl04_next_price_training_dataset.csv",
    )

    parser.add_argument(
        "--baseline-results",
        required=True,
        help="Path to dl04_baseline_results.csv",
    )

    parser.add_argument(
        "--output-dir",
        required=True,
        help="Directory for model outputs.",
    )

    return parser.parse_args()


# ============================================================
# METRICS
# ============================================================

def smape(
    actual: pd.Series,
    predicted: pd.Series,
) -> float:
    actual = pd.to_numeric(actual, errors="coerce")
    predicted = pd.to_numeric(predicted, errors="coerce")

    denominator = (actual.abs() + predicted.abs()) / 2

    values = np.where(
        denominator == 0,
        0,
        (actual - predicted).abs() / denominator,
    )

    return float(np.nanmean(values) * 100)


def trend_label(
    delta: pd.Series,
    threshold: float = 0.05,
) -> pd.Series:
    return pd.Series(
        np.select(
            [
                delta > threshold,
                delta < -threshold,
            ],
            [
                "up",
                "down",
            ],
            default="stable",
        ),
        index=delta.index,
    )


def directional_accuracy(
    actual: pd.Series,
    predicted: pd.Series,
    current_price: pd.Series,
) -> float:

    actual_trend = trend_label(
        actual - current_price
    )

    predicted_trend = trend_label(
        predicted - current_price
    )

    return float(
        (actual_trend == predicted_trend).mean()
    )


def evaluate(
    part: pd.DataFrame,
    prediction_col: str,
    model_name: str,
) -> dict:

    actual = pd.to_numeric(
        part[TARGET_COLUMN],
        errors="coerce",
    )

    predicted = pd.to_numeric(
        part[prediction_col],
        errors="coerce",
    )

    valid = actual.notna() & predicted.notna()

    actual = actual[valid]
    predicted = predicted[valid]

    current_price = pd.to_numeric(
        part.loc[valid, "price"],
        errors="coerce",
    )

    mae = float(
        np.mean(
            np.abs(
                actual.to_numpy()
                - predicted.to_numpy()
            )
        )
    )

    rmse = math.sqrt(
        float(
            np.mean(
                (
                    actual.to_numpy()
                    - predicted.to_numpy()
                ) ** 2
            )
        )
    )

    return {
        "split": str(part["split"].iloc[0]),
        "model": model_name,
        "rows": int(len(actual)),
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "smape_percent": round(
            smape(actual, predicted),
            2,
        ),
        "directional_accuracy": round(
            directional_accuracy(
                actual,
                predicted,
                current_price,
            ),
            4,
        ),
    }


# ============================================================
# FEATURE PREPARATION
# ============================================================

def prepare_features(
    df: pd.DataFrame,
    feature_columns: list[str],
) -> pd.DataFrame:

    missing = [
        column
        for column in feature_columns
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            "Training dataset is missing required model features: "
            + ", ".join(missing)
        )

    X = df[feature_columns].copy()

    for column in CATEGORICAL_FEATURES:
        if column in X.columns:
            X[column] = (
                X[column]
                .fillna("unknown")
                .astype(str)
                .astype("category")
            )

    for column in NUMERIC_FEATURES:
        if column not in X.columns:
            continue

        if X[column].dtype == "bool":
            X[column] = X[column].astype(int)

        X[column] = pd.to_numeric(
            X[column],
            errors="coerce",
        )

        X[column] = X[column].fillna(0)

    return X


# ============================================================
# TIME SPLIT FALLBACK
# ============================================================

def create_time_split(
    df: pd.DataFrame,
) -> pd.DataFrame:

    if "split" in df.columns:
        return df

    df = df.copy()

    df["recorded_at"] = pd.to_datetime(
        df["recorded_at"],
        format="mixed",
        utc=True,
        errors="coerce",
    )

    if df["recorded_at"].isna().all():
        raise ValueError(
            "Could not parse recorded_at values."
        )

    dates = (
        df["recorded_at"]
        .dt.floor("D")
        .dropna()
        .sort_values()
        .unique()
    )

    if len(dates) < 3:
        raise ValueError(
            "At least 3 distinct dates are required "
            "for train/validation/test splitting."
        )

    train_end = dates[
        max(0, int(len(dates) * 0.60) - 1)
    ]

    validation_end = dates[
        max(1, int(len(dates) * 0.80) - 1)
    ]

    df["split"] = np.select(
        [
            df["recorded_at"].dt.floor("D") <= train_end,
            df["recorded_at"].dt.floor("D") <= validation_end,
        ],
        [
            "train",
            "validation",
        ],
        default="test",
    )

    return df


# ============================================================
# MARKDOWN
# ============================================================

def dataframe_to_markdown(
    df: pd.DataFrame,
) -> str:

    if df.empty:
        return "_No results._"

    headers = list(df.columns)

    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(headers)) + " |",
    ]

    for row in df.to_numpy():
        lines.append(
            "| "
            + " | ".join(str(value) for value in row)
            + " |"
        )

    return "\n".join(lines)


# ============================================================
# TRAINING
# ============================================================

def train_variant(
    train: pd.DataFrame,
    variant: dict,
) -> LGBMRegressor:

    X_train = prepare_features(
        train,
        variant["features"],
    )

    y_train = pd.to_numeric(
        train[variant["target"]],
        errors="coerce",
    )

    valid_rows = y_train.notna()

    X_train = X_train.loc[valid_rows]
    y_train = y_train.loc[valid_rows]

    categorical = [
        column
        for column in CATEGORICAL_FEATURES
        if column in variant["features"]
    ]

    model = LGBMRegressor(
        objective="regression_l1",
        n_estimators=150,
        learning_rate=0.03,
        num_leaves=15,
        max_depth=-1,
        min_child_samples=15,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_alpha=0.05,
        reg_lambda=0.10,
        random_state=42,
        n_jobs=1,
        verbose=-1,
    )

    model.fit(
        X_train,
        y_train,
        categorical_feature=categorical,
    )

    return model


# ============================================================
# SCORING
# ============================================================

def score_variant(
    model: LGBMRegressor,
    part: pd.DataFrame,
    variant: dict,
) -> pd.DataFrame:

    scored = part.copy()

    raw_prediction = model.predict(
        prepare_features(
            scored,
            variant["features"],
        )
    )

    if variant["prediction_mode"] == "residual":
        prediction = (
            scored["price"].to_numpy()
            + raw_prediction
        )
    else:
        prediction = raw_prediction

    prediction = np.maximum(
        prediction,
        0,
    )

    prediction_column = (
        f"{variant['name']}_predicted_next_price"
    )

    error_column = (
        f"{variant['name']}_prediction_error"
    )

    scored[prediction_column] = prediction

    scored[error_column] = (
        scored[TARGET_COLUMN]
        - scored[prediction_column]
    )

    return scored


# ============================================================
# HORIZON FEATURES
# ============================================================

def add_horizon_features(
    df: pd.DataFrame,
) -> pd.DataFrame:

    df = df.copy()

    if "target_next_recorded_at" in df.columns:

        df["target_next_recorded_at"] = pd.to_datetime(
            df["target_next_recorded_at"],
            format="mixed",
            utc=True,
            errors="coerce",
        )

        df["target_days_ahead"] = (
            (
                df["target_next_recorded_at"]
                - df["recorded_at"]
            )
            .dt.total_seconds()
            / 86400
        )

    elif "target_days_ahead" not in df.columns:

        df["target_days_ahead"] = np.nan

    df["target_days_ahead"] = pd.to_numeric(
        df["target_days_ahead"],
        errors="coerce",
    )

    df["actual_price_change"] = (
        df[TARGET_COLUMN]
        - df["price"]
    )

    df["abs_actual_price_change"] = (
        df["actual_price_change"].abs()
    )

    df["price_changed"] = (
        df["abs_actual_price_change"] > 0.05
    )

    df["price_change_direction"] = np.select(
        [
            df["actual_price_change"] > 0.05,
            df["actual_price_change"] < -0.05,
        ],
        [
            "up",
            "down",
        ],
        default="stable",
    )

    return df


# ============================================================
# HD ANALYSIS 1:
# PAIRED BASELINE VS LIGHTGBM
# ============================================================

def build_paired_comparison(
    scored: pd.DataFrame,
) -> pd.DataFrame:

    test = scored[
        scored["split"] == "test"
    ].copy()

    if test.empty:
        return pd.DataFrame()

    test["baseline_prediction"] = test["price"]

    test["baseline_abs_error"] = (
        test[TARGET_COLUMN]
        - test["baseline_prediction"]
    ).abs()

    test["lightgbm_abs_error"] = (
        test[TARGET_COLUMN]
        - test["lightgbm_predicted_next_price"]
    ).abs()

    test["ml_wins"] = (
        test["lightgbm_abs_error"]
        < test["baseline_abs_error"]
    )

    test["baseline_wins"] = (
        test["baseline_abs_error"]
        < test["lightgbm_abs_error"]
    )

    test["tie"] = (
        test["baseline_abs_error"]
        == test["lightgbm_abs_error"]
    )

    return pd.DataFrame(
        [
            {
                "split": "test",
                "rows": len(test),
                "baseline_mae": round(
                    test["baseline_abs_error"].mean(),
                    4,
                ),
                "lightgbm_mae": round(
                    test["lightgbm_abs_error"].mean(),
                    4,
                ),
                "ml_win_rate": round(
                    test["ml_wins"].mean(),
                    4,
                ),
                "baseline_win_rate": round(
                    test["baseline_wins"].mean(),
                    4,
                ),
                "tie_rate": round(
                    test["tie"].mean(),
                    4,
                ),
                "mean_mae_improvement": round(
                    (
                        test["baseline_abs_error"]
                        - test["lightgbm_abs_error"]
                    ).mean(),
                    4,
                ),
            }
        ]
    )


# ============================================================
# HD ANALYSIS 2:
# STABLE VS CHANGED PRICES
# ============================================================

def evaluate_regime(
    df: pd.DataFrame,
    mask: pd.Series,
    regime_name: str,
) -> dict:

    part = df.loc[mask].copy()

    if part.empty:
        return {
            "regime": regime_name,
            "rows": 0,
            "baseline_mae": np.nan,
            "lightgbm_mae": np.nan,
            "ml_win_rate": np.nan,
        }

    baseline_error = (
        part[TARGET_COLUMN]
        - part["price"]
    ).abs()

    ml_error = (
        part[TARGET_COLUMN]
        - part["lightgbm_predicted_next_price"]
    ).abs()

    return {
        "regime": regime_name,
        "rows": int(len(part)),
        "baseline_mae": round(
            float(baseline_error.mean()),
            4,
        ),
        "lightgbm_mae": round(
            float(ml_error.mean()),
            4,
        ),
        "ml_win_rate": round(
            float(
                (
                    ml_error
                    < baseline_error
                ).mean()
            ),
            4,
        ),
    }


def build_regime_analysis(
    scored: pd.DataFrame,
) -> pd.DataFrame:

    test = scored[
        scored["split"] == "test"
    ].copy()

    if test.empty:
        return pd.DataFrame()

    test["price_change_abs"] = (
        test[TARGET_COLUMN]
        - test["price"]
    ).abs()

    test["is_changed"] = (
        test["price_change_abs"] > 0.05
    )

    rows = [
        evaluate_regime(
            test,
            ~test["is_changed"],
            "stable_price",
        ),
        evaluate_regime(
            test,
            test["is_changed"],
            "price_changed",
        ),
        evaluate_regime(
            test,
            test["actual_price_change"] > 0.05,
            "price_increase",
        ),
        evaluate_regime(
            test,
            test["actual_price_change"] < -0.05,
            "price_decrease",
        ),
    ]

    return pd.DataFrame(rows)


# ============================================================
# HD ANALYSIS 3:
# PROMOTION REGIMES
# ============================================================

def build_promotion_analysis(
    scored: pd.DataFrame,
) -> pd.DataFrame:

    test = scored[
        scored["split"] == "test"
    ].copy()

    if test.empty:
        return pd.DataFrame()

    test["promotion_flag"] = (
        (
            pd.to_numeric(
                test["is_on_special"],
                errors="coerce",
            )
            .fillna(0)
            .astype(float)
            > 0
        )
        | (
            pd.to_numeric(
                test["has_special_text"],
                errors="coerce",
            )
            .fillna(0)
            .astype(float)
            > 0
        )
    )

    rows = []

    for flag, name in [
        (False, "non_promotion"),
        (True, "promotion"),
    ]:

        part = test[
            test["promotion_flag"] == flag
        ]

        if part.empty:
            continue

        baseline_error = (
            part[TARGET_COLUMN]
            - part["price"]
        ).abs()

        ml_error = (
            part[TARGET_COLUMN]
            - part["lightgbm_predicted_next_price"]
        ).abs()

        rows.append(
            {
                "regime": name,
                "rows": int(len(part)),
                "baseline_mae": round(
                    float(baseline_error.mean()),
                    4,
                ),
                "lightgbm_mae": round(
                    float(ml_error.mean()),
                    4,
                ),
                "ml_win_rate": round(
                    float(
                        (
                            ml_error
                            < baseline_error
                        ).mean()
                    ),
                    4,
                ),
            }
        )

    return pd.DataFrame(rows)


# ============================================================
# HD ANALYSIS 4:
# HORIZON BUCKETS
# ============================================================

def horizon_bucket(
    value: float,
) -> str:

    if pd.isna(value):
        return "unknown"

    if value <= 1.05:
        return "0-1.05d"

    if value <= 1.50:
        return "1.05-1.50d"

    if value <= 2.50:
        return "1.50-2.50d"

    return ">2.50d"


def build_horizon_analysis(
    scored: pd.DataFrame,
) -> pd.DataFrame:

    test = scored[
        scored["split"] == "test"
    ].copy()

    if test.empty:
        return pd.DataFrame()

    test["horizon_bucket"] = (
        test["target_days_ahead"]
        .apply(horizon_bucket)
    )

    rows = []

    order = [
        "0-1.05d",
        "1.05-1.50d",
        "1.50-2.50d",
        ">2.50d",
        "unknown",
    ]

    for bucket in order:

        part = test[
            test["horizon_bucket"] == bucket
        ]

        if part.empty:
            continue

        baseline_error = (
            part[TARGET_COLUMN]
            - part["price"]
        ).abs()

        ml_error = (
            part[TARGET_COLUMN]
            - part["lightgbm_predicted_next_price"]
        ).abs()

        rows.append(
            {
                "horizon_bucket": bucket,
                "rows": int(len(part)),
                "mean_horizon_days": round(
                    float(
                        part["target_days_ahead"]
                        .mean()
                    ),
                    4,
                ),
                "baseline_mae": round(
                    float(baseline_error.mean()),
                    4,
                ),
                "lightgbm_mae": round(
                    float(ml_error.mean()),
                    4,
                ),
                "ml_win_rate": round(
                    float(
                        (
                            ml_error
                            < baseline_error
                        ).mean()
                    ),
                    4,
                ),
            }
        )

    return pd.DataFrame(rows)


# ============================================================
# HD ANALYSIS 5:
# ADAPTIVE BLENDING
# ============================================================

def evaluate_blend(
    scored: pd.DataFrame,
    weight: float,
) -> dict:

    test = scored[
        scored["split"] == "test"
    ].copy()

    if test.empty:
        return {}

    baseline = test["price"].to_numpy()

    ml = (
        test["lightgbm_predicted_next_price"]
        .to_numpy()
    )

    actual = (
        test[TARGET_COLUMN]
        .to_numpy()
    )

    prediction = (
        weight * ml
        + (1 - weight) * baseline
    )

    error = np.abs(
        actual - prediction
    )

    return {
        "ml_weight": weight,
        "baseline_weight": round(
            1 - weight,
            2,
        ),
        "rows": len(test),
        "mae": round(
            float(error.mean()),
            4,
        ),
        "rmse": round(
            float(
                np.sqrt(
                    np.mean(
                        (
                            actual
                            - prediction
                        ) ** 2
                    )
                )
            ),
            4,
        ),
    }


def build_blend_analysis(
    scored: pd.DataFrame,
) -> pd.DataFrame:

    rows = []

    for weight in np.arange(
        0.0,
        1.01,
        0.10,
    ):
        rows.append(
            evaluate_blend(
                scored,
                round(float(weight), 2),
            )
        )

    return pd.DataFrame(rows)


# ============================================================
# JSON PREDICTION
# ============================================================

def make_prediction_json(
    row: pd.Series,
) -> dict:

    predicted_price = float(
        row["lightgbm_predicted_next_price"]
    )

    current_price = float(
        row["price"]
    )

    delta = (
        predicted_price
        - current_price
    )

    if delta > 0.05:
        trend = "up"
    elif delta < -0.05:
        trend = "down"
    else:
        trend = "stable"

    return {
        "product_id": str(
            row["product_id"]
        ),
        "retailer_id": str(
            row["retailer_id"]
        ),
        "recorded_at": str(
            row["recorded_at"]
        ),
        "current_price": round(
            current_price,
            2,
        ),
        "predicted_next_price": round(
            predicted_price,
            2,
        ),
        "predicted_change": round(
            delta,
            2,
        ),
        "trend": trend,
        "model_info": {
            "model_type": "lightgbm_regression",
            "target": TARGET_COLUMN,
            "selected_variant": "validation_mae",
            "status": "experimental",
        },
    }


# ============================================================
# MAIN
# ============================================================

def main() -> None:

    args = parse_args()

    input_path = Path(
        args.input
    )

    baseline_path = Path(
        args.baseline_results
    )

    output_dir = Path(
        args.output_dir
    )

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    print("=" * 70)
    print("DL-04 LIGHTGBM MODEL TRAINING + HD EVALUATION")
    print("=" * 70)

    print()
    print(f"Input: {input_path}")
    print(f"Baseline: {baseline_path}")
    print(f"Output: {output_dir}")
    print()

    # --------------------------------------------------------
    # Load dataset
    # --------------------------------------------------------

    df = pd.read_csv(
        input_path
    )

    print(
        f"Rows loaded: {len(df):,}"
    )

    df["recorded_at"] = pd.to_datetime(
        df["recorded_at"],
        format="mixed",
        utc=True,
        errors="coerce",
    )

    if df["recorded_at"].isna().any():
        raise ValueError(
            "Invalid recorded_at values detected."
        )

    if "target_next_recorded_at" in df.columns:

        df["target_next_recorded_at"] = pd.to_datetime(
            df["target_next_recorded_at"],
            format="mixed",
            utc=True,
            errors="coerce",
        )

    required_columns = [
        "product_id",
        "retailer_id",
        "recorded_at",
        "price",
        "target_next_price",
        "target_price_change",
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "Training dataset is missing required columns: "
            + ", ".join(missing_columns)
        )

    df = add_horizon_features(
        df
    )

    df = create_time_split(
        df
    )

    print()
    print("Split:")
    print(
        df["split"]
        .value_counts()
        .sort_index()
        .to_string()
    )

    print()
    print("Date ranges:")

    for split_name in [
        "train",
        "validation",
        "test",
    ]:

        part = df[
            df["split"] == split_name
        ]

        if part.empty:
            print(
                f"{split_name:<12}: EMPTY"
            )
            continue

        print(
            f"{split_name:<12}: "
            f"{part['recorded_at'].min()} -> "
            f"{part['recorded_at'].max()}"
        )

    # --------------------------------------------------------
    # Load baseline
    # --------------------------------------------------------

    baseline_results = pd.read_csv(
        baseline_path
    )

    # --------------------------------------------------------
    # Split
    # --------------------------------------------------------

    train = df[
        df["split"] == "train"
    ].copy()

    validation = df[
        df["split"] == "validation"
    ].copy()

    test = df[
        df["split"] == "test"
    ].copy()

    if train.empty:
        raise ValueError(
            "Training split is empty."
        )

    if validation.empty:
        raise ValueError(
            "Validation split is empty."
        )

    if test.empty:
        raise ValueError(
            "Test split is empty."
        )

    # --------------------------------------------------------
    # Train variants
    # --------------------------------------------------------

    scored_parts = []

    trained_variants = {}

    variant_results = []

    variant_feature_importance = []

    print()
    print("=" * 70)
    print("TRAINING LIGHTGBM VARIANTS")
    print("=" * 70)

    for variant in MODEL_VARIANTS:

        print()
        print(
            f"Training: {variant['name']}"
        )

        model = train_variant(
            train,
            variant,
        )

        trained_variants[
            variant["name"]
        ] = {
            "model": model,
            "variant": variant,
        }

        for part in [
            train,
            validation,
            test,
        ]:

            scored = score_variant(
                model,
                part,
                variant,
            )

            prediction_col = (
                f"{variant['name']}_predicted_next_price"
            )

            variant_results.append(
                evaluate(
                    scored,
                    prediction_col,
                    variant["name"],
                )
            )

        feature_importance = pd.DataFrame(
            {
                "model": variant["name"],
                "feature": variant["features"],
                "importance": model.feature_importances_,
            }
        )

        variant_feature_importance.append(
            feature_importance
        )

    variant_results_df = pd.DataFrame(
        variant_results
    )

    # --------------------------------------------------------
    # Select model ONLY using validation
    # --------------------------------------------------------

    validation_results = variant_results_df[
        variant_results_df["split"]
        == "validation"
    ].copy()

    best_variant_name = (
        validation_results
        .sort_values("mae")
        .iloc[0]["model"]
    )

    best_variant = trained_variants[
        best_variant_name
    ]["variant"]

    best_model = trained_variants[
        best_variant_name
    ]["model"]

    print()
    print("=" * 70)
    print("BEST LIGHTGBM VARIANT")
    print("=" * 70)

    print(
        f"Selected model: {best_variant_name}"
    )

    print(
        "Selection metric: validation MAE"
    )

    # --------------------------------------------------------
    # Score selected model
    # --------------------------------------------------------

    for part in [
        train,
        validation,
        test,
    ]:

        scored = score_variant(
            best_model,
            part,
            best_variant,
        )

        scored[
            "lightgbm_predicted_next_price"
        ] = scored[
            f"{best_variant_name}_predicted_next_price"
        ]

        scored[
            "lightgbm_prediction_error"
        ] = scored[
            f"{best_variant_name}_prediction_error"
        ]

        scored_parts.append(
            scored
        )

    scored_df = pd.concat(
        scored_parts,
        ignore_index=True,
    )

    # --------------------------------------------------------
    # Final model results
    # --------------------------------------------------------

    lightgbm_results = pd.DataFrame(
        [
            evaluate(
                part,
                "lightgbm_predicted_next_price",
                "lightgbm_regression",
            )
            for _, part in scored_df.groupby(
                "split",
                sort=False,
            )
        ]
    )

    # --------------------------------------------------------
    # Baseline comparison
    # --------------------------------------------------------

    comparison = pd.concat(
        [
            baseline_results,
            lightgbm_results,
        ],
        ignore_index=True,
    )

    comparison = (
        comparison
        .sort_values(
            ["split", "mae"]
        )
        .reset_index(drop=True)
    )

    # --------------------------------------------------------
    # Feature importance
    # --------------------------------------------------------

    importance = (
        pd.concat(
            variant_feature_importance,
            ignore_index=True,
        )
        .sort_values(
            ["model", "importance"],
            ascending=[
                True,
                False,
            ],
        )
        .reset_index(drop=True)
    )

    best_importance = (
        importance[
            importance["model"]
            == best_variant_name
        ]
        .sort_values(
            "importance",
            ascending=False,
        )
    )

    # ========================================================
    # HD EVALUATION
    # ========================================================

    print()
    print("=" * 70)
    print("HD-LEVEL EVALUATION")
    print("=" * 70)

    paired_comparison = (
        build_paired_comparison(
            scored_df
        )
    )

    regime_analysis = (
        build_regime_analysis(
            scored_df
        )
    )

    promotion_analysis = (
        build_promotion_analysis(
            scored_df
        )
    )

    horizon_analysis = (
        build_horizon_analysis(
            scored_df
        )
    )

    blend_analysis = (
        build_blend_analysis(
            scored_df
        )
    )

    print()
    print("Paired baseline comparison:")

    if not paired_comparison.empty:
        print(
            paired_comparison.to_string(
                index=False
            )
        )

    print()
    print("Price-change regimes:")

    if not regime_analysis.empty:
        print(
            regime_analysis.to_string(
                index=False
            )
        )

    print()
    print("Promotion regimes:")

    if not promotion_analysis.empty:
        print(
            promotion_analysis.to_string(
                index=False
            )
        )

    print()
    print("Horizon analysis:")

    if not horizon_analysis.empty:
        print(
            horizon_analysis.to_string(
                index=False
            )
        )

    print()
    print("Blend analysis:")

    if not blend_analysis.empty:
        print(
            blend_analysis.to_string(
                index=False
            )
        )

    # --------------------------------------------------------
    # Best blend
    # --------------------------------------------------------

    if not blend_analysis.empty:

        best_blend_row = (
            blend_analysis
            .sort_values("mae")
            .iloc[0]
        )

        best_blend_weight = float(
            best_blend_row["ml_weight"]
        )

    else:

        best_blend_weight = 0.0

    # --------------------------------------------------------
    # Output paths
    # --------------------------------------------------------

    model_path = (
        output_dir
        / "dl04_lightgbm_model.joblib"
    )

    predictions_path = (
        output_dir
        / "dl04_lightgbm_predictions.csv"
    )

    results_path = (
        output_dir
        / "dl04_lightgbm_results.csv"
    )

    comparison_path = (
        output_dir
        / "dl04_model_comparison.csv"
    )

    importance_path = (
        output_dir
        / "dl04_lightgbm_feature_importance.csv"
    )

    variant_results_path = (
        output_dir
        / "dl04_lightgbm_variant_results.csv"
    )

    json_path = (
        output_dir
        / "dl04_lightgbm_sample_predictions.json"
    )

    paired_path = (
        output_dir
        / "dl04_hd_paired_comparison.csv"
    )

    regime_path = (
        output_dir
        / "dl04_hd_regime_analysis.csv"
    )

    promotion_path = (
        output_dir
        / "dl04_hd_promotion_analysis.csv"
    )

    horizon_path = (
        output_dir
        / "dl04_hd_horizon_analysis.csv"
    )

    blend_path = (
        output_dir
        / "dl04_hd_blend_analysis.csv"
    )

    report_path = (
        output_dir
        / "DL-04-T9_HD_Evaluation_Report.md"
    )

    # --------------------------------------------------------
    # Save model
    # --------------------------------------------------------

    joblib.dump(
        {
            "model": best_model,
            "variant": best_variant,
            "feature_columns": best_variant[
                "features"
            ],
            "categorical_features": [
                column
                for column in CATEGORICAL_FEATURES
                if column
                in best_variant["features"]
            ],
            "target": TARGET_COLUMN,
            "selection_metric": "validation_mae",
        },
        model_path,
    )

    # --------------------------------------------------------
    # Save predictions
    # --------------------------------------------------------

    prediction_columns = [
        "product_id",
        "retailer_id",
        "recorded_at",
        "price",
        "target_next_price",
        "target_next_recorded_at",
        "target_days_ahead",
        "split",
        "lightgbm_predicted_next_price",
        "lightgbm_prediction_error",
    ]

    prediction_columns = [
        column
        for column in prediction_columns
        if column in scored_df.columns
    ]

    scored_df[
        prediction_columns
    ].to_csv(
        predictions_path,
        index=False,
    )

    # --------------------------------------------------------
    # Save evaluation files
    # --------------------------------------------------------

    lightgbm_results.to_csv(
        results_path,
        index=False,
    )

    variant_results_df.to_csv(
        variant_results_path,
        index=False,
    )

    comparison.to_csv(
        comparison_path,
        index=False,
    )

    importance.to_csv(
        importance_path,
        index=False,
    )

    paired_comparison.to_csv(
        paired_path,
        index=False,
    )

    regime_analysis.to_csv(
        regime_path,
        index=False,
    )

    promotion_analysis.to_csv(
        promotion_path,
        index=False,
    )

    horizon_analysis.to_csv(
        horizon_path,
        index=False,
    )

    blend_analysis.to_csv(
        blend_path,
        index=False,
    )

    # --------------------------------------------------------
    # JSON samples
    # --------------------------------------------------------

    test_sample = scored_df[
        scored_df["split"] == "test"
    ].head(10)

    sample_json = [
        make_prediction_json(row)
        for _, row in test_sample.iterrows()
    ]

    json_path.write_text(
        json.dumps(
            sample_json,
            indent=2,
        ),
        encoding="utf-8",
    )

    # --------------------------------------------------------
    # Test metrics
    # --------------------------------------------------------

    baseline_test_rows = baseline_results[
        (
            baseline_results["split"]
            == "test"
        )
        & (
            baseline_results["model"]
            == "last_known_price"
        )
    ]

    lightgbm_test_rows = lightgbm_results[
        lightgbm_results["split"]
        == "test"
    ]

    if baseline_test_rows.empty:
        raise ValueError(
            "No last_known_price test baseline result found."
        )

    if lightgbm_test_rows.empty:
        raise ValueError(
            "No LightGBM test result found."
        )

    baseline_test_mae = float(
        baseline_test_rows[
            "mae"
        ].iloc[0]
    )

    lightgbm_test_mae = float(
        lightgbm_test_rows[
            "mae"
        ].iloc[0]
    )

    test_difference = (
        lightgbm_test_mae
        - baseline_test_mae
    )

    # --------------------------------------------------------
    # Scientific conclusion
    # --------------------------------------------------------

    if lightgbm_test_mae < baseline_test_mae:

        conclusion = (
            "LightGBM outperformed the persistence baseline "
            "on the untouched test split."
        )

    else:

        conclusion = (
            "LightGBM did not outperform the persistence "
            "baseline on aggregate test MAE. This does not "
            "mean the model has no value: the HD evaluation "
            "examines whether ML provides value specifically "
            "during price changes, promotions, and different "
            "forecast horizons."
        )

    # --------------------------------------------------------
    # T9 report
    # --------------------------------------------------------

    report_lines = [
        "# DL-04-T9 HD Evaluation Report",
        "",
        "## Research Objective",
        "",
        (
            "Evaluate whether LightGBM provides predictive "
            "value beyond a last-known-price persistence "
            "baseline for next-price forecasting."
        ),
        "",
        "## Dataset",
        "",
        f"- Input rows: {len(df):,}",
        f"- Products: {df['product_id'].nunique():,}",
        f"- Product-retailer series: "
        f"{df[['product_id', 'retailer_id']].drop_duplicates().shape[0]:,}",
        f"- Training rows: {len(train):,}",
        f"- Validation rows: {len(validation):,}",
        f"- Test rows: {len(test):,}",
        "",
        "## Experimental Protocol",
        "",
        "- Model selection uses validation MAE only.",
        "- Test data is reserved for final evaluation.",
        "- Persistence baseline predicts the current price.",
        "- LightGBM predicts the next observed price.",
        "- Residual modelling predicts price change relative to current price.",
        "",
        "## Selected Model",
        "",
        f"- Selected variant: `{best_variant_name}`",
        "- Selection metric: validation MAE",
        "- Objective: LightGBM regression with L1 loss",
        "",
        "## Aggregate Results",
        "",
        dataframe_to_markdown(
            comparison
        ),
        "",
        "## Paired Test Comparison",
        "",
        dataframe_to_markdown(
            paired_comparison
        ),
        "",
        "## Price-Change Regime Analysis",
        "",
        dataframe_to_markdown(
            regime_analysis
        ),
        "",
        "## Promotion Regime Analysis",
        "",
        dataframe_to_markdown(
            promotion_analysis
        ),
        "",
        "## Forecast-Horizon Analysis",
        "",
        dataframe_to_markdown(
            horizon_analysis
        ),
        "",
        "## Blend Experiment",
        "",
        (
            "A simple convex blend was evaluated to determine "
            "whether combining persistence and ML can provide "
            "a more robust forecast."
        ),
        "",
        dataframe_to_markdown(
            blend_analysis
        ),
        "",
        f"- Best ML blend weight: `{best_blend_weight:.2f}`",
        "",
        "## Feature Importance",
        "",
        dataframe_to_markdown(
            best_importance.head(15)
        ),
        "",
        "## Test Interpretation",
        "",
        f"- Persistence test MAE: `{baseline_test_mae:.4f}`",
        f"- LightGBM test MAE: `{lightgbm_test_mae:.4f}`",
        f"- LightGBM minus baseline MAE: `{test_difference:.4f}`",
        "",
        conclusion,
        "",
        "## HD-Level Contribution",
        "",
        (
            "The contribution is not based solely on attempting "
            "to minimise aggregate MAE. The evaluation explicitly "
            "tests where machine learning is useful: changed-price "
            "regimes, price increases, price decreases, promotional "
            "observations, and different forecast horizons. "
            "This provides a more defensible assessment of whether "
            "a learned model adds value over persistence."
        ),
        "",
        "## Limitations",
        "",
        (
            "The dataset contains only a limited historical period "
            "and observations are sparse for some products. "
            "Consequently, persistence is a strong benchmark and "
            "generalisation to longer historical periods should "
            "be validated when additional snapshots become available."
        ),
        "",
        "## Generated Outputs",
        "",
        f"- `{model_path.name}`",
        f"- `{predictions_path.name}`",
        f"- `{results_path.name}`",
        f"- `{variant_results_path.name}`",
        f"- `{comparison_path.name}`",
        f"- `{importance_path.name}`",
        f"- `{json_path.name}`",
        f"- `{paired_path.name}`",
        f"- `{regime_path.name}`",
        f"- `{promotion_path.name}`",
        f"- `{horizon_path.name}`",
        f"- `{blend_path.name}`",
        "",
    ]

    report_path.write_text(
        "\n".join(report_lines),
        encoding="utf-8",
    )

    # ========================================================
    # CONSOLE SUMMARY
    # ========================================================

    print()
    print("=" * 70)
    print("LIGHTGBM RESULTS")
    print("=" * 70)

    print(
        lightgbm_results.to_string(
            index=False
        )
    )

    print()
    print("=" * 70)
    print("BASELINE VS LIGHTGBM")
    print("=" * 70)

    print(
        comparison.to_string(
            index=False
        )
    )

    print()
    print("=" * 70)
    print("HD CONTRIBUTION SUMMARY")
    print("=" * 70)

    print(
        f"Selected variant: {best_variant_name}"
    )

    print(
        f"Persistence test MAE: {baseline_test_mae:.4f}"
    )

    print(
        f"LightGBM test MAE: {lightgbm_test_mae:.4f}"
    )

    print(
        f"Best blend ML weight: {best_blend_weight:.2f}"
    )

    if not paired_comparison.empty:

        print(
            f"ML paired win rate: "
            f"{paired_comparison['ml_win_rate'].iloc[0]:.4f}"
        )

        print(
            f"Baseline paired win rate: "
            f"{paired_comparison['baseline_win_rate'].iloc[0]:.4f}"
        )

    print()
    print("=" * 70)
    print("CONCLUSION")
    print("=" * 70)

    print(conclusion)

    print()
    print("Generated files:")

    for path in [
        model_path,
        predictions_path,
        results_path,
        variant_results_path,
        comparison_path,
        importance_path,
        json_path,
        paired_path,
        regime_path,
        promotion_path,
        horizon_path,
        blend_path,
        report_path,
    ]:
        print(f"  {path}")

    print()
    print("DL-04 HD evaluation completed.")


if __name__ == "__main__":
    main()