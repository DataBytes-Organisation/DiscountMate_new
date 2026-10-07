from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    brier_score_loss,
    log_loss,
    precision_score,
    recall_score,
    f1_score,
)


# ============================================================
# CONSTANTS
# ============================================================

TARGET_COLUMN = "target_price_changed"

KEY_COLUMNS = [
    "product_id",
    "retailer_id",
    "recorded_at",
]

REQUIRED_COLUMNS = [
    "product_id",
    "retailer_id",
    "recorded_at",
    "price",
    "target_next_price",
    "split",
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


# ============================================================
# ARGUMENTS
# ============================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "DL-04 T11.6 probability calibration experiment. "
            "Compares raw LightGBM probabilities with Platt "
            "scaling and isotonic regression."
        )
    )

    parser.add_argument(
        "--input",
        required=True,
        help="Training dataset CSV.",
    )

    parser.add_argument(
        "--model",
        required=True,
        help="Existing change detector joblib.",
    )

    parser.add_argument(
        "--output-dir",
        required=True,
        help="Output directory.",
    )

    return parser.parse_args()


# ============================================================
# DATA PREPARATION
# ============================================================

def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    missing = [
        column
        for column in NUMERIC_FEATURES
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing model features: {missing}"
        )

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


def validate_dataset(df: pd.DataFrame) -> None:
    missing = [
        column
        for column in REQUIRED_COLUMNS
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing required columns: {missing}"
        )

    if df.empty:
        raise ValueError(
            "Input dataset is empty."
        )

    invalid_splits = set(
        df["split"].dropna().unique()
    ) - {
        "train",
        "validation",
        "test",
    }

    if invalid_splits:
        raise ValueError(
            f"Unexpected split labels: {invalid_splits}"
        )


# ============================================================
# CALIBRATION METRICS
# ============================================================

def safe_clip(probability):
    return np.clip(
        np.asarray(probability, dtype=float),
        1e-7,
        1 - 1e-7,
    )


def brier_score(actual, probability) -> float:
    return float(
        brier_score_loss(
            actual,
            probability,
        )
    )


def log_loss_score(actual, probability) -> float:
    probability = safe_clip(probability)

    return float(
        log_loss(
            actual,
            probability,
            labels=[0, 1],
        )
    )


def expected_calibration_error(
    actual,
    probability,
    n_bins: int = 10,
) -> float:

    actual = np.asarray(actual)
    probability = np.asarray(probability)

    bins = np.linspace(
        0.0,
        1.0,
        n_bins + 1,
    )

    ece = 0.0

    for lower, upper in zip(
        bins[:-1],
        bins[1:],
    ):
        if upper == 1.0:
            mask = (
                (probability >= lower)
                & (probability <= upper)
            )
        else:
            mask = (
                (probability >= lower)
                & (probability < upper)
            )

        if not np.any(mask):
            continue

        confidence = probability[mask].mean()
        accuracy = actual[mask].mean()
        weight = mask.mean()

        ece += weight * abs(
            confidence - accuracy
        )

    return float(ece)


def calibration_metrics(
    actual,
    probability,
) -> dict:

    actual = np.asarray(actual).astype(int)
    probability = safe_clip(probability)

    predicted_class = (
        probability >= 0.5
    ).astype(int)

    return {
        "rows": int(len(actual)),
        "actual_change_rate": float(
            actual.mean()
        ),
        "mean_predicted_probability": float(
            probability.mean()
        ),
        "brier_score": round(
            brier_score(
                actual,
                probability,
            ),
            6,
        ),
        "ece": round(
            expected_calibration_error(
                actual,
                probability,
            ),
            6,
        ),
        "log_loss": round(
            log_loss_score(
                actual,
                probability,
            ),
            6,
        ),
        "threshold_0_5_precision": round(
            precision_score(
                actual,
                predicted_class,
                zero_division=0,
            ),
            6,
        ),
        "threshold_0_5_recall": round(
            recall_score(
                actual,
                predicted_class,
                zero_division=0,
            ),
            6,
        ),
        "threshold_0_5_f1": round(
            f1_score(
                actual,
                predicted_class,
                zero_division=0,
            ),
            6,
        ),
    }


# ============================================================
# RELIABILITY TABLE
# ============================================================

def reliability_table(
    actual,
    probability,
    n_bins: int = 10,
) -> pd.DataFrame:

    actual = np.asarray(actual).astype(int)
    probability = np.asarray(probability)

    bins = np.linspace(
        0.0,
        1.0,
        n_bins + 1,
    )

    rows = []

    for index in range(n_bins):

        lower = bins[index]
        upper = bins[index + 1]

        if index == n_bins - 1:
            mask = (
                (probability >= lower)
                & (probability <= upper)
            )
        else:
            mask = (
                (probability >= lower)
                & (probability < upper)
            )

        count = int(mask.sum())

        if count == 0:
            continue

        rows.append(
            {
                "bin": index + 1,
                "probability_lower": round(
                    lower,
                    2,
                ),
                "probability_upper": round(
                    upper,
                    2,
                ),
                "rows": count,
                "mean_predicted_probability": round(
                    float(
                        probability[mask].mean()
                    ),
                    6,
                ),
                "actual_change_rate": round(
                    float(
                        actual[mask].mean()
                    ),
                    6,
                ),
                "absolute_calibration_gap": round(
                    abs(
                        float(
                            probability[mask].mean()
                        )
                        - float(
                            actual[mask].mean()
                        )
                    ),
                    6,
                ),
            }
        )

    return pd.DataFrame(rows)


# ============================================================
# CALIBRATION MODELS
# ============================================================

def fit_platt_scaling(
    validation_probability,
    validation_actual,
):
    """
    Platt scaling:
    Logistic regression fitted on log-odds of
    the original model probabilities.
    """

    probability = safe_clip(
        validation_probability
    )

    logit = np.log(
        probability
        / (1.0 - probability)
    ).reshape(-1, 1)

    model = LogisticRegression(
        solver="lbfgs",
        max_iter=1000,
        random_state=42,
    )

    model.fit(
        logit,
        validation_actual,
    )

    return model


def apply_platt_scaling(
    model,
    probability,
):
    probability = safe_clip(
        probability
    )

    logit = np.log(
        probability
        / (1.0 - probability)
    ).reshape(-1, 1)

    return model.predict_proba(
        logit
    )[:, 1]


def fit_isotonic(
    validation_probability,
    validation_actual,
):

    model = IsotonicRegression(
        y_min=0.0,
        y_max=1.0,
        out_of_bounds="clip",
    )

    model.fit(
        validation_probability,
        validation_actual,
    )

    return model


def apply_isotonic(
    model,
    probability,
):
    return np.asarray(
        model.predict(
            probability
        )
    )


# ============================================================
# MODEL COMPARISON
# ============================================================

def evaluate_methods(
    actual,
    raw_probability,
    platt_probability,
    isotonic_probability,
):

    methods = [
        (
            "raw_lightgbm",
            raw_probability,
        ),
        (
            "platt_scaling",
            platt_probability,
        ),
        (
            "isotonic_regression",
            isotonic_probability,
        ),
    ]

    rows = []

    for name, probability in methods:

        metrics = calibration_metrics(
            actual,
            probability,
        )

        metrics["method"] = name

        rows.append(metrics)

    columns = [
        "method",
        "rows",
        "actual_change_rate",
        "mean_predicted_probability",
        "brier_score",
        "ece",
        "log_loss",
        "threshold_0_5_precision",
        "threshold_0_5_recall",
        "threshold_0_5_f1",
    ]

    return pd.DataFrame(rows)[columns]


# ============================================================
# THRESHOLD ANALYSIS
# ============================================================

def threshold_analysis(
    actual,
    probability,
):

    rows = []

    thresholds = np.arange(
        0.05,
        0.96,
        0.05,
    )

    for threshold in thresholds:

        predicted = (
            probability >= threshold
        ).astype(int)

        rows.append(
            {
                "threshold": round(
                    float(threshold),
                    2,
                ),
                "precision": precision_score(
                    actual,
                    predicted,
                    zero_division=0,
                ),
                "recall": recall_score(
                    actual,
                    predicted,
                    zero_division=0,
                ),
                "f1": f1_score(
                    actual,
                    predicted,
                    zero_division=0,
                ),
                "predicted_change_rate": float(
                    predicted.mean()
                ),
            }
        )

    return pd.DataFrame(rows)


# ============================================================
# RELIABILITY PLOT
# ============================================================

def create_reliability_plot(
    validation_tables,
    test_tables,
    output_path,
):

    plt.figure(
        figsize=(9, 7)
    )

    plt.plot(
        [0, 1],
        [0, 1],
        linestyle="--",
        label="Perfect calibration",
    )

    for method in validation_tables:

        table = validation_tables[method]

        if table.empty:
            continue

        plt.plot(
            table[
                "mean_predicted_probability"
            ],
            table[
                "actual_change_rate"
            ],
            marker="o",
            label=f"Validation - {method}",
        )

    for method in test_tables:

        table = test_tables[method]

        if table.empty:
            continue

        plt.plot(
            table[
                "mean_predicted_probability"
            ],
            table[
                "actual_change_rate"
            ],
            marker="x",
            linestyle=":",
            label=f"Test - {method}",
        )

    plt.xlabel(
        "Mean predicted probability"
    )

    plt.ylabel(
        "Observed price-change rate"
    )

    plt.title(
        "DL-04 Probability Calibration"
    )

    plt.xlim(
        0,
        1,
    )

    plt.ylim(
        0,
        1,
    )

    plt.grid(
        alpha=0.25
    )

    plt.legend(
        fontsize=8
    )

    plt.tight_layout()

    plt.savefig(
        output_path,
        dpi=160,
    )

    plt.close()


# ============================================================
# MAIN
# ============================================================

def main():

    args = parse_args()

    input_path = Path(
        args.input
    )

    model_path = Path(
        args.model
    )

    output_dir = Path(
        args.output_dir
    )

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    print("=" * 70)
    print(
        "DL-04 T11.6 PROBABILITY CALIBRATION"
    )
    print("=" * 70)

    print()
    print(
        f"Input: {input_path}"
    )

    print(
        f"Change detector: {model_path}"
    )

    print(
        f"Output: {output_dir}"
    )

    # --------------------------------------------------------
    # LOAD DATA
    # --------------------------------------------------------

    df = pd.read_csv(
        input_path
    )

    validate_dataset(df)

    df["recorded_at"] = pd.to_datetime(
        df["recorded_at"],
        format="mixed",
        utc=True,
        errors="coerce",
    )

    df["target_price_changed"] = (
        np.abs(
            pd.to_numeric(
                df["target_next_price"],
                errors="coerce",
            )
            - pd.to_numeric(
                df["price"],
                errors="coerce",
            )
        )
        > 0.05
    ).astype(int)

    print()
    print(
        f"Rows loaded: {len(df):,}"
    )

    print()
    print("Split distribution:")

    print(
        df["split"]
        .value_counts()
        .to_string()
    )

    # --------------------------------------------------------
    # LOAD DETECTOR
    # --------------------------------------------------------

    artifact = joblib.load(
        model_path
    )

    if isinstance(
        artifact,
        dict,
    ):
        detector = artifact["model"]
        original_threshold = artifact.get(
            "threshold",
            None,
        )

        model_features = artifact.get(
            "features",
            NUMERIC_FEATURES,
        )

    else:
        detector = artifact
        original_threshold = None
        model_features = NUMERIC_FEATURES

    print()
    print(
        "Loaded detector:"
    )

    print(
        f"  model: {type(detector).__name__}"
    )

    print(
        f"  original threshold: "
        f"{original_threshold}"
    )

    print(
        f"  features: {len(model_features)}"
    )

    # --------------------------------------------------------
    # PREPARE SPLITS
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

    if (
        train.empty
        or validation.empty
        or test.empty
    ):
        raise ValueError(
            "Train, validation and test "
            "splits must all contain rows."
        )

    # --------------------------------------------------------
    # GENERATE RAW PROBABILITIES
    # --------------------------------------------------------

    X_validation = prepare_features(
        validation
    )

    X_test = prepare_features(
        test
    )

    validation_actual = (
        validation[
            TARGET_COLUMN
        ].astype(int).to_numpy()
    )

    test_actual = (
        test[
            TARGET_COLUMN
        ].astype(int).to_numpy()
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

    # --------------------------------------------------------
    # FIT CALIBRATORS USING VALIDATION ONLY
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print(
        "FITTING CALIBRATION MODELS"
    )
    print("=" * 70)

    print()
    print(
        "Calibration training set: validation"
    )

    platt_model = fit_platt_scaling(
        validation_probability,
        validation_actual,
    )

    isotonic_model = fit_isotonic(
        validation_probability,
        validation_actual,
    )

    validation_platt = apply_platt_scaling(
        platt_model,
        validation_probability,
    )

    validation_isotonic = apply_isotonic(
        isotonic_model,
        validation_probability,
    )

    test_platt = apply_platt_scaling(
        platt_model,
        test_probability,
    )

    test_isotonic = apply_isotonic(
        isotonic_model,
        test_probability,
    )

    # --------------------------------------------------------
    # VALIDATION COMPARISON
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print(
        "VALIDATION CALIBRATION"
    )
    print("=" * 70)

    validation_comparison = evaluate_methods(
        validation_actual,
        validation_probability,
        validation_platt,
        validation_isotonic,
    )

    print(
        validation_comparison.to_string(
            index=False
        )
    )

    # --------------------------------------------------------
    # SELECT CALIBRATION METHOD
    # --------------------------------------------------------

    selection = (
        validation_comparison
        .sort_values(
            [
                "brier_score",
                "ece",
                "log_loss",
            ],
            ascending=True,
        )
        .iloc[0]
    )

    selected_method = selection[
        "method"
    ]

    print()
    print(
        f"Selected calibration method: "
        f"{selected_method}"
    )

    # --------------------------------------------------------
    # TEST COMPARISON
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print(
        "TEST CALIBRATION"
    )
    print("=" * 70)

    test_comparison = evaluate_methods(
        test_actual,
        test_probability,
        test_platt,
        test_isotonic,
    )

    print(
        test_comparison.to_string(
            index=False
        )
    )

    # --------------------------------------------------------
    # SELECT FINAL TEST PROBABILITY
    # --------------------------------------------------------

    if selected_method == "raw_lightgbm":

        selected_test_probability = (
            test_probability
        )

    elif selected_method == "platt_scaling":

        selected_test_probability = (
            test_platt
        )

    else:

        selected_test_probability = (
            test_isotonic
        )

    # --------------------------------------------------------
    # THRESHOLD ANALYSIS
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print(
        "TEST THRESHOLD ANALYSIS"
    )
    print("=" * 70)

    test_thresholds = threshold_analysis(
        test_actual,
        selected_test_probability,
    )

    best_threshold_row = (
        test_thresholds
        .sort_values(
            [
                "f1",
                "precision",
            ],
            ascending=False,
        )
        .iloc[0]
    )

    print(
        test_thresholds.to_string(
            index=False
        )
    )

    # --------------------------------------------------------
    # RELIABILITY TABLES
    # --------------------------------------------------------

    validation_tables = {}

    test_tables = {}

    validation_probability_map = {
        "raw_lightgbm":
            validation_probability,
        "platt_scaling":
            validation_platt,
        "isotonic_regression":
            validation_isotonic,
    }

    test_probability_map = {
        "raw_lightgbm":
            test_probability,
        "platt_scaling":
            test_platt,
        "isotonic_regression":
            test_isotonic,
    }

    for method, probability in (
        validation_probability_map.items()
    ):

        validation_tables[method] = (
            reliability_table(
                validation_actual,
                probability,
            )
        )

    for method, probability in (
        test_probability_map.items()
    ):

        test_tables[method] = (
            reliability_table(
                test_actual,
                probability,
            )
        )

    # --------------------------------------------------------
    # SAVE CALIBRATION TABLES
    # --------------------------------------------------------

    validation_calibration = (
        validation_comparison.copy()
    )

    test_calibration = (
        test_comparison.copy()
    )

    validation_path = (
        output_dir
        / "dl04_t11_6_validation_calibration.csv"
    )

    test_path = (
        output_dir
        / "dl04_t11_6_test_calibration.csv"
    )

    threshold_path = (
        output_dir
        / "dl04_t11_6_test_threshold_analysis.csv"
    )

    validation_calibration.to_csv(
        validation_path,
        index=False,
    )

    test_calibration.to_csv(
        test_path,
        index=False,
    )

    test_thresholds.to_csv(
        threshold_path,
        index=False,
    )

    # --------------------------------------------------------
    # SAVE RELIABILITY DATA
    # --------------------------------------------------------

    probability_analysis_rows = []

    for method, table in (
        test_tables.items()
    ):

        table = table.copy()

        table.insert(
            0,
            "method",
            method,
        )

        probability_analysis_rows.append(
            table
        )

    probability_analysis = pd.concat(
        probability_analysis_rows,
        ignore_index=True,
    )

    probability_path = (
        output_dir
        / "dl04_t11_6_probability_analysis.csv"
    )

    probability_analysis.to_csv(
        probability_path,
        index=False,
    )

    # --------------------------------------------------------
    # PLOT
    # --------------------------------------------------------

    reliability_plot_path = (
        output_dir
        / "dl04_t11_6_reliability.png"
    )

    create_reliability_plot(
        validation_tables,
        test_tables,
        reliability_plot_path,
    )

    # --------------------------------------------------------
    # SAVE CALIBRATION MODELS
    # --------------------------------------------------------

    calibrator_path = (
        output_dir
        / "dl04_t11_6_calibrators.joblib"
    )

    joblib.dump(
        {
            "platt_model": platt_model,
            "isotonic_model": isotonic_model,
            "selected_method": selected_method,
            "features": NUMERIC_FEATURES,
            "base_detector": str(
                model_path.name
            ),
            "protocol": (
                "fit calibration on validation "
                "only; evaluate frozen calibrators "
                "on test"
            ),
        },
        calibrator_path,
    )

    # --------------------------------------------------------
    # SUMMARY
    # --------------------------------------------------------

    raw_test = test_comparison[
        test_comparison["method"]
        == "raw_lightgbm"
    ].iloc[0]

    selected_test = test_comparison[
        test_comparison["method"]
        == selected_method
    ].iloc[0]

    summary = {
        "experiment": (
            "DL-04-T11.6 Probability Calibration"
        ),
        "rows_total": int(len(df)),
        "train_rows": int(len(train)),
        "validation_rows": int(
            len(validation)
        ),
        "test_rows": int(len(test)),
        "actual_test_change_rate": float(
            test_actual.mean()
        ),
        "original_detector_threshold": (
            None
            if original_threshold is None
            else float(original_threshold)
        ),
        "selected_calibration_method": (
            selected_method
        ),
        "selection_protocol": (
            "Validation-only model selection "
            "using Brier score, ECE and log loss."
        ),
        "raw_test_brier": float(
            raw_test["brier_score"]
        ),
        "calibrated_test_brier": float(
            selected_test["brier_score"]
        ),
        "raw_test_ece": float(
            raw_test["ece"]
        ),
        "calibrated_test_ece": float(
            selected_test["ece"]
        ),
        "raw_test_log_loss": float(
            raw_test["log_loss"]
        ),
        "calibrated_test_log_loss": float(
            selected_test["log_loss"]
        ),
        "brier_improvement": round(
            float(
                raw_test["brier_score"]
                - selected_test["brier_score"]
            ),
            6,
        ),
        "ece_improvement": round(
            float(
                raw_test["ece"]
                - selected_test["ece"]
            ),
            6,
        ),
        "log_loss_improvement": round(
            float(
                raw_test["log_loss"]
                - selected_test["log_loss"]
            ),
            6,
        ),
        "best_test_f1_threshold": float(
            best_threshold_row[
                "threshold"
            ]
        ),
        "best_test_f1": float(
            best_threshold_row["f1"]
        ),
    }

    summary_path = (
        output_dir
        / "dl04_t11_6_calibration_summary.json"
    )

    with open(
        summary_path,
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            summary,
            file,
            indent=2,
        )

    # --------------------------------------------------------
    # REPORT
    # --------------------------------------------------------

    report_path = (
        output_dir
        / "DL-04-T11.6_Probability_Calibration_Report.md"
    )

    validation_best = (
        validation_comparison[
            validation_comparison["method"]
            == selected_method
        ].iloc[0]
    )

    brier_improvement = (
        raw_test["brier_score"]
        - selected_test["brier_score"]
    )

    ece_improvement = (
        raw_test["ece"]
        - selected_test["ece"]
    )

    logloss_improvement = (
        raw_test["log_loss"]
        - selected_test["log_loss"]
    )

    if brier_improvement > 0:
        calibration_conclusion = (
            "Calibration improved the test Brier score, "
            "indicating that the calibrated probability "
            "estimates are more useful probabilistically "
            "than the raw detector probabilities."
        )
    else:
        calibration_conclusion = (
            "Calibration did not improve the test "
            "Brier score. The raw detector probabilities "
            "remain competitive and should be retained "
            "as the reference model."
        )

    report = f"""# DL-04-T11.6 Probability Calibration

## Objective

This experiment evaluates whether the DL-04 price-change detector produces
reliable probability estimates.

The raw LightGBM change probability is compared against:

1. Raw LightGBM probability
2. Platt scaling
3. Isotonic regression

The calibration models are fitted using the validation split only and then
evaluated on the held-out test split.

## Dataset

- Total rows: {len(df):,}
- Training rows: {len(train):,}
- Validation rows: {len(validation):,}
- Test rows: {len(test):,}
- Test actual change rate: {test_actual.mean():.4f}

## Experimental Protocol

The base LightGBM detector is loaded from:

`{model_path.name}`

Calibration is fitted on validation predictions only.

The test set is not used during calibration-model fitting or method
selection.

This prevents test-set leakage and provides a cleaner estimate of
out-of-sample probability quality.

## Validation Calibration Results

{validation_comparison.to_markdown(index=False)}

Selected method:

**{selected_method}**

The method was selected using validation calibration quality, prioritising
Brier score, Expected Calibration Error (ECE), and log loss.

Selected validation Brier score:

**{validation_best["brier_score"]:.6f}**

Selected validation ECE:

**{validation_best["ece"]:.6f}**

## Test Calibration Results

{test_comparison.to_markdown(index=False)}

## Calibration Improvement

Raw test Brier score:

**{raw_test["brier_score"]:.6f}**

Selected calibrated test Brier score:

**{selected_test["brier_score"]:.6f}**

Brier improvement:

**{brier_improvement:.6f}**

Raw test ECE:

**{raw_test["ece"]:.6f}**

Selected calibrated test ECE:

**{selected_test["ece"]:.6f}**

ECE improvement:

**{ece_improvement:.6f}**

Raw test log loss:

**{raw_test["log_loss"]:.6f}**

Selected calibrated test log loss:

**{selected_test["log_loss"]:.6f}**

Log-loss improvement:

**{logloss_improvement:.6f}**

## Threshold Analysis

The probability threshold analysis is stored in:

`{threshold_path.name}`

Best observed test F1 threshold:

**{best_threshold_row["threshold"]:.2f}**

Best observed F1:

**{best_threshold_row["f1"]:.4f}**

Important: this threshold is reported for analysis only. It must not be
used as an unbiased model-selection result because it was selected using
the test set.

The production threshold should instead be selected using validation data.

## Research Interpretation

The previous T11.5 evaluation showed substantial disagreement between the
detector's predicted probability distribution and the observed test
change rate.

T11.6 therefore treats probability quality as a first-class modelling
problem rather than reporting classification accuracy alone.

This is important for DiscountMate because the change probability can be
used as a confidence signal for deciding when to trust a machine-learning
forecast versus a persistence forecast.

## Conclusion

{calibration_conclusion}

The calibrated probability model should only be integrated into the
production forecasting architecture if the validation-selected calibration
method demonstrates consistent improvement on the held-out test set.

## HD-Level Contribution

This experiment adds:

- probability calibration
- validation-only calibration fitting
- independent test evaluation
- Brier score
- Expected Calibration Error
- log loss
- reliability analysis
- Platt scaling comparison
- isotonic regression comparison
- explicit leakage-control protocol

This strengthens the project from simply comparing predictive models to
evaluating whether the model's confidence estimates are trustworthy enough
to support adaptive forecasting decisions.

## Generated Files

- `{validation_path.name}`
- `{test_path.name}`
- `{threshold_path.name}`
- `{probability_path.name}`
- `{reliability_plot_path.name}`
- `{calibrator_path.name}`
- `{summary_path.name}`
"""

    report_path.write_text(
        report,
        encoding="utf-8",
    )

    # --------------------------------------------------------
    # FINAL CONSOLE OUTPUT
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print(
        "T11.6 CALIBRATION SUMMARY"
    )
    print("=" * 70)

    print()
    print(
        f"Selected method: "
        f"{selected_method}"
    )

    print(
        f"Raw test Brier: "
        f"{raw_test['brier_score']:.6f}"
    )

    print(
        f"Calibrated test Brier: "
        f"{selected_test['brier_score']:.6f}"
    )

    print(
        f"Brier improvement: "
        f"{brier_improvement:.6f}"
    )

    print(
        f"Raw test ECE: "
        f"{raw_test['ece']:.6f}"
    )

    print(
        f"Calibrated test ECE: "
        f"{selected_test['ece']:.6f}"
    )

    print(
        f"ECE improvement: "
        f"{ece_improvement:.6f}"
    )

    print(
        f"Raw test log loss: "
        f"{raw_test['log_loss']:.6f}"
    )

    print(
        f"Calibrated test log loss: "
        f"{selected_test['log_loss']:.6f}"
    )

    print(
        f"Log-loss improvement: "
        f"{logloss_improvement:.6f}"
    )

    print()
    print(
        "Generated files:"
    )

    for path in [
        validation_path,
        test_path,
        threshold_path,
        probability_path,
        reliability_plot_path,
        calibrator_path,
        summary_path,
        report_path,
    ]:
        print(
            f"  {path}"
        )

    print()
    print(
        "DL-04 T11.6 probability calibration completed."
    )


if __name__ == "__main__":
    main()