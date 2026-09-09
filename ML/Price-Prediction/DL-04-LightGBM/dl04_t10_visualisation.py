from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


# ============================================================
# DL-04 T10 VISUALISATION
# ============================================================

REQUIRED_COLUMNS = [
    "product_id",
    "retailer_id",
    "recorded_at",
    "price",
    "target_next_price",
    "lightgbm_predicted_next_price",
    "change_probability",
    "predicted_price_changed",
    "change_aware_prediction",
    "split",
]


# ============================================================
# HELPERS
# ============================================================

def ensure_datetime(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["recorded_at"] = pd.to_datetime(
        df["recorded_at"],
        format="mixed",
        utc=True,
        errors="coerce",
    )

    return df.dropna(subset=["recorded_at"])


def mae(actual: pd.Series, predicted: pd.Series) -> float:
    return float(
        np.mean(
            np.abs(
                actual.to_numpy()
                - predicted.to_numpy()
            )
        )
    )


def rmse(actual: pd.Series, predicted: pd.Series) -> float:
    return float(
        np.sqrt(
            np.mean(
                (
                    actual.to_numpy()
                    - predicted.to_numpy()
                )
                ** 2
            )
        )
    )


def smape(
    actual: pd.Series,
    predicted: pd.Series,
) -> float:

    actual_np = actual.to_numpy()
    predicted_np = predicted.to_numpy()

    denominator = (
        np.abs(actual_np)
        + np.abs(predicted_np)
    ) / 2

    values = np.where(
        denominator == 0,
        0,
        np.abs(actual_np - predicted_np)
        / denominator,
    )

    return float(np.mean(values) * 100)


def directional_accuracy(
    actual: pd.Series,
    predicted: pd.Series,
    current: pd.Series,
) -> float:

    actual_delta = (
        actual.to_numpy()
        - current.to_numpy()
    )

    predicted_delta = (
        predicted.to_numpy()
        - current.to_numpy()
    )

    actual_direction = np.where(
        actual_delta > 0.05,
        1,
        np.where(
            actual_delta < -0.05,
            -1,
            0,
        ),
    )

    predicted_direction = np.where(
        predicted_delta > 0.05,
        1,
        np.where(
            predicted_delta < -0.05,
            -1,
            0,
        ),
    )

    return float(
        np.mean(
            actual_direction
            == predicted_direction
        )
    )


def safe_filename(value: str) -> str:
    return (
        value.replace(" ", "_")
        .replace("/", "_")
        .replace("\\", "_")
    )


# ============================================================
# LOAD DATA
# ============================================================

def load_data(
    input_path: Path,
    predictions_path: Path,
) -> pd.DataFrame:

    print("=" * 70)
    print("DL-04 T10 VISUALISATION")
    print("=" * 70)

    print()
    print(f"Training dataset: {input_path}")
    print(f"Prediction dataset: {predictions_path}")

    base = pd.read_csv(input_path)

    predictions = pd.read_csv(
        predictions_path,
    )

    print()
    print(f"Training rows: {len(base):,}")
    print(f"Prediction rows: {len(predictions):,}")

    missing = [
        column
        for column in REQUIRED_COLUMNS
        if column not in predictions.columns
    ]

    if missing:
        raise ValueError(
            "Missing required prediction columns: "
            f"{missing}"
        )

    predictions = ensure_datetime(
        predictions
    )

    base = ensure_datetime(base)

    # --------------------------------------------------------
    # Prefer the T9 prediction file as the main source.
    # It already contains the target and prediction columns.
    # --------------------------------------------------------

    df = predictions.copy()

    # --------------------------------------------------------
    # Recover useful columns from training dataset if they
    # are not present in the T9 prediction file.
    # --------------------------------------------------------

    extra_columns = [
        "target_next_recorded_at",
        "discount_amount",
        "discount_percent",
        "is_on_special",
        "promotion_type",
        "special_type",
        "offer_description",
        "unit_price",
        "previous_price",
        "previous_unit_price",
        "days_since_previous_observation",
        "previous_price_change",
        "previous_price_change_pct",
        "recorded_month",
        "recorded_day_of_week",
        "recorded_day_of_month",
        "observation_number",
    ]

    available_extra = [
        column
        for column in extra_columns
        if column in base.columns
    ]

    if available_extra:

        merge_keys = [
            "product_id",
            "retailer_id",
            "recorded_at",
        ]

        base_subset = base[
            merge_keys + available_extra
        ].drop_duplicates(
            merge_keys
        )

        df = df.merge(
            base_subset,
            on=merge_keys,
            how="left",
            suffixes=("", "_base"),
        )

    # --------------------------------------------------------
    # Target timestamp / horizon
    # --------------------------------------------------------

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

    else:

        df["target_days_ahead"] = np.nan

    # --------------------------------------------------------
    # Actual target change
    # --------------------------------------------------------

    df["actual_price_change"] = (
        df["target_next_price"]
        - df["price"]
    )

    df["actual_price_changed"] = (
        df["actual_price_change"].abs()
        > 0.05
    ).astype(int)

    # --------------------------------------------------------
    # Prediction errors
    # --------------------------------------------------------

    df["baseline_prediction"] = df["price"]

    df["baseline_absolute_error"] = (
        df["target_next_price"]
        - df["baseline_prediction"]
    ).abs()

    df["lightgbm_absolute_error"] = (
        df["target_next_price"]
        - df["lightgbm_predicted_next_price"]
    ).abs()

    df["change_aware_absolute_error"] = (
        df["target_next_price"]
        - df["change_aware_prediction"]
    ).abs()

    # --------------------------------------------------------
    # Error improvement
    # --------------------------------------------------------

    df["lightgbm_vs_baseline_improvement"] = (
        df["baseline_absolute_error"]
        - df["lightgbm_absolute_error"]
    )

    df["change_aware_vs_baseline_improvement"] = (
        df["baseline_absolute_error"]
        - df["change_aware_absolute_error"]
    )

    df["change_aware_vs_lightgbm_improvement"] = (
        df["lightgbm_absolute_error"]
        - df["change_aware_absolute_error"]
    )

    # --------------------------------------------------------
    # Horizon buckets
    # --------------------------------------------------------

    df["horizon_bucket"] = pd.cut(
        df["target_days_ahead"],
        bins=[
            -np.inf,
            1.05,
            1.50,
            2.50,
            np.inf,
        ],
        labels=[
            "0-1.05d",
            "1.05-1.50d",
            "1.50-2.50d",
            ">2.50d",
        ],
    )

    # --------------------------------------------------------
    # Change regime
    # --------------------------------------------------------

    df["change_regime"] = np.select(
        [
            df["actual_price_change"] > 0.05,
            df["actual_price_change"] < -0.05,
        ],
        [
            "price_increase",
            "price_decrease",
        ],
        default="stable_price",
    )

    # --------------------------------------------------------
    # Promotion regime
    # --------------------------------------------------------

    if "is_on_special" in df.columns:

        df["promotion_regime"] = np.where(
            df["is_on_special"].fillna(0).astype(int)
            == 1,
            "promotion",
            "non_promotion",
        )

    elif "promotion_type" in df.columns:

        df["promotion_regime"] = np.where(
            df["promotion_type"].notna(),
            "promotion",
            "non_promotion",
        )

    else:

        df["promotion_regime"] = "unknown"

    return df


# ============================================================
# SUMMARY TABLES
# ============================================================

def create_overall_metrics(
    df: pd.DataFrame,
) -> pd.DataFrame:

    rows = []

    models = {
        "last_known_price":
            "baseline_prediction",

        "lightgbm":
            "lightgbm_predicted_next_price",

        "change_aware_lightgbm":
            "change_aware_prediction",
    }

    for model, column in models.items():

        actual = df["target_next_price"]
        predicted = df[column]

        rows.append(
            {
                "model": model,
                "rows": len(df),
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
                        df["price"],
                    ),
                    4,
                ),
            }
        )

    return pd.DataFrame(rows)


def create_horizon_analysis(
    df: pd.DataFrame,
) -> pd.DataFrame:

    rows = []

    for bucket, part in df.groupby(
        "horizon_bucket",
        observed=False,
    ):

        if part.empty:
            continue

        rows.append(
            {
                "horizon_bucket": str(bucket),
                "rows": len(part),
                "mean_horizon_days": round(
                    part["target_days_ahead"]
                    .mean(),
                    4,
                ),
                "baseline_mae": round(
                    mae(
                        part["target_next_price"],
                        part["baseline_prediction"],
                    ),
                    4,
                ),
                "lightgbm_mae": round(
                    mae(
                        part["target_next_price"],
                        part[
                            "lightgbm_predicted_next_price"
                        ],
                    ),
                    4,
                ),
                "change_aware_mae": round(
                    mae(
                        part["target_next_price"],
                        part[
                            "change_aware_prediction"
                        ],
                    ),
                    4,
                ),
            }
        )

    return pd.DataFrame(rows)


def create_change_analysis(
    df: pd.DataFrame,
) -> pd.DataFrame:

    rows = []

    regimes = [
        "stable_price",
        "price_increase",
        "price_decrease",
    ]

    for regime in regimes:

        part = df[
            df["change_regime"]
            == regime
        ]

        if part.empty:
            continue

        rows.append(
            {
                "regime": regime,
                "rows": len(part),
                "baseline_mae": round(
                    mae(
                        part["target_next_price"],
                        part["baseline_prediction"],
                    ),
                    4,
                ),
                "lightgbm_mae": round(
                    mae(
                        part["target_next_price"],
                        part[
                            "lightgbm_predicted_next_price"
                        ],
                    ),
                    4,
                ),
                "change_aware_mae": round(
                    mae(
                        part["target_next_price"],
                        part[
                            "change_aware_prediction"
                        ],
                    ),
                    4,
                ),
            }
        )

    return pd.DataFrame(rows)


def create_promotion_analysis(
    df: pd.DataFrame,
) -> pd.DataFrame:

    rows = []

    for regime, part in df.groupby(
        "promotion_regime",
        dropna=False,
    ):

        if part.empty:
            continue

        rows.append(
            {
                "regime": regime,
                "rows": len(part),
                "baseline_mae": round(
                    mae(
                        part["target_next_price"],
                        part["baseline_prediction"],
                    ),
                    4,
                ),
                "lightgbm_mae": round(
                    mae(
                        part["target_next_price"],
                        part[
                            "lightgbm_predicted_next_price"
                        ],
                    ),
                    4,
                ),
                "change_aware_mae": round(
                    mae(
                        part["target_next_price"],
                        part[
                            "change_aware_prediction"
                        ],
                    ),
                    4,
                ),
            }
        )

    return pd.DataFrame(rows)


def create_probability_analysis(
    df: pd.DataFrame,
) -> pd.DataFrame:

    bins = [
        0.0,
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
    ]

    labels = [
        "0.0-0.1",
        "0.1-0.2",
        "0.2-0.3",
        "0.3-0.4",
        "0.4-0.5",
        "0.5-0.6",
        "0.6-0.7",
        "0.7-0.8",
        "0.8-0.9",
        "0.9-1.0",
    ]

    work = df.copy()

    work["probability_bucket"] = pd.cut(
        work["change_probability"],
        bins=bins,
        labels=labels,
        include_lowest=True,
    )

    rows = []

    for bucket, part in work.groupby(
        "probability_bucket",
        observed=False,
    ):

        if part.empty:
            continue

        rows.append(
            {
                "probability_bucket": str(bucket),
                "rows": len(part),
                "mean_probability": round(
                    part["change_probability"]
                    .mean(),
                    4,
                ),
                "actual_change_rate": round(
                    part["actual_price_changed"]
                    .mean(),
                    4,
                ),
                "mean_change_aware_mae": round(
                    part[
                        "change_aware_absolute_error"
                    ].mean(),
                    4,
                ),
            }
        )

    return pd.DataFrame(rows)


# ============================================================
# PLOTS
# ============================================================

def plot_model_comparison(
    metrics: pd.DataFrame,
    output_path: Path,
) -> None:

    plt.figure(figsize=(9, 6))

    plt.bar(
        metrics["model"],
        metrics["mae"],
    )

    plt.ylabel("MAE")
    plt.xlabel("Model")
    plt.title(
        "DL-04 Next-Price Forecasting: MAE Comparison"
    )

    plt.xticks(
        rotation=15,
        ha="right",
    )

    plt.tight_layout()

    plt.savefig(
        output_path,
        dpi=180,
    )

    plt.close()


def plot_model_comparison_rmse(
    metrics: pd.DataFrame,
    output_path: Path,
) -> None:

    plt.figure(figsize=(9, 6))

    plt.bar(
        metrics["model"],
        metrics["rmse"],
    )

    plt.ylabel("RMSE")
    plt.xlabel("Model")
    plt.title(
        "DL-04 Next-Price Forecasting: RMSE Comparison"
    )

    plt.xticks(
        rotation=15,
        ha="right",
    )

    plt.tight_layout()

    plt.savefig(
        output_path,
        dpi=180,
    )

    plt.close()


def plot_horizon_analysis(
    horizon: pd.DataFrame,
    output_path: Path,
) -> None:

    if horizon.empty:
        return

    x = np.arange(
        len(horizon)
    )

    width = 0.25

    plt.figure(figsize=(10, 6))

    plt.bar(
        x - width,
        horizon["baseline_mae"],
        width,
        label="Last-known baseline",
    )

    plt.bar(
        x,
        horizon["lightgbm_mae"],
        width,
        label="LightGBM",
    )

    plt.bar(
        x + width,
        horizon["change_aware_mae"],
        width,
        label="Change-aware LightGBM",
    )

    plt.xticks(
        x,
        horizon["horizon_bucket"],
    )

    plt.ylabel("MAE")
    plt.xlabel("Forecast horizon")
    plt.title(
        "Forecast Error by Horizon"
    )

    plt.legend()

    plt.tight_layout()

    plt.savefig(
        output_path,
        dpi=180,
    )

    plt.close()


def plot_change_analysis(
    change: pd.DataFrame,
    output_path: Path,
) -> None:

    if change.empty:
        return

    x = np.arange(
        len(change)
    )

    width = 0.25

    plt.figure(figsize=(10, 6))

    plt.bar(
        x - width,
        change["baseline_mae"],
        width,
        label="Last-known baseline",
    )

    plt.bar(
        x,
        change["lightgbm_mae"],
        width,
        label="LightGBM",
    )

    plt.bar(
        x + width,
        change["change_aware_mae"],
        width,
        label="Change-aware LightGBM",
    )

    plt.xticks(
        x,
        change["regime"],
        rotation=15,
        ha="right",
    )

    plt.ylabel("MAE")
    plt.xlabel("Price regime")
    plt.title(
        "Forecast Error by Price-Change Regime"
    )

    plt.legend()

    plt.tight_layout()

    plt.savefig(
        output_path,
        dpi=180,
    )

    plt.close()


def plot_promotion_analysis(
    promotion: pd.DataFrame,
    output_path: Path,
) -> None:

    if promotion.empty:
        return

    x = np.arange(
        len(promotion)
    )

    width = 0.25

    plt.figure(figsize=(9, 6))

    plt.bar(
        x - width,
        promotion["baseline_mae"],
        width,
        label="Last-known baseline",
    )

    plt.bar(
        x,
        promotion["lightgbm_mae"],
        width,
        label="LightGBM",
    )

    plt.bar(
        x + width,
        promotion["change_aware_mae"],
        width,
        label="Change-aware LightGBM",
    )

    plt.xticks(
        x,
        promotion["regime"],
    )

    plt.ylabel("MAE")
    plt.xlabel("Promotion regime")
    plt.title(
        "Forecast Error During Promotion vs Non-Promotion"
    )

    plt.legend()

    plt.tight_layout()

    plt.savefig(
        output_path,
        dpi=180,
    )

    plt.close()


def plot_change_probability(
    probability: pd.DataFrame,
    output_path: Path,
) -> None:

    if probability.empty:
        return

    plt.figure(figsize=(10, 6))

    plt.plot(
        probability["probability_bucket"],
        probability["mean_probability"],
        marker="o",
        label="Predicted probability",
    )

    plt.plot(
        probability["probability_bucket"],
        probability["actual_change_rate"],
        marker="o",
        label="Actual change rate",
    )

    plt.xlabel(
        "Predicted change-probability bucket"
    )

    plt.ylabel("Rate")

    plt.title(
        "Change Probability Calibration"
    )

    plt.xticks(
        rotation=30,
        ha="right",
    )

    plt.legend()

    plt.tight_layout()

    plt.savefig(
        output_path,
        dpi=180,
    )

    plt.close()


def plot_recent_price_trends(
    df: pd.DataFrame,
    output_path: Path,
    n_products: int = 6,
) -> None:

    # --------------------------------------------------------
    # Select products with the most observations.
    # --------------------------------------------------------

    product_counts = (
        df.groupby(
            ["product_id", "retailer_id"]
        )
        .size()
        .sort_values(
            ascending=False
        )
        .head(n_products)
    )

    selected = set(
        product_counts.index
    )

    work = df[
        df.apply(
            lambda row:
                (
                    row["product_id"],
                    row["retailer_id"],
                )
                in selected,
            axis=1,
        )
    ].copy()

    if work.empty:
        return

    # --------------------------------------------------------
    # Plot each product as its own figure.
    # --------------------------------------------------------

    for index, (
        product_id,
        retailer_id,
    ) in enumerate(
        product_counts.index,
        start=1,
    ):

        part = work[
            (work["product_id"] == product_id)
            & (
                work["retailer_id"]
                == retailer_id
            )
        ].sort_values(
            "recorded_at"
        )

        if part.empty:
            continue

        plt.figure(figsize=(11, 6))

        plt.plot(
            part["recorded_at"],
            part["price"],
            marker="o",
            label="Observed price",
        )

        plt.plot(
            part["recorded_at"],
            part[
                "lightgbm_predicted_next_price"
            ],
            marker="x",
            label="LightGBM prediction",
        )

        plt.plot(
            part["recorded_at"],
            part[
                "change_aware_prediction"
            ],
            marker="s",
            label="Change-aware prediction",
        )

        plt.xlabel(
            "Recorded timestamp"
        )

        plt.ylabel(
            "Price"
        )

        plt.title(
            f"Product {product_id} "
            f"({retailer_id}) Price Forecast"
        )

        plt.xticks(
            rotation=30,
            ha="right",
        )

        plt.legend()

        plt.tight_layout()

        filename = (
            f"dl04_t10_product_trend_"
            f"{index}_{safe_filename(str(product_id))}.png"
        )

        plt.savefig(
            output_path.parent / filename,
            dpi=180,
        )

        plt.close()

    # --------------------------------------------------------
    # Create a combined recent trend using a representative
    # product with the most observations.
    # --------------------------------------------------------

    product_id, retailer_id = (
        product_counts.index[0]
    )

    part = work[
        (work["product_id"] == product_id)
        & (
            work["retailer_id"]
            == retailer_id
        )
    ].sort_values(
        "recorded_at"
    )

    plt.figure(figsize=(12, 6))

    plt.plot(
        part["recorded_at"],
        part["price"],
        marker="o",
        label="Observed price",
    )

    plt.plot(
        part["recorded_at"],
        part[
            "lightgbm_predicted_next_price"
        ],
        marker="x",
        label="LightGBM prediction",
    )

    plt.plot(
        part["recorded_at"],
        part[
            "change_aware_prediction"
        ],
        marker="s",
        label="Change-aware prediction",
    )

    plt.xlabel(
        "Recorded timestamp"
    )

    plt.ylabel(
        "Price"
    )

    plt.title(
        f"Representative Recent Price Trend "
        f"— Product {product_id}"
    )

    plt.xticks(
        rotation=30,
        ha="right",
    )

    plt.legend()

    plt.tight_layout()

    plt.savefig(
        output_path,
        dpi=180,
    )

    plt.close()


# ============================================================
# REPORT
# ============================================================

def create_report(
    df: pd.DataFrame,
    metrics: pd.DataFrame,
    horizon: pd.DataFrame,
    change: pd.DataFrame,
    promotion: pd.DataFrame,
    probability: pd.DataFrame,
    output_path: Path,
) -> None:

    test = df[
        df["split"] == "test"
    ].copy()

    if test.empty:
        test = df.copy()

    baseline_mae = mae(
        test["target_next_price"],
        test["baseline_prediction"],
    )

    lightgbm_mae = mae(
        test["target_next_price"],
        test[
            "lightgbm_predicted_next_price"
        ],
    )

    change_aware_mae = mae(
        test["target_next_price"],
        test[
            "change_aware_prediction"
        ],
    )

    baseline_rmse = rmse(
        test["target_next_price"],
        test["baseline_prediction"],
    )

    lightgbm_rmse = rmse(
        test["target_next_price"],
        test[
            "lightgbm_predicted_next_price"
        ],
    )

    change_aware_rmse = rmse(
        test["target_next_price"],
        test[
            "change_aware_prediction"
        ],
    )

    baseline_direction = directional_accuracy(
        test["target_next_price"],
        test["baseline_prediction"],
        test["price"],
    )

    lightgbm_direction = directional_accuracy(
        test["target_next_price"],
        test[
            "lightgbm_predicted_next_price"
        ],
        test["price"],
    )

    change_aware_direction = directional_accuracy(
        test["target_next_price"],
        test[
            "change_aware_prediction"
        ],
        test["price"],
    )

    change_count = int(
        test["actual_price_changed"]
        .sum()
    )

    change_rate = float(
        test["actual_price_changed"]
        .mean()
    )

    report = f"""# DL-04-T10 Visualisation and Forecast Analysis Report

## Purpose

T10 provides the visual analysis layer for the DL-04 next-price forecasting
pipeline.

The analysis compares:

1. Last-known-price persistence baseline
2. LightGBM next-price forecast
3. Change-aware LightGBM forecast

The visualisation layer is designed to make model behaviour interpretable
rather than relying only on aggregate error metrics.

## Dataset

- Total prediction rows: {len(df):,}
- Test rows: {len(test):,}
- Products: {df["product_id"].nunique():,}
- Retailers: {df["retailer_id"].nunique():,}

## Test Performance

| Model | MAE | RMSE | Directional Accuracy |
| --- | ---: | ---: | ---: |
| Last-known-price baseline | {baseline_mae:.4f} | {baseline_rmse:.4f} | {baseline_direction:.4f} |
| LightGBM | {lightgbm_mae:.4f} | {lightgbm_rmse:.4f} | {lightgbm_direction:.4f} |
| Change-aware LightGBM | {change_aware_mae:.4f} | {change_aware_rmse:.4f} | {change_aware_direction:.4f} |

## Test Price-Change Distribution

- Actual price-change rows: {change_count:,}
- Actual price-change rate: {change_rate:.2%}

This is important because a persistence forecast can achieve very low
aggregate error when most observations retain the same price. Therefore,
T10 also examines error across price-change regimes, forecast horizons,
promotion states, and change probabilities.

## Horizon Analysis

{horizon.to_markdown(index=False) if not horizon.empty else "No horizon information available."}

## Price-Change Regime Analysis

{change.to_markdown(index=False) if not change.empty else "No price-change analysis available."}

## Promotion Analysis

{promotion.to_markdown(index=False) if not promotion.empty else "No promotion information available."}

## Change-Probability Analysis

{probability.to_markdown(index=False) if not probability.empty else "No probability analysis available."}

## Visual Outputs

The following plots are generated:

- Overall MAE comparison
- Overall RMSE comparison
- Forecast error by horizon
- Forecast error by price-change regime
- Forecast error by promotion regime
- Change-probability calibration
- Representative recent price trend
- Individual product forecast trends

## Interpretation

The T10 analysis deliberately avoids claiming that LightGBM is superior
solely because it performs better than the baseline in a particular
subgroup.

Aggregate performance and regime-specific performance are reported
separately.

This is particularly important for DL-04 because the test data contains
many stable-price observations. A model that predicts the current price
can therefore be extremely competitive on overall MAE.

The visualisation layer makes this behaviour transparent and provides
evidence for deciding whether a more advanced forecasting strategy is
useful for downstream DiscountMate functionality.

## Reproducibility

All figures are generated directly from the DL-04 training/prediction
artifacts and are saved under the configured output directory.
"""

    output_path.write_text(
        report,
        encoding="utf-8",
    )


# ============================================================
# MAIN
# ============================================================

def main() -> None:

    parser = argparse.ArgumentParser(
        description=(
            "DL-04 T10 visualisation and "
            "forecast analysis"
        )
    )

    parser.add_argument(
        "--input",
        required=True,
        help="DL-04 training dataset CSV",
    )

    parser.add_argument(
        "--predictions",
        required=True,
        help="T9 change-aware predictions CSV",
    )

    parser.add_argument(
        "--output-dir",
        required=True,
        help="Output directory",
    )

    parser.add_argument(
        "--n-products",
        type=int,
        default=6,
        help=(
            "Number of representative products "
            "for individual trend plots"
        ),
    )

    args = parser.parse_args()

    input_path = Path(
        args.input
    )

    predictions_path = Path(
        args.predictions
    )

    output_dir = Path(
        args.output_dir
    )

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    # --------------------------------------------------------
    # Load
    # --------------------------------------------------------

    df = load_data(
        input_path,
        predictions_path,
    )

    print()
    print(
        f"Rows prepared for T10: "
        f"{len(df):,}"
    )

    print(
        f"Products: "
        f"{df['product_id'].nunique():,}"
    )

    print(
        f"Test rows: "
        f"{(df['split'] == 'test').sum():,}"
    )

    # --------------------------------------------------------
    # Focus visual evaluation on test data.
    # --------------------------------------------------------

    test = df[
        df["split"] == "test"
    ].copy()

    if test.empty:
        raise ValueError(
            "No test rows found."
        )

    # --------------------------------------------------------
    # Create analysis tables
    # --------------------------------------------------------

    metrics = create_overall_metrics(
        test
    )

    horizon = create_horizon_analysis(
        test
    )

    change = create_change_analysis(
        test
    )

    promotion = create_promotion_analysis(
        test
    )

    probability = create_probability_analysis(
        test
    )

    # --------------------------------------------------------
    # Save analysis tables
    # --------------------------------------------------------

    metrics.to_csv(
        output_dir
        / "dl04_t10_overall_metrics.csv",
        index=False,
    )

    horizon.to_csv(
        output_dir
        / "dl04_t10_horizon_analysis.csv",
        index=False,
    )

    change.to_csv(
        output_dir
        / "dl04_t10_price_change_analysis.csv",
        index=False,
    )

    promotion.to_csv(
        output_dir
        / "dl04_t10_promotion_analysis.csv",
        index=False,
    )

    probability.to_csv(
        output_dir
        / "dl04_t10_change_probability_analysis.csv",
        index=False,
    )

    # --------------------------------------------------------
    # Generate plots
    # --------------------------------------------------------

    print()
    print(
        "Generating visualisations..."
    )

    plot_model_comparison(
        metrics,
        output_dir
        / "dl04_t10_model_mae_comparison.png",
    )

    plot_model_comparison_rmse(
        metrics,
        output_dir
        / "dl04_t10_model_rmse_comparison.png",
    )

    plot_horizon_analysis(
        horizon,
        output_dir
        / "dl04_t10_horizon_analysis.png",
    )

    plot_change_analysis(
        change,
        output_dir
        / "dl04_t10_price_change_analysis.png",
    )

    plot_promotion_analysis(
        promotion,
        output_dir
        / "dl04_t10_promotion_analysis.png",
    )

    plot_change_probability(
        probability,
        output_dir
        / "dl04_t10_change_probability.png",
    )

    plot_recent_price_trends(
        test,
        output_dir
        / "dl04_t10_representative_price_trend.png",
        n_products=args.n_products,
    )

    # --------------------------------------------------------
    # Save enriched test data
    # --------------------------------------------------------

    test_output_columns = [
        "product_id",
        "retailer_id",
        "recorded_at",
        "price",
        "target_next_price",
        "target_next_recorded_at",
        "target_days_ahead",
        "actual_price_change",
        "actual_price_changed",
        "baseline_prediction",
        "lightgbm_predicted_next_price",
        "change_probability",
        "predicted_price_changed",
        "change_aware_prediction",
        "baseline_absolute_error",
        "lightgbm_absolute_error",
        "change_aware_absolute_error",
        "lightgbm_vs_baseline_improvement",
        "change_aware_vs_baseline_improvement",
        "change_aware_vs_lightgbm_improvement",
        "horizon_bucket",
        "change_regime",
        "promotion_regime",
        "split",
    ]

    available_output_columns = [
        column
        for column in test_output_columns
        if column in test.columns
    ]

    test[
        available_output_columns
    ].to_csv(
        output_dir
        / "dl04_t10_enriched_test_predictions.csv",
        index=False,
    )

    # --------------------------------------------------------
    # Report
    # --------------------------------------------------------

    create_report(
        df=df,
        metrics=metrics,
        horizon=horizon,
        change=change,
        promotion=promotion,
        probability=probability,
        output_path=(
            output_dir
            / "DL-04-T10_Visualisation_Report.md"
        ),
    )

    # --------------------------------------------------------
    # Console summary
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("DL-04 T10 SUMMARY")
    print("=" * 70)

    print()
    print(
        metrics.to_string(
            index=False
        )
    )

    print()
    print(
        "Generated files:"
    )

    generated_files = [
        "dl04_t10_overall_metrics.csv",
        "dl04_t10_horizon_analysis.csv",
        "dl04_t10_price_change_analysis.csv",
        "dl04_t10_promotion_analysis.csv",
        "dl04_t10_change_probability_analysis.csv",
        "dl04_t10_model_mae_comparison.png",
        "dl04_t10_model_rmse_comparison.png",
        "dl04_t10_horizon_analysis.png",
        "dl04_t10_price_change_analysis.png",
        "dl04_t10_promotion_analysis.png",
        "dl04_t10_change_probability.png",
        "dl04_t10_representative_price_trend.png",
        "dl04_t10_enriched_test_predictions.csv",
        "DL-04-T10_Visualisation_Report.md",
    ]

    for filename in generated_files:
        print(
            f"  {output_dir / filename}"
        )

    print()
    print(
        "DL-04 T10 visualisation completed."
    )


if __name__ == "__main__":
    main()