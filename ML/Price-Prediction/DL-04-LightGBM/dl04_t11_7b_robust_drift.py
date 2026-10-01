from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import ks_2samp


# ============================================================
# Configuration
# ============================================================

NUMERIC_FEATURES = [
    "price",
    "target_next_price",
    "target_days_ahead",
    "actual_price_change",
    "change_probability",
    "lightgbm_predicted_next_price",
    "change_aware_prediction",
    "baseline_absolute_error",
    "lightgbm_absolute_error",
    "change_aware_absolute_error",
]

DEFAULT_WINDOW_FRACTION = 0.20

PSI_STABLE = 0.10
PSI_WARNING = 0.25

KS_WARNING = 0.10
KS_CRITICAL = 0.20


# ============================================================
# Utilities
# ============================================================

def print_header(title: str) -> None:
    print()
    print("=" * 70)
    print(title)
    print("=" * 70)


def safe_percent_change(reference: float, current: float) -> float:
    if pd.isna(reference) or pd.isna(current):
        return np.nan

    if abs(reference) < 1e-12:
        if abs(current) < 1e-12:
            return 0.0
        return np.nan

    return float((current - reference) / abs(reference) * 100.0)


def calculate_psi(
    reference: pd.Series,
    current: pd.Series,
    bins: int = 10,
) -> float:

    reference = pd.to_numeric(
        reference,
        errors="coerce",
    ).dropna()

    current = pd.to_numeric(
        current,
        errors="coerce",
    ).dropna()

    if len(reference) < 5 or len(current) < 5:
        return np.nan

    combined = pd.concat(
        [reference, current],
        ignore_index=True,
    )

    if combined.nunique() <= 1:
        return 0.0

    try:
        quantiles = np.linspace(
            0,
            1,
            bins + 1,
        )

        edges = np.unique(
            np.quantile(
                combined,
                quantiles,
            )
        )

        if len(edges) < 3:
            return 0.0

        reference_bins = pd.cut(
            reference,
            bins=edges,
            include_lowest=True,
        )

        current_bins = pd.cut(
            current,
            bins=edges,
            include_lowest=True,
        )

        reference_dist = (
            reference_bins
            .value_counts(
                normalize=True,
                sort=False,
            )
            .to_numpy()
        )

        current_dist = (
            current_bins
            .value_counts(
                normalize=True,
                sort=False,
            )
            .to_numpy()
        )

    except Exception:
        return np.nan

    epsilon = 1e-6

    reference_dist = np.clip(
        reference_dist,
        epsilon,
        None,
    )

    current_dist = np.clip(
        current_dist,
        epsilon,
        None,
    )

    psi = np.sum(
        (
            current_dist
            - reference_dist
        )
        * np.log(
            current_dist
            / reference_dist
        )
    )

    return float(psi)


def classify_psi(psi: float) -> str:

    if pd.isna(psi):
        return "insufficient_data"

    if psi < PSI_STABLE:
        return "stable"

    if psi < PSI_WARNING:
        return "warning"

    return "critical_drift"


def classify_ks(ks: float) -> str:

    if pd.isna(ks):
        return "insufficient_data"

    if ks < KS_WARNING:
        return "stable"

    if ks < KS_CRITICAL:
        return "warning"

    return "critical_drift"


def overall_status(statuses: list[str]) -> str:

    if "critical_drift" in statuses:
        return "critical"

    if "warning" in statuses:
        return "warning"

    if statuses:
        return "stable"

    return "insufficient_data"


def calculate_metrics(
    df: pd.DataFrame,
) -> dict:

    actual = df["target_next_price"]
    baseline = df["baseline_prediction"]
    lightgbm = df["lightgbm_predicted_next_price"]
    change_aware = df["change_aware_prediction"]

    def mae(prediction: pd.Series) -> float:
        return float(
            np.mean(
                np.abs(
                    actual - prediction
                )
            )
        )

    def rmse(prediction: pd.Series) -> float:
        return float(
            np.sqrt(
                np.mean(
                    (
                        actual
                        - prediction
                    )
                    ** 2
                )
            )
        )

    return {
        "rows": int(len(df)),
        "mean_price": round(
            float(df["price"].mean()),
            4,
        ),
        "median_price": round(
            float(df["price"].median()),
            4,
        ),
        "actual_change_rate": round(
            float(
                df["actual_price_changed"]
                .mean()
            ),
            6,
        ),
        "mean_change_probability": round(
            float(
                df["change_probability"]
                .mean()
            ),
            6,
        ),
        "baseline_mae": round(
            mae(baseline),
            4,
        ),
        "lightgbm_mae": round(
            mae(lightgbm),
            4,
        ),
        "change_aware_mae": round(
            mae(change_aware),
            4,
        ),
        "baseline_rmse": round(
            rmse(baseline),
            4,
        ),
        "lightgbm_rmse": round(
            rmse(lightgbm),
            4,
        ),
        "change_aware_rmse": round(
            rmse(change_aware),
            4,
        ),
    }


# ============================================================
# Data validation
# ============================================================

def validate_columns(
    df: pd.DataFrame,
) -> None:

    required = [
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
        "change_aware_prediction",
        "baseline_absolute_error",
        "lightgbm_absolute_error",
        "change_aware_absolute_error",
        "horizon_bucket",
        "promotion_regime",
    ]

    missing = [
        column
        for column in required
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            "Input dataset is missing required "
            f"columns: {missing}"
        )


# ============================================================
# Temporal windows
# ============================================================

def create_temporal_windows(
    df: pd.DataFrame,
    fraction: float,
) -> pd.DataFrame:

    df = df.sort_values(
        "recorded_at"
    ).reset_index(
        drop=True
    )

    n = len(df)

    window_size = max(
        100,
        int(n * fraction),
    )

    window_size = min(
        window_size,
        n // 2,
    )

    early = df.iloc[
        :window_size
    ].copy()

    latest = df.iloc[
        -window_size:
    ].copy()

    q1 = df.iloc[
        : max(1, n // 4)
    ].copy()

    q4 = df.iloc[
        (3 * n) // 4 :
    ].copy()

    return {
        "early_20pct": early,
        "latest_20pct": latest,
        "q1_earliest": q1,
        "q4_latest": q4,
    }


# ============================================================
# Robust distribution drift
# ============================================================

def calculate_distribution_drift(
    reference: pd.DataFrame,
    current: pd.DataFrame,
    comparison_name: str,
) -> pd.DataFrame:

    rows = []

    for feature in NUMERIC_FEATURES:

        if feature not in reference.columns:
            continue

        if feature not in current.columns:
            continue

        reference_values = pd.to_numeric(
            reference[feature],
            errors="coerce",
        ).dropna()

        current_values = pd.to_numeric(
            current[feature],
            errors="coerce",
        ).dropna()

        if (
            len(reference_values) < 5
            or len(current_values) < 5
        ):
            continue

        ks_result = ks_2samp(
            reference_values,
            current_values,
        )

        psi = calculate_psi(
            reference_values,
            current_values,
        )

        reference_mean = float(
            reference_values.mean()
        )

        current_mean = float(
            current_values.mean()
        )

        reference_median = float(
            reference_values.median()
        )

        current_median = float(
            current_values.median()
        )

        rows.append(
            {
                "comparison": comparison_name,
                "feature": feature,
                "reference_rows": len(
                    reference_values
                ),
                "current_rows": len(
                    current_values
                ),
                "reference_mean": round(
                    reference_mean,
                    6,
                ),
                "current_mean": round(
                    current_mean,
                    6,
                ),
                "mean_change_percent": round(
                    safe_percent_change(
                        reference_mean,
                        current_mean,
                    ),
                    4,
                ),
                "reference_median": round(
                    reference_median,
                    6,
                ),
                "current_median": round(
                    current_median,
                    6,
                ),
                "psi": round(
                    psi,
                    6,
                ),
                "psi_status": classify_psi(
                    psi
                ),
                "ks_statistic": round(
                    float(
                        ks_result.statistic
                    ),
                    6,
                ),
                "ks_pvalue": round(
                    float(
                        ks_result.pvalue
                    ),
                    8,
                ),
                "ks_status": classify_ks(
                    float(
                        ks_result.statistic
                    )
                ),
            }
        )

    return pd.DataFrame(rows)


# ============================================================
# Temporal performance comparison
# ============================================================

def temporal_comparison(
    early: pd.DataFrame,
    latest: pd.DataFrame,
) -> pd.DataFrame:

    early_metrics = calculate_metrics(
        early
    )

    latest_metrics = calculate_metrics(
        latest
    )

    rows = []

    metric_names = [
        "mean_price",
        "median_price",
        "actual_change_rate",
        "mean_change_probability",
        "baseline_mae",
        "lightgbm_mae",
        "change_aware_mae",
        "baseline_rmse",
        "lightgbm_rmse",
        "change_aware_rmse",
    ]

    for metric in metric_names:

        early_value = early_metrics[
            metric
        ]

        latest_value = latest_metrics[
            metric
        ]

        rows.append(
            {
                "metric": metric,
                "early_value": early_value,
                "latest_value": latest_value,
                "change_percent": round(
                    safe_percent_change(
                        early_value,
                        latest_value,
                    ),
                    4,
                ),
            }
        )

    return pd.DataFrame(rows)


# ============================================================
# Drift summary
# ============================================================

def summarise_drift(
    drift_df: pd.DataFrame,
) -> dict:

    if drift_df.empty:
        return {
            "status": "insufficient_data",
            "features_evaluated": 0,
            "critical_psi_features": 0,
            "warning_psi_features": 0,
            "critical_ks_features": 0,
            "warning_ks_features": 0,
        }

    psi_statuses = (
        drift_df[
            "psi_status"
        ]
        .value_counts()
        .to_dict()
    )

    ks_statuses = (
        drift_df[
            "ks_status"
        ]
        .value_counts()
        .to_dict()
    )

    statuses = list(
        drift_df["psi_status"]
    ) + list(
        drift_df["ks_status"]
    )

    return {
        "status": overall_status(
            statuses
        ),
        "features_evaluated": int(
            drift_df["feature"]
            .nunique()
        ),
        "critical_psi_features": int(
            psi_statuses.get(
                "critical_drift",
                0,
            )
        ),
        "warning_psi_features": int(
            psi_statuses.get(
                "warning",
                0,
            )
        ),
        "critical_ks_features": int(
            ks_statuses.get(
                "critical_drift",
                0,
            )
        ),
        "warning_ks_features": int(
            ks_statuses.get(
                "warning",
                0,
            )
        ),
    }


# ============================================================
# Report
# ============================================================

def generate_report(
    output_path: Path,
    input_path: Path,
    df: pd.DataFrame,
    drift_early_latest: pd.DataFrame,
    drift_q1_q4: pd.DataFrame,
    early: pd.DataFrame,
    latest: pd.DataFrame,
    q1: pd.DataFrame,
    q4: pd.DataFrame,
    summary_early_latest: dict,
    summary_q1_q4: dict,
) -> None:

    early_metrics = calculate_metrics(
        early
    )

    latest_metrics = calculate_metrics(
        latest
    )

    q1_metrics = calculate_metrics(
        q1
    )

    q4_metrics = calculate_metrics(
        q4
    )

    critical_features = (
        drift_early_latest[
            drift_early_latest[
                "psi_status"
            ]
            == "critical_drift"
        ]["feature"]
        .tolist()
    )

    lines = []

    lines.append(
        "# DL-04-T11.7b Robust Temporal Drift Validation"
    )

    lines.append("")

    lines.append("## Purpose")

    lines.append(
        "This analysis validates whether the temporal drift "
        "identified in T11.7 remains observable when using "
        "substantially larger and statistically more stable "
        "reference windows."
    )

    lines.append("")

    lines.append("## Methodology")

    lines.append(
        f"- Total test prediction rows: {len(df):,}"
    )

    lines.append(
        f"- Robust window size: {len(early):,} rows "
        f"({DEFAULT_WINDOW_FRACTION:.0%} of the test set)"
    )

    lines.append(
        "- Primary comparison: earliest 20% vs latest 20%"
    )

    lines.append(
        "- Secondary comparison: Q1 vs Q4"
    )

    lines.append(
        "- Distribution metrics: PSI and Kolmogorov-Smirnov statistic"
    )

    lines.append(
        "- Performance metrics: MAE and RMSE"
    )

    lines.append("")

    lines.append("## Why This Validation Is Important")

    lines.append(
        "The original T11.7 analysis compared the first "
        "calendar day with the final calendar day. The first "
        "calendar day contained only a small number of test "
        "observations. T11.7b therefore uses large temporal "
        "windows to determine whether the observed drift is "
        "robust rather than an artefact of a very small "
        "reference sample."
    )

    lines.append("")

    lines.append("## Early 20% vs Latest 20%")

    lines.append("")

    lines.append(
        f"- Early rows: {len(early):,}"
    )

    lines.append(
        f"- Latest rows: {len(latest):,}"
    )

    lines.append(
        f"- Overall drift status: "
        f"**{summary_early_latest['status']}**"
    )

    lines.append("")

    lines.append(
        "| Metric | Early 20% | Latest 20% | Change |"
    )

    lines.append(
        "|---|---:|---:|---:|"
    )

    comparison = temporal_comparison(
        early,
        latest,
    )

    for _, row in comparison.iterrows():

        lines.append(
            f"| {row['metric']} | "
            f"{row['early_value']} | "
            f"{row['latest_value']} | "
            f"{row['change_percent']}% |"
        )

    lines.append("")

    lines.append("## Q1 vs Q4")

    lines.append("")

    lines.append(
        f"- Q1 rows: {len(q1):,}"
    )

    lines.append(
        f"- Q4 rows: {len(q4):,}"
    )

    lines.append(
        f"- Overall drift status: "
        f"**{summary_q1_q4['status']}**"
    )

    lines.append("")

    lines.append(
        "| Feature | PSI | PSI Status | KS | KS Status |"
    )

    lines.append(
        "|---|---:|---|---:|---|"
    )

    for _, row in drift_q1_q4.iterrows():

        lines.append(
            f"| {row['feature']} | "
            f"{row['psi']} | "
            f"{row['psi_status']} | "
            f"{row['ks_statistic']} | "
            f"{row['ks_status']} |"
        )

    lines.append("")

    lines.append("## Primary Robust Drift Findings")

    lines.append("")

    lines.append(
        f"- Features evaluated: "
        f"{summary_early_latest['features_evaluated']}"
    )

    lines.append(
        f"- Critical PSI features: "
        f"{summary_early_latest['critical_psi_features']}"
    )

    lines.append(
        f"- Warning PSI features: "
        f"{summary_early_latest['warning_psi_features']}"
    )

    lines.append(
        f"- Critical KS features: "
        f"{summary_early_latest['critical_ks_features']}"
    )

    lines.append(
        f"- Warning KS features: "
        f"{summary_early_latest['warning_ks_features']}"
    )

    lines.append("")

    if critical_features:

        lines.append(
            "**Features showing critical PSI drift:**"
        )

        for feature in critical_features:
            lines.append(
                f"- `{feature}`"
            )

    else:

        lines.append(
            "No features reached the critical PSI threshold "
            "under the robust early-vs-latest comparison."
        )

    lines.append("")

    lines.append("## Interpretation")

    if (
        summary_early_latest["status"]
        == "critical"
    ):

        lines.append(
            "The robust early-vs-latest comparison indicates "
            "that the distribution shift identified by T11.7 "
            "persists even when the reference period is expanded "
            "substantially. This supports treating temporal drift "
            "as a genuine monitoring concern rather than solely "
            "an artefact of the 13-row initial reference period."
        )

    elif (
        summary_early_latest["status"]
        == "warning"
    ):

        lines.append(
            "The larger temporal reference windows reduce the "
            "severity of the drift observed in T11.7, but "
            "meaningful distribution movement remains. The "
            "result supports continued monitoring rather than "
            "claiming severe production drift."
        )

    else:

        lines.append(
            "The apparent drift in the original T11.7 analysis "
            "does not remain strong under the larger-window "
            "validation. This suggests that at least part of "
            "the original critical drift classification was "
            "caused by the very small initial reference sample."
        )

    lines.append("")

    lines.append("## Forecasting Implications")

    lines.append(
        "The temporal analysis shows that forecast difficulty "
        "is strongly associated with the underlying price-change "
        "regime and forecast horizon. Therefore, a single "
        "aggregate MAE should not be treated as the only model "
        "selection criterion."
    )

    lines.append("")

    lines.append(
        "The persistence baseline remains the strongest aggregate "
        "forecast on the current test distribution, while the "
        "ML models provide additional analytical value through "
        "price-change modelling, regime analysis, probability "
        "estimation and monitoring."
    )

    lines.append("")

    lines.append("## Recommendation")

    lines.append(
        "For a production-oriented DiscountMate implementation, "
        "the temporal monitoring layer should periodically "
        "recalculate distribution drift and model error drift "
        "using rolling reference windows rather than comparing "
        "single calendar days."
    )

    lines.append("")

    output_path.write_text(
        "\n".join(lines),
        encoding="utf-8",
    )


# ============================================================
# Main
# ============================================================

def main() -> None:

    parser = argparse.ArgumentParser(
        description=(
            "DL-04 T11.7b robust temporal drift validation."
        )
    )

    parser.add_argument(
        "--input",
        required=True,
        help=(
            "T10 enriched test prediction dataset."
        ),
    )

    parser.add_argument(
        "--output-dir",
        required=True,
        help="Output directory.",
    )

    parser.add_argument(
        "--window-fraction",
        type=float,
        default=DEFAULT_WINDOW_FRACTION,
        help=(
            "Fraction of observations used for early/latest "
            "reference windows."
        ),
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

    print_header(
        "DL-04 T11.7b ROBUST TEMPORAL DRIFT VALIDATION"
    )

    print(
        f"\nInput: {input_path}"
    )

    print(
        f"Output: {output_dir}"
    )

    df = pd.read_csv(
        input_path
    )

    print(
        f"\nRows loaded: {len(df):,}"
    )

    validate_columns(
        df
    )

    df["recorded_at"] = pd.to_datetime(
        df["recorded_at"],
        format="mixed",
        utc=True,
        errors="coerce",
    )

    df = df.dropna(
        subset=["recorded_at"]
    )

    for column in NUMERIC_FEATURES:

        df[column] = pd.to_numeric(
            df[column],
            errors="coerce",
        )

    df = df.sort_values(
        "recorded_at"
    ).reset_index(
        drop=True
    )

    windows = create_temporal_windows(
        df,
        args.window_fraction,
    )

    early = windows[
        "early_20pct"
    ]

    latest = windows[
        "latest_20pct"
    ]

    q1 = windows[
        "q1_earliest"
    ]

    q4 = windows[
        "q4_latest"
    ]

    print_header(
        "TEMPORAL WINDOWS"
    )

    print(
        f"Early 20%: {len(early):,} rows"
    )

    print(
        f"Latest 20%: {len(latest):,} rows"
    )

    print(
        f"Q1: {len(q1):,} rows"
    )

    print(
        f"Q4: {len(q4):,} rows"
    )

    print(
        "\nEarly period:"
    )

    print(
        f"  {early['recorded_at'].min()} "
        f"-> "
        f"{early['recorded_at'].max()}"
    )

    print(
        "\nLatest period:"
    )

    print(
        f"  {latest['recorded_at'].min()} "
        f"-> "
        f"{latest['recorded_at'].max()}"
    )

    # --------------------------------------------------------
    # Early vs latest
    # --------------------------------------------------------

    print_header(
        "EARLY 20% VS LATEST 20% DRIFT"
    )

    drift_early_latest = (
        calculate_distribution_drift(
            early,
            latest,
            "early_20pct_vs_latest_20pct",
        )
    )

    print(
        drift_early_latest[
            [
                "feature",
                "psi",
                "psi_status",
                "ks_statistic",
                "ks_status",
            ]
        ].to_string(
            index=False
        )
    )

    # --------------------------------------------------------
    # Q1 vs Q4
    # --------------------------------------------------------

    print_header(
        "Q1 VS Q4 DRIFT"
    )

    drift_q1_q4 = (
        calculate_distribution_drift(
            q1,
            q4,
            "q1_vs_q4",
        )
    )

    print(
        drift_q1_q4[
            [
                "feature",
                "psi",
                "psi_status",
                "ks_statistic",
                "ks_status",
            ]
        ].to_string(
            index=False
        )
    )

    # --------------------------------------------------------
    # Performance comparison
    # --------------------------------------------------------

    print_header(
        "TEMPORAL PERFORMANCE"
    )

    early_metrics = calculate_metrics(
        early
    )

    latest_metrics = calculate_metrics(
        latest
    )

    q1_metrics = calculate_metrics(
        q1
    )

    q4_metrics = calculate_metrics(
        q4
    )

    performance_df = pd.DataFrame(
        [
            {
                "period": "early_20pct",
                **early_metrics,
            },
            {
                "period": "latest_20pct",
                **latest_metrics,
            },
            {
                "period": "q1_earliest",
                **q1_metrics,
            },
            {
                "period": "q4_latest",
                **q4_metrics,
            },
        ]
    )

    print(
        performance_df.to_string(
            index=False
        )
    )

    # --------------------------------------------------------
    # Performance change
    # --------------------------------------------------------

    performance_change = (
        temporal_comparison(
            early,
            latest,
        )
    )

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    summary_early_latest = (
        summarise_drift(
            drift_early_latest
        )
    )

    summary_q1_q4 = (
        summarise_drift(
            drift_q1_q4
        )
    )

    print_header(
        "ROBUST DRIFT SUMMARY"
    )

    print(
        "Early 20% -> Latest 20%:"
    )

    print(
        f"  Status: "
        f"{summary_early_latest['status']}"
    )

    print(
        f"  Features evaluated: "
        f"{summary_early_latest['features_evaluated']}"
    )

    print(
        f"  Critical PSI: "
        f"{summary_early_latest['critical_psi_features']}"
    )

    print(
        f"  Critical KS: "
        f"{summary_early_latest['critical_ks_features']}"
    )

    print(
        "\nQ1 -> Q4:"
    )

    print(
        f"  Status: "
        f"{summary_q1_q4['status']}"
    )

    print(
        f"  Features evaluated: "
        f"{summary_q1_q4['features_evaluated']}"
    )

    print(
        f"  Critical PSI: "
        f"{summary_q1_q4['critical_psi_features']}"
    )

    print(
        f"  Critical KS: "
        f"{summary_q1_q4['critical_ks_features']}"
    )

    # --------------------------------------------------------
    # Save outputs
    # --------------------------------------------------------

    drift_path = (
        output_dir
        / "dl04_t11_7b_early_latest_feature_drift.csv"
    )

    q1_q4_path = (
        output_dir
        / "dl04_t11_7b_q1_q4_feature_drift.csv"
    )

    performance_path = (
        output_dir
        / "dl04_t11_7b_temporal_performance.csv"
    )

    performance_change_path = (
        output_dir
        / "dl04_t11_7b_performance_change.csv"
    )

    summary_path = (
        output_dir
        / "dl04_t11_7b_robust_drift_summary.json"
    )

    report_path = (
        output_dir
        / "DL-04-T11.7b_Robust_Drift_Report.md"
    )

    drift_early_latest.to_csv(
        drift_path,
        index=False,
    )

    drift_q1_q4.to_csv(
        q1_q4_path,
        index=False,
    )

    performance_df.to_csv(
        performance_path,
        index=False,
    )

    performance_change.to_csv(
        performance_change_path,
        index=False,
    )

    summary = {
        "analysis": "T11.7b_robust_temporal_drift",
        "input": str(input_path),
        "rows": int(len(df)),
        "window_fraction": args.window_fraction,
        "early_rows": int(len(early)),
        "latest_rows": int(len(latest)),
        "q1_rows": int(len(q1)),
        "q4_rows": int(len(q4)),
        "early_latest": summary_early_latest,
        "q1_q4": summary_q1_q4,
        "early_period": {
            "start": str(
                early[
                    "recorded_at"
                ].min()
            ),
            "end": str(
                early[
                    "recorded_at"
                ].max()
            ),
        },
        "latest_period": {
            "start": str(
                latest[
                    "recorded_at"
                ].min()
            ),
            "end": str(
                latest[
                    "recorded_at"
                ].max()
            ),
        },
    }

    summary_path.write_text(
        json.dumps(
            summary,
            indent=2,
        ),
        encoding="utf-8",
    )

    generate_report(
        report_path,
        input_path,
        df,
        drift_early_latest,
        drift_q1_q4,
        early,
        latest,
        q1,
        q4,
        summary_early_latest,
        summary_q1_q4,
    )

    # --------------------------------------------------------
    # Final output
    # --------------------------------------------------------

    print_header(
        "T11.7b OUTPUTS"
    )

    print(
        f"\nOverall robust drift status: "
        f"{summary_early_latest['status']}"
    )

    print(
        "\nGenerated files:"
    )

    print(
        f"  {drift_path}"
    )

    print(
        f"  {q1_q4_path}"
    )

    print(
        f"  {performance_path}"
    )

    print(
        f"  {performance_change_path}"
    )

    print(
        f"  {summary_path}"
    )

    print(
        f"  {report_path}"
    )

    print(
        "\nDL-04 T11.7b robust drift validation completed."
    )


if __name__ == "__main__":
    main()