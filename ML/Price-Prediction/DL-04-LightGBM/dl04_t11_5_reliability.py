from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    brier_score_loss,
    log_loss,
)


SCHEMA_VERSION = "1.0.0"


def expected_calibration_error(
    y_true,
    probabilities,
    n_bins=10,
):
    y_true = np.asarray(y_true)
    probabilities = np.asarray(probabilities)

    bins = np.linspace(0, 1, n_bins + 1)

    ece = 0.0

    for i in range(n_bins):

        lower = bins[i]
        upper = bins[i + 1]

        if i == n_bins - 1:
            mask = (
                (probabilities >= lower)
                & (probabilities <= upper)
            )
        else:
            mask = (
                (probabilities >= lower)
                & (probabilities < upper)
            )

        if not mask.any():
            continue

        confidence = probabilities[mask].mean()
        accuracy = y_true[mask].mean()
        weight = mask.mean()

        ece += weight * abs(
            confidence - accuracy
        )

    return float(ece)


def calibration_table(
    y_true,
    probabilities,
    n_bins=10,
):
    y_true = np.asarray(y_true)
    probabilities = np.asarray(probabilities)

    bins = np.linspace(0, 1, n_bins + 1)

    records = []

    for i in range(n_bins):

        lower = bins[i]
        upper = bins[i + 1]

        if i == n_bins - 1:
            mask = (
                (probabilities >= lower)
                & (probabilities <= upper)
            )
        else:
            mask = (
                (probabilities >= lower)
                & (probabilities < upper)
            )

        if not mask.any():

            records.append(
                {
                    "bin": i,
                    "probability_lower": lower,
                    "probability_upper": upper,
                    "rows": 0,
                    "mean_predicted_probability": np.nan,
                    "actual_change_rate": np.nan,
                    "absolute_calibration_error": np.nan,
                }
            )

            continue

        predicted = float(
            probabilities[mask].mean()
        )

        actual = float(
            y_true[mask].mean()
        )

        records.append(
            {
                "bin": i,
                "probability_lower": lower,
                "probability_upper": upper,
                "rows": int(mask.sum()),
                "mean_predicted_probability": round(
                    predicted,
                    6,
                ),
                "actual_change_rate": round(
                    actual,
                    6,
                ),
                "absolute_calibration_error": round(
                    abs(predicted - actual),
                    6,
                ),
            }
        )

    return pd.DataFrame(records)


def threshold_analysis(
    y_true,
    probabilities,
):
    thresholds = np.arange(
        0.05,
        1.00,
        0.05,
    )

    records = []

    for threshold in thresholds:

        prediction = (
            probabilities >= threshold
        ).astype(int)

        records.append(
            {
                "threshold": round(
                    float(threshold),
                    2,
                ),
                "accuracy": round(
                    accuracy_score(
                        y_true,
                        prediction,
                    ),
                    6,
                ),
                "precision": round(
                    precision_score(
                        y_true,
                        prediction,
                        zero_division=0,
                    ),
                    6,
                ),
                "recall": round(
                    recall_score(
                        y_true,
                        prediction,
                        zero_division=0,
                    ),
                    6,
                ),
                "f1": round(
                    f1_score(
                        y_true,
                        prediction,
                        zero_division=0,
                    ),
                    6,
                ),
                "predicted_change_rate": round(
                    prediction.mean(),
                    6,
                ),
            }
        )

    return pd.DataFrame(records)


def reliability_plot(
    table,
    output,
):
    valid = table.dropna(
        subset=[
            "mean_predicted_probability",
            "actual_change_rate",
        ]
    )

    plt.figure(
        figsize=(8, 7)
    )

    plt.plot(
        [0, 1],
        [0, 1],
        linestyle="--",
        label="Perfect calibration",
    )

    plt.plot(
        valid[
            "mean_predicted_probability"
        ],
        valid[
            "actual_change_rate"
        ],
        marker="o",
        label="Change detector",
    )

    plt.xlabel(
        "Mean predicted probability"
    )

    plt.ylabel(
        "Actual price-change rate"
    )

    plt.title(
        "DL-04 Change Detector Reliability"
    )

    plt.xlim(0, 1)
    plt.ylim(0, 1)

    plt.grid(
        True,
        alpha=0.3,
    )

    plt.legend()

    plt.tight_layout()

    plt.savefig(
        output,
        dpi=180,
    )

    plt.close()


def probability_analysis(df):

    data = df.copy()

    data["probability_error"] = (
        data["actual_price_changed"]
        - data["change_probability"]
    )

    data["absolute_probability_error"] = (
        data["probability_error"].abs()
    )

    data["probability_bucket"] = pd.cut(
        data["change_probability"],
        bins=[
            0,
            0.1,
            0.2,
            0.3,
            0.4,
            0.5,
            0.6,
            0.7,
            0.8,
            0.9,
            1.0,
        ],
        include_lowest=True,
    )

    return (
        data
        .groupby(
            "probability_bucket",
            observed=False,
        )
        .agg(
            rows=(
                "change_probability",
                "size",
            ),
            mean_probability=(
                "change_probability",
                "mean",
            ),
            actual_change_rate=(
                "actual_price_changed",
                "mean",
            ),
            mean_absolute_probability_error=(
                "absolute_probability_error",
                "mean",
            ),
        )
        .reset_index()
    )


def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--input",
        required=True,
    )

    parser.add_argument(
        "--output-dir",
        required=True,
    )

    args = parser.parse_args()

    input_path = Path(
        args.input
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
        "DL-04 T11.5 MODEL RELIABILITY "
        "AND CALIBRATION"
    )
    print("=" * 70)

    print()
    print(
        f"Input: {input_path}"
    )

    print(
        f"Output: {output_dir}"
    )

    df = pd.read_csv(
        input_path
    )

    print()
    print(
        f"Rows loaded: {len(df):,}"
    )

    required = [
        "actual_price_changed",
        "change_probability",
    ]

    missing = [
        column
        for column in required
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing columns: {missing}"
        )

    y_true = (
        df["actual_price_changed"]
        .astype(int)
        .to_numpy()
    )

    probabilities = (
        df["change_probability"]
        .astype(float)
        .to_numpy()
    )

    probabilities = np.clip(
        probabilities,
        0,
        1,
    )

    # ========================================================
    # Test reliability
    # ========================================================

    print()
    print("=" * 70)
    print(
        "TEST RELIABILITY"
    )
    print("=" * 70)

    brier = brier_score_loss(
        y_true,
        probabilities,
    )

    ece = expected_calibration_error(
        y_true,
        probabilities,
    )

    safe_probabilities = np.clip(
        probabilities,
        1e-7,
        1 - 1e-7,
    )

    logloss = log_loss(
        y_true,
        safe_probabilities,
    )

    print(
        f"Rows: {len(df):,}"
    )

    print(
        f"Actual change rate: "
        f"{y_true.mean():.4f}"
    )

    print(
        f"Mean predicted probability: "
        f"{probabilities.mean():.4f}"
    )

    print(
        f"Brier score: "
        f"{brier:.6f}"
    )

    print(
        f"Expected Calibration Error: "
        f"{ece:.6f}"
    )

    print(
        f"Log loss: "
        f"{logloss:.6f}"
    )

    # ========================================================
    # Calibration table
    # ========================================================

    calibration = calibration_table(
        y_true,
        probabilities,
    )

    calibration_path = (
        output_dir
        / "dl04_t11_5_test_calibration.csv"
    )

    calibration.to_csv(
        calibration_path,
        index=False,
    )

    # ========================================================
    # Threshold analysis
    # ========================================================

    thresholds = threshold_analysis(
        y_true,
        probabilities,
    )

    threshold_path = (
        output_dir
        / "dl04_t11_5_test_threshold_analysis.csv"
    )

    thresholds.to_csv(
        threshold_path,
        index=False,
    )

    # ========================================================
    # Probability analysis
    # ========================================================

    probability = probability_analysis(
        df
    )

    probability_path = (
        output_dir
        / "dl04_t11_5_test_probability_analysis.csv"
    )

    probability.to_csv(
        probability_path,
        index=False,
    )

    # ========================================================
    # Reliability plot
    # ========================================================

    plot_path = (
        output_dir
        / "dl04_t11_5_test_reliability.png"
    )

    reliability_plot(
        calibration,
        plot_path,
    )

    # ========================================================
    # Best threshold is descriptive ONLY
    # ========================================================

    best_threshold = (
        thresholds
        .sort_values(
            [
                "f1",
                "precision",
            ],
            ascending=False,
        )
        .iloc[0]
    )

    # ========================================================
    # Summary JSON
    # ========================================================

    summary = {
        "schema_version": SCHEMA_VERSION,
        "task": "DL-04",
        "analysis": (
            "test_model_reliability"
        ),
        "evaluation_split": "test",
        "threshold_selection_note": (
            "Threshold metrics are descriptive "
            "on the held-out test set. "
            "They must not be used to tune "
            "the production threshold."
        ),
        "rows": int(len(df)),
        "actual_change_rate": float(
            y_true.mean()
        ),
        "mean_predicted_probability": float(
            probabilities.mean()
        ),
        "brier_score": float(
            brier
        ),
        "expected_calibration_error": float(
            ece
        ),
        "log_loss": float(
            logloss
        ),
        "best_test_f1_threshold_descriptive": (
            float(
                best_threshold[
                    "threshold"
                ]
            )
        ),
    }

    summary_path = (
        output_dir
        / "dl04_t11_5_reliability_summary.json"
    )

    with summary_path.open(
        "w",
        encoding="utf-8",
    ) as handle:

        json.dump(
            summary,
            handle,
            indent=2,
        )

    # ========================================================
    # Report
    # ========================================================

    report_path = (
        output_dir
        / "DL-04-T11.5_Reliability_Report.md"
    )

    report = f"""# DL-04-T11.5 Model Reliability and Calibration

## Purpose

This stage evaluates the reliability of the DL-04 price-change
probabilities produced by the change-aware forecasting pipeline.

The input contains the held-out test predictions generated during T10.

## Evaluation Design

The test dataset contains:

- Rows: {len(df):,}
- Actual change rate: {y_true.mean():.4f}
- Mean predicted probability: {probabilities.mean():.4f}

Because this file contains the held-out test predictions, threshold
selection is reported descriptively only.

The test results must not be used to tune the production model.

## Reliability Metrics

| Metric | Test |
|---|---:|
| Brier score | {brier:.6f} |
| Expected Calibration Error | {ece:.6f} |
| Log loss | {logloss:.6f} |

### Brier Score

The Brier score measures the squared error of probabilistic predictions.

Lower values indicate better probabilistic accuracy.

### Expected Calibration Error

ECE measures the difference between predicted probabilities and observed
event frequencies across probability bins.

Lower values indicate better calibration.

### Log Loss

Log loss penalises confident incorrect probability predictions.

Lower values are preferable.

## Threshold Analysis

The threshold table is included for diagnostic purposes.

The best threshold by test F1 was:

**{best_threshold['threshold']:.2f}**

However, this threshold must NOT be adopted as a production threshold
because selecting it from the held-out test set would introduce test-set
tuning.

## Interpretation

The probability output should be interpreted as a model score unless
calibration has been independently established.

The reliability plot and calibration table provide evidence for whether
the model's confidence aligns with observed price-change frequencies.

## HD-Level Contribution

T11.5 extends DL-04 beyond point forecasting accuracy by evaluating the
quality of the model's probabilistic change signal.

The complete evaluation now covers:

1. Persistence baseline
2. LightGBM forecasting
3. Change-aware forecasting
4. Price-change regimes
5. Promotion regimes
6. Forecast horizons
7. Change detection
8. Probability reliability
9. Calibration
10. Standardised prediction outputs

## Important Limitation

The current T10 prediction artifact contains test predictions only.

Therefore this stage evaluates test reliability but does not claim that
the probability threshold has been optimised using validation data.

A production-ready calibration procedure should fit calibration parameters
using validation data and evaluate the calibrated probabilities once on
the held-out test set.
"""

    report_path.write_text(
        report,
        encoding="utf-8",
    )

    # ========================================================
    # Final output
    # ========================================================

    print()
    print("=" * 70)
    print(
        "T11.5 OUTPUTS"
    )
    print("=" * 70)

    print(
        f"  {calibration_path}"
    )

    print(
        f"  {threshold_path}"
    )

    print(
        f"  {probability_path}"
    )

    print(
        f"  {plot_path}"
    )

    print(
        f"  {summary_path}"
    )

    print(
        f"  {report_path}"
    )

    print()
    print(
        "DL-04 T11.5 reliability evaluation completed."
    )


if __name__ == "__main__":
    main()