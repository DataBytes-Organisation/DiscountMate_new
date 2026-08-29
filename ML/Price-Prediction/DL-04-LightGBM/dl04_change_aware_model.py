from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="DL-04 change-aware next-price forecasting experiment."
    )

    parser.add_argument(
        "--input",
        required=True,
        help="Training dataset CSV.",
    )

    parser.add_argument(
        "--lightgbm-predictions",
        required=True,
        help="Existing LightGBM prediction CSV.",
    )

    parser.add_argument(
        "--output-dir",
        required=True,
        help="Output directory.",
    )

    return parser.parse_args()


def mae(actual, predicted):
    return float(np.mean(np.abs(actual - predicted)))


def rmse(actual, predicted):
    return float(
        np.sqrt(
            np.mean(
                (actual - predicted) ** 2
            )
        )
    )


def smape(actual, predicted):
    denominator = (
        np.abs(actual) + np.abs(predicted)
    ) / 2

    values = np.where(
        denominator == 0,
        0,
        np.abs(actual - predicted) / denominator,
    )

    return float(np.mean(values) * 100)


def directional_accuracy(
    actual,
    predicted,
    current,
):
    actual_delta = actual - current
    predicted_delta = predicted - current

    actual_direction = np.where(
        actual_delta > 0.05,
        "up",
        np.where(
            actual_delta < -0.05,
            "down",
            "stable",
        ),
    )

    predicted_direction = np.where(
        predicted_delta > 0.05,
        "up",
        np.where(
            predicted_delta < -0.05,
            "down",
            "stable",
        ),
    )

    return float(
        np.mean(
            actual_direction
            == predicted_direction
        )
    )


def prepare_features(df):
    X = df[NUMERIC_FEATURES].copy()

    for column in NUMERIC_FEATURES:
        X[column] = pd.to_numeric(
            X[column],
            errors="coerce",
        )

    X = X.replace(
        [np.inf, -np.inf],
        np.nan,
    )

    X = X.fillna(0)

    return X


def evaluate_forecast(
    df,
    prediction_column,
):
    actual = df["target_next_price"]
    predicted = df[prediction_column]
    current = df["price"]

    return {
        "rows": int(len(df)),
        "mae": round(
            mae(actual, predicted),
            4,
        ),
        "rmse": round(
            rmse(actual, predicted),
            4,
        ),
        "smape_percent": round(
            smape(actual, predicted),
            2,
        ),
        "directional_accuracy": round(
            directional_accuracy(
                actual,
                predicted,
                current,
            ),
            4,
        ),
    }


def regime_analysis(df):
    rows = []

    regimes = {
        "stable_price": df[
            np.abs(
                df["target_next_price"]
                - df["price"]
            ) <= 0.05
        ],
        "price_changed": df[
            np.abs(
                df["target_next_price"]
                - df["price"]
            ) > 0.05
        ],
        "price_increase": df[
            df["target_next_price"]
            - df["price"]
            > 0.05
        ],
        "price_decrease": df[
            df["target_next_price"]
            - df["price"]
            < -0.05
        ],
        "promotion": df[
            df["is_on_special"] == 1
        ],
        "non_promotion": df[
            df["is_on_special"] != 1
        ],
    }

    for name, part in regimes.items():

        if part.empty:
            continue

        baseline_error = mae(
            part["target_next_price"],
            part["price"],
        )

        hybrid_error = mae(
            part["target_next_price"],
            part["change_aware_prediction"],
        )

        ml_error = mae(
            part["target_next_price"],
            part["lightgbm_predicted_next_price"],
        )

        rows.append(
            {
                "regime": name,
                "rows": int(len(part)),
                "baseline_mae": round(
                    baseline_error,
                    4,
                ),
                "lightgbm_mae": round(
                    ml_error,
                    4,
                ),
                "change_aware_mae": round(
                    hybrid_error,
                    4,
                ),
            }
        )

    return pd.DataFrame(rows)


def main():

    args = parse_args()

    input_path = Path(args.input)
    prediction_path = Path(
        args.lightgbm_predictions
    )
    output_dir = Path(args.output_dir)

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    print("=" * 70)
    print(
        "DL-04 CHANGE-AWARE FORECASTING"
    )
    print("=" * 70)

    print()
    print(f"Input: {input_path}")
    print(
        f"LightGBM predictions: "
        f"{prediction_path}"
    )
    print(
        f"Output: {output_dir}"
    )

    # ------------------------------------------------------------
    # Load data
    # ------------------------------------------------------------

    df = pd.read_csv(input_path)

    predictions = pd.read_csv(
        prediction_path
    )

    df["recorded_at"] = pd.to_datetime(
        df["recorded_at"],
        format="mixed",
        utc=True,
        errors="coerce",
    )

    predictions["recorded_at"] = pd.to_datetime(
        predictions["recorded_at"],
        format="mixed",
        utc=True,
        errors="coerce",
    )

    required = [
        "product_id",
        "retailer_id",
        "recorded_at",
        "price",
        "target_next_price",
        "split",
    ]

    missing = [
        column
        for column in required
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing training columns: {missing}"
        )

    if (
        "lightgbm_predicted_next_price"
        not in predictions.columns
    ):
        raise ValueError(
            "LightGBM prediction file does not "
            "contain lightgbm_predicted_next_price."
        )

    # ------------------------------------------------------------
    # Merge existing LightGBM predictions
    # ------------------------------------------------------------

    keys = [
        "product_id",
        "retailer_id",
        "recorded_at",
    ]

    prediction_columns = keys + [
        "lightgbm_predicted_next_price"
    ]

    df = df.merge(
        predictions[prediction_columns],
        on=keys,
        how="inner",
        validate="one_to_one",
    )

    print()
    print(
        f"Rows after prediction merge: "
        f"{len(df):,}"
    )

    # ------------------------------------------------------------
    # Create classification target
    # ------------------------------------------------------------

    price_change = (
        df["target_next_price"]
        - df["price"]
    )

    df["target_price_changed"] = (
        np.abs(price_change) > 0.05
    ).astype(int)

    df["target_price_increased"] = (
        price_change > 0.05
    ).astype(int)

    df["target_price_decreased"] = (
        price_change < -0.05
    ).astype(int)

    print()
    print("Target price-change distribution:")
    print(
        df["target_price_changed"]
        .value_counts()
        .rename(
            index={
                0: "stable",
                1: "changed",
            }
        )
        .to_string()
    )

    # ------------------------------------------------------------
    # Verify split
    # ------------------------------------------------------------

    for split in [
        "train",
        "validation",
        "test",
    ]:

        part = df[
            df["split"] == split
        ]

        if part.empty:
            continue

        print()
        print(
            f"{split}: "
            f"{len(part):,} rows"
        )

        print(
            f"  target changes: "
            f"{part['target_price_changed'].sum():,}"
        )

        print(
            f"  change rate: "
            f"{part['target_price_changed'].mean():.2%}"
        )

    train = df[
        df["split"] == "train"
    ].copy()

    validation = df[
        df["split"] == "validation"
    ].copy()

    test = df[
        df["split"] == "test"
    ].copy()

    if train.empty or validation.empty or test.empty:
        raise ValueError(
            "Train, validation and test splits "
            "must all contain rows."
        )

    # ------------------------------------------------------------
    # Train change detector
    # ------------------------------------------------------------

    print()
    print("=" * 70)
    print("TRAINING PRICE-CHANGE DETECTOR")
    print("=" * 70)

    X_train = prepare_features(train)
    y_train = train[
        "target_price_changed"
    ]

    X_validation = prepare_features(
        validation
    )

    y_validation = validation[
        "target_price_changed"
    ]

    X_test = prepare_features(test)

    y_test = test[
        "target_price_changed"
    ]

    detector = LGBMClassifier(
        objective="binary",
        n_estimators=120,
        learning_rate=0.04,
        num_leaves=15,
        min_child_samples=20,
        subsample=0.9,
        colsample_bytree=0.9,
        class_weight="balanced",
        random_state=42,
        verbose=-1,
    )

    detector.fit(
        X_train,
        y_train,
    )

    validation_probability = (
        detector.predict_proba(
            X_validation
        )[:, 1]
    )

    test_probability = (
        detector.predict_proba(
            X_test
        )[:, 1]
    )

    # ------------------------------------------------------------
    # Threshold selection
    #
    # IMPORTANT:
    # Threshold is selected using validation only.
    # ------------------------------------------------------------

    print()
    print("=" * 70)
    print(
        "SELECTING CHANGE-DETECTION THRESHOLD"
    )
    print("=" * 70)

    threshold_rows = []

    thresholds = np.arange(
        0.10,
        0.91,
        0.05,
    )

    for threshold in thresholds:

        detector_prediction = (
            validation_probability
            >= threshold
        ).astype(int)

        hybrid_prediction = np.where(
            detector_prediction == 1,
            validation[
                "lightgbm_predicted_next_price"
            ],
            validation["price"],
        )

        threshold_rows.append(
            {
                "threshold": round(
                    float(threshold),
                    2,
                ),
                "mae": mae(
                    validation[
                        "target_next_price"
                    ],
                    hybrid_prediction,
                ),
                "change_precision": precision_score(
                    y_validation,
                    detector_prediction,
                    zero_division=0,
                ),
                "change_recall": recall_score(
                    y_validation,
                    detector_prediction,
                    zero_division=0,
                ),
                "change_f1": f1_score(
                    y_validation,
                    detector_prediction,
                    zero_division=0,
                ),
                "ml_usage_rate": float(
                    np.mean(
                        detector_prediction
                        == 1
                    )
                ),
            }
        )

    threshold_df = pd.DataFrame(
        threshold_rows
    )

    # Select by hybrid forecasting MAE.
    best_row = threshold_df.sort_values(
        [
            "mae",
            "ml_usage_rate",
        ],
        ascending=[
            True,
            True,
        ],
    ).iloc[0]

    best_threshold = float(
        best_row["threshold"]
    )

    print()
    print(
        threshold_df.to_string(
            index=False
        )
    )

    print()
    print(
        f"Selected threshold: "
        f"{best_threshold:.2f}"
    )

    # ------------------------------------------------------------
    # Final test detector
    # ------------------------------------------------------------

    test_detector_prediction = (
        test_probability
        >= best_threshold
    ).astype(int)

    test_change_aware_prediction = np.where(
        test_detector_prediction == 1,
        test[
            "lightgbm_predicted_next_price"
        ],
        test["price"],
    )

    test = test.copy()

    test[
        "change_probability"
    ] = test_probability

    test[
        "predicted_price_changed"
    ] = test_detector_prediction

    test[
        "change_aware_prediction"
    ] = test_change_aware_prediction

    # ------------------------------------------------------------
    # Detector metrics
    # ------------------------------------------------------------

    detector_metrics = {
        "accuracy": accuracy_score(
            y_test,
            test_detector_prediction,
        ),
        "precision": precision_score(
            y_test,
            test_detector_prediction,
            zero_division=0,
        ),
        "recall": recall_score(
            y_test,
            test_detector_prediction,
            zero_division=0,
        ),
        "f1": f1_score(
            y_test,
            test_detector_prediction,
            zero_division=0,
        ),
        "actual_change_rate": float(
            y_test.mean()
        ),
        "predicted_change_rate": float(
            test_detector_prediction.mean()
        ),
    }

    print()
    print("=" * 70)
    print("TEST CHANGE DETECTOR")
    print("=" * 70)

    for key, value in detector_metrics.items():
        print(
            f"{key}: {value:.4f}"
            if isinstance(
                value,
                float,
            )
            else f"{key}: {value}"
        )

    print()
    print("Confusion matrix:")
    print(
        confusion_matrix(
            y_test,
            test_detector_prediction,
        )
    )

    print()
    print(
        classification_report(
            y_test,
            test_detector_prediction,
            target_names=[
                "stable",
                "changed",
            ],
            zero_division=0,
        )
    )

    # ------------------------------------------------------------
    # Forecast evaluation
    # ------------------------------------------------------------

    test["baseline_prediction"] = test[
        "price"
    ]

    baseline_metrics = evaluate_forecast(
        test,
        "baseline_prediction",
    )

    lightgbm_metrics = evaluate_forecast(
        test,
        "lightgbm_predicted_next_price",
    )

    change_aware_metrics = evaluate_forecast(
        test,
        "change_aware_prediction",
    )

    comparison = pd.DataFrame(
        [
            {
                "model": "last_known_price",
                **baseline_metrics,
            },
            {
                "model": "lightgbm",
                **lightgbm_metrics,
            },
            {
                "model": "change_aware_lightgbm",
                **change_aware_metrics,
            },
        ]
    )

    print()
    print("=" * 70)
    print("FINAL FORECAST COMPARISON")
    print("=" * 70)

    print(
        comparison.to_string(
            index=False
        )
    )

    # ------------------------------------------------------------
    # Regime analysis
    # ------------------------------------------------------------

    regime_df = regime_analysis(
        test
    )

    print()
    print("=" * 70)
    print("REGIME ANALYSIS")
    print("=" * 70)

    print(
        regime_df.to_string(
            index=False
        )
    )

    # ------------------------------------------------------------
    # Price-change-only analysis
    # ------------------------------------------------------------

    changed = test[
        test["target_price_changed"]
        == 1
    ]

    stable = test[
        test["target_price_changed"]
        == 0
    ]

    change_metrics = pd.DataFrame(
        [
            {
                "regime": "stable",
                **evaluate_forecast(
                    stable,
                    "change_aware_prediction",
                ),
            },
            {
                "regime": "changed",
                **evaluate_forecast(
                    changed,
                    "change_aware_prediction",
                ),
            },
            {
                "regime": "price_increase",
                **evaluate_forecast(
                    test[
                        test[
                            "target_price_increased"
                        ]
                        == 1
                    ],
                    "change_aware_prediction",
                ),
            },
            {
                "regime": "price_decrease",
                **evaluate_forecast(
                    test[
                        test[
                            "target_price_decreased"
                        ]
                        == 1
                    ],
                    "change_aware_prediction",
                ),
            },
        ]
    )

    print()
    print(
        change_metrics.to_string(
            index=False
        )
    )

    # ------------------------------------------------------------
    # Feature importance
    # ------------------------------------------------------------

    importance = pd.DataFrame(
        {
            "feature": NUMERIC_FEATURES,
            "importance": detector.feature_importances_,
        }
    ).sort_values(
        "importance",
        ascending=False,
    )

    # ------------------------------------------------------------
    # Save outputs
    # ------------------------------------------------------------

    threshold_path = (
        output_dir
        / "dl04_change_threshold_analysis.csv"
    )

    detector_metrics_path = (
        output_dir
        / "dl04_change_detector_metrics.json"
    )

    confusion_path = (
        output_dir
        / "dl04_change_detector_confusion_matrix.csv"
    )

    forecast_path = (
        output_dir
        / "dl04_change_aware_predictions.csv"
    )

    comparison_path = (
        output_dir
        / "dl04_change_aware_comparison.csv"
    )

    regime_path = (
        output_dir
        / "dl04_change_aware_regime_analysis.csv"
    )

    change_metrics_path = (
        output_dir
        / "dl04_change_aware_price_change_analysis.csv"
    )

    importance_path = (
        output_dir
        / "dl04_change_detector_feature_importance.csv"
    )

    model_path = (
        output_dir
        / "dl04_change_detector.joblib"
    )

    report_path = (
        output_dir
        / "DL-04-T9_Change_Aware_Evaluation_Report.md"
    )

    threshold_df.to_csv(
        threshold_path,
        index=False,
    )

    with open(
        detector_metrics_path,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            detector_metrics,
            file,
            indent=2,
        )

    pd.DataFrame(
        confusion_matrix(
            y_test,
            test_detector_prediction,
        ),
        index=[
            "actual_stable",
            "actual_changed",
        ],
        columns=[
            "predicted_stable",
            "predicted_changed",
        ],
    ).to_csv(
        confusion_path
    )

    output_columns = [
        "product_id",
        "retailer_id",
        "recorded_at",
        "price",
        "target_next_price",
        "target_price_changed",
        "target_price_increased",
        "target_price_decreased",
        "lightgbm_predicted_next_price",
        "change_probability",
        "predicted_price_changed",
        "change_aware_prediction",
        "split",
    ]

    test[
        output_columns
    ].to_csv(
        forecast_path,
        index=False,
    )

    comparison.to_csv(
        comparison_path,
        index=False,
    )

    regime_df.to_csv(
        regime_path,
        index=False,
    )

    change_metrics.to_csv(
        change_metrics_path,
        index=False,
    )

    importance.to_csv(
        importance_path,
        index=False,
    )

    import joblib

    joblib.dump(
        {
            "model": detector,
            "threshold": best_threshold,
            "features": NUMERIC_FEATURES,
            "architecture": (
                "persistence_when_stable_"
                "lightgbm_when_change_predicted"
            ),
        },
        model_path,
    )

    # ------------------------------------------------------------
    # Report
    # ------------------------------------------------------------

    baseline_mae = baseline_metrics["mae"]
    lightgbm_mae = lightgbm_metrics["mae"]
    change_aware_mae = (
        change_aware_metrics["mae"]
    )

    if change_aware_mae < baseline_mae:
        conclusion = (
            "The change-aware architecture "
            "outperformed persistence on the "
            "test set. This supports using ML "
            "selectively rather than replacing "
            "the persistence baseline."
        )
    else:
        conclusion = (
            "The change-aware architecture did "
            "not outperform persistence on "
            "aggregate test MAE. However, the "
            "experiment provides evidence about "
            "where ML forecasts are useful and "
            "where persistence remains preferable."
        )

    report = f"""# DL-04-T9 Change-Aware Forecasting Evaluation

## Objective

Evaluate whether LightGBM should replace the persistence baseline or be selectively applied when a price change is likely.

## Dataset

- Rows: {len(df):,}
- Test rows: {len(test):,}
- Products: {df["product_id"].nunique():,}
- Target: next observed product price
- Price-change threshold: 0.05

## Architecture

The proposed adaptive forecasting strategy is:

1. Predict whether the next price will change.
2. If stable is predicted, use the current price.
3. If change is predicted, use the LightGBM forecast.

## Threshold Selection

The change-detection threshold was selected using the validation set only.

- Selected threshold: {best_threshold:.2f}
- Validation hybrid MAE: {best_row["mae"]:.4f}

## Test Change Detection

- Accuracy: {detector_metrics["accuracy"]:.4f}
- Precision: {detector_metrics["precision"]:.4f}
- Recall: {detector_metrics["recall"]:.4f}
- F1: {detector_metrics["f1"]:.4f}
- Actual change rate: {detector_metrics["actual_change_rate"]:.4f}
- Predicted change rate: {detector_metrics["predicted_change_rate"]:.4f}

## Forecast Comparison

{comparison.to_markdown(index=False)}

## Regime Analysis

{regime_df.to_markdown(index=False)}

## Price-Change Analysis

{change_metrics.to_markdown(index=False)}

## Top Change-Detector Features

{importance.head(12).to_markdown(index=False)}

## Conclusion

{conclusion}

## Research Contribution

The experiment evaluates a practical adaptive forecasting architecture rather than assuming that a complex ML model should always replace a strong persistence baseline. This is particularly relevant for retail price data where most observations can remain unchanged while a smaller number of promotion-driven or other price-change events require different treatment.

## Generated Files

- `{threshold_path.name}`
- `{detector_metrics_path.name}`
- `{confusion_path.name}`
- `{forecast_path.name}`
- `{comparison_path.name}`
- `{regime_path.name}`
- `{change_metrics_path.name}`
- `{importance_path.name}`
- `{model_path.name}`
"""

    report_path.write_text(
        report,
        encoding="utf-8",
    )

    print()
    print("=" * 70)
    print("HD CONTRIBUTION SUMMARY")
    print("=" * 70)

    print(
        f"Threshold: {best_threshold:.2f}"
    )

    print(
        f"Baseline MAE: "
        f"{baseline_mae:.4f}"
    )

    print(
        f"LightGBM MAE: "
        f"{lightgbm_mae:.4f}"
    )

    print(
        f"Change-aware MAE: "
        f"{change_aware_mae:.4f}"
    )

    print(
        f"Change detector F1: "
        f"{detector_metrics['f1']:.4f}"
    )

    print()
    print(
        "Generated T9 files:"
    )

    for path in [
        threshold_path,
        detector_metrics_path,
        confusion_path,
        forecast_path,
        comparison_path,
        regime_path,
        change_metrics_path,
        importance_path,
        model_path,
        report_path,
    ]:
        print(f"  {path}")

    print()
    print(
        "DL-04 T9 change-aware evaluation completed."
    )


if __name__ == "__main__":
    main()