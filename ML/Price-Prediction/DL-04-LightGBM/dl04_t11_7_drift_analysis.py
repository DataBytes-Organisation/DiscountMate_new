from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd


# ============================================================
# DL-04 T11.7
# TEMPORAL DRIFT + MODEL STABILITY ANALYSIS
# ============================================================

SCRIPT_VERSION = "1.0.0"

CHANGE_THRESHOLD = 0.05
PSI_WARNING = 0.10
PSI_CRITICAL = 0.25
KS_WARNING = 0.10
KS_CRITICAL = 0.20


# ============================================================
# UTILITY FUNCTIONS
# ============================================================

def print_header(title: str) -> None:
    print()
    print("=" * 70)
    print(title)
    print("=" * 70)


def safe_float(value) -> float:
    if value is None:
        return float("nan")

    try:
        value = float(value)
    except (TypeError, ValueError):
        return float("nan")

    if not math.isfinite(value):
        return float("nan")

    return value


def mae(actual: pd.Series, predicted: pd.Series) -> float:
    actual = pd.to_numeric(actual, errors="coerce")
    predicted = pd.to_numeric(predicted, errors="coerce")

    mask = actual.notna() & predicted.notna()

    if mask.sum() == 0:
        return float("nan")

    return float(
        np.mean(
            np.abs(
                actual.loc[mask]
                - predicted.loc[mask]
            )
        )
    )


def rmse(actual: pd.Series, predicted: pd.Series) -> float:
    actual = pd.to_numeric(actual, errors="coerce")
    predicted = pd.to_numeric(predicted, errors="coerce")

    mask = actual.notna() & predicted.notna()

    if mask.sum() == 0:
        return float("nan")

    return float(
        np.sqrt(
            np.mean(
                (
                    actual.loc[mask]
                    - predicted.loc[mask]
                ) ** 2
            )
        )
    )


def smape(
    actual: pd.Series,
    predicted: pd.Series,
) -> float:

    actual = pd.to_numeric(actual, errors="coerce")
    predicted = pd.to_numeric(predicted, errors="coerce")

    denominator = (
        actual.abs()
        + predicted.abs()
    ) / 2

    numerator = (
        actual - predicted
    ).abs()

    mask = (
        actual.notna()
        & predicted.notna()
    )

    if mask.sum() == 0:
        return float("nan")

    values = np.where(
        denominator.loc[mask] == 0,
        0,
        numerator.loc[mask]
        / denominator.loc[mask],
    )

    return float(
        np.mean(values) * 100
    )


def directional_accuracy(
    actual: pd.Series,
    predicted: pd.Series,
    current: pd.Series,
) -> float:

    actual = pd.to_numeric(
        actual,
        errors="coerce",
    )

    predicted = pd.to_numeric(
        predicted,
        errors="coerce",
    )

    current = pd.to_numeric(
        current,
        errors="coerce",
    )

    mask = (
        actual.notna()
        & predicted.notna()
        & current.notna()
    )

    if mask.sum() == 0:
        return float("nan")

    actual_delta = (
        actual.loc[mask]
        - current.loc[mask]
    )

    predicted_delta = (
        predicted.loc[mask]
        - current.loc[mask]
    )

    actual_trend = np.where(
        actual_delta > CHANGE_THRESHOLD,
        1,
        np.where(
            actual_delta < -CHANGE_THRESHOLD,
            -1,
            0,
        ),
    )

    predicted_trend = np.where(
        predicted_delta > CHANGE_THRESHOLD,
        1,
        np.where(
            predicted_delta < -CHANGE_THRESHOLD,
            -1,
            0,
        ),
    )

    return float(
        np.mean(
            actual_trend
            == predicted_trend
        )
    )


def percentage_change(
    old: float,
    new: float,
) -> float:

    if not np.isfinite(old):
        return float("nan")

    if old == 0:
        return float("nan")

    return float(
        (new - old)
        / abs(old)
        * 100
    )


def validate_columns(
    df: pd.DataFrame,
    required: Iterable[str],
    dataset_name: str,
) -> None:

    missing = [
        column
        for column in required
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"{dataset_name} is missing required columns: "
            f"{missing}"
        )


def clean_numeric_columns(
    df: pd.DataFrame,
) -> pd.DataFrame:

    numeric_candidates = [
        "price",
        "target_next_price",
        "target_days_ahead",
        "actual_price_change",
        "actual_price_changed",
        "target_price_changed",
        "lightgbm_predicted_next_price",
        "change_probability",
        "predicted_change_probability",
        "change_aware_prediction",
        "baseline_prediction",
        "baseline_absolute_error",
        "lightgbm_absolute_error",
        "change_aware_absolute_error",
        "lightgbm_vs_baseline_improvement",
        "change_aware_vs_baseline_improvement",
        "change_aware_vs_lightgbm_improvement",
    ]

    for column in numeric_candidates:

        if column in df.columns:

            df[column] = pd.to_numeric(
                df[column],
                errors="coerce",
            )

    return df


# ============================================================
# COLUMN STANDARDISATION
# ============================================================

def standardise_change_columns(
    df: pd.DataFrame,
) -> pd.DataFrame:

    df = df.copy()

    # --------------------------------------------------------
    # T10 uses actual_price_changed.
    # Some earlier DL-04 datasets use target_price_changed.
    # --------------------------------------------------------

    if (
        "actual_price_changed" in df.columns
        and "target_price_changed"
        not in df.columns
    ):

        df["target_price_changed"] = (
            pd.to_numeric(
                df["actual_price_changed"],
                errors="coerce",
            )
            .fillna(0)
            .astype(int)
        )

    # --------------------------------------------------------
    # If neither exists, derive from actual target/current
    # price difference.
    # --------------------------------------------------------

    if (
        "target_price_changed" not in df.columns
        and "target_next_price" in df.columns
        and "price" in df.columns
    ):

        actual_change = (
            pd.to_numeric(
                df["target_next_price"],
                errors="coerce",
            )
            -
            pd.to_numeric(
                df["price"],
                errors="coerce",
            )
        )

        df["target_price_changed"] = (
            actual_change.abs()
            > CHANGE_THRESHOLD
        ).astype(int)

    if (
        "actual_price_changed"
        not in df.columns
    ):

        df["actual_price_changed"] = (
            df["target_price_changed"]
            .astype(int)
        )

    return df


# ============================================================
# TIMESTAMP PREPARATION
# ============================================================

def prepare_timestamps(
    df: pd.DataFrame,
) -> pd.DataFrame:

    df = df.copy()

    for column in [
        "recorded_at",
        "target_next_recorded_at",
    ]:

        if column in df.columns:

            df[column] = pd.to_datetime(
                df[column],
                format="mixed",
                utc=True,
                errors="coerce",
            )

    if (
        "target_days_ahead"
        not in df.columns
        and "target_next_recorded_at"
        in df.columns
    ):

        df["target_days_ahead"] = (
            (
                df["target_next_recorded_at"]
                - df["recorded_at"]
            )
            .dt.total_seconds()
            / 86400
        )

    return df


# ============================================================
# PSI
# ============================================================

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

    if (
        len(reference) < 10
        or len(current) < 10
    ):
        return float("nan")

    combined = pd.concat(
        [
            reference,
            current,
        ]
    )

    quantiles = np.linspace(
        0,
        1,
        bins + 1,
    )

    edges = np.unique(
        combined.quantile(
            quantiles
        ).values
    )

    if len(edges) < 3:

        return 0.0

    reference_counts, _ = np.histogram(
        reference,
        bins=edges,
    )

    current_counts, _ = np.histogram(
        current,
        bins=edges,
    )

    reference_dist = (
        reference_counts
        / max(
            reference_counts.sum(),
            1,
        )
    )

    current_dist = (
        current_counts
        / max(
            current_counts.sum(),
            1,
        )
    )

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

    psi_values = (
        (
            current_dist
            - reference_dist
        )
        *
        np.log(
            current_dist
            / reference_dist
        )
    )

    return float(
        np.sum(psi_values)
    )


def psi_status(
    psi: float,
) -> str:

    if not np.isfinite(psi):
        return "insufficient_data"

    if psi >= PSI_CRITICAL:
        return "critical_drift"

    if psi >= PSI_WARNING:
        return "warning"

    return "stable"


# ============================================================
# KS STATISTIC
# ============================================================

def calculate_ks(
    reference: pd.Series,
    current: pd.Series,
) -> float:

    reference = pd.to_numeric(
        reference,
        errors="coerce",
    ).dropna().sort_values()

    current = pd.to_numeric(
        current,
        errors="coerce",
    ).dropna().sort_values()

    if (
        len(reference) < 10
        or len(current) < 10
    ):
        return float("nan")

    values = np.sort(
        np.unique(
            np.concatenate(
                [
                    reference.values,
                    current.values,
                ]
            )
        )
    )

    reference_values = (
        reference.values
    )

    current_values = (
        current.values
    )

    reference_cdf = (
        np.searchsorted(
            reference_values,
            values,
            side="right",
        )
        / len(reference_values)
    )

    current_cdf = (
        np.searchsorted(
            current_values,
            values,
            side="right",
        )
        / len(current_values)
    )

    return float(
        np.max(
            np.abs(
                reference_cdf
                - current_cdf
            )
        )
    )


def ks_status(
    ks: float,
) -> str:

    if not np.isfinite(ks):
        return "insufficient_data"

    if ks >= KS_CRITICAL:
        return "critical_drift"

    if ks >= KS_WARNING:
        return "warning"

    return "stable"


# ============================================================
# TEMPORAL PERIODS
# ============================================================

def create_temporal_period(
    df: pd.DataFrame,
) -> pd.DataFrame:

    df = df.copy()

    df["date"] = (
        df["recorded_at"]
        .dt.date
    )

    df["date"] = pd.to_datetime(
        df["date"],
        errors="coerce",
    )

    df["period"] = (
        df["recorded_at"]
        .dt.strftime("%Y-%m-%d")
    )

    return df


# ============================================================
# DAILY PERFORMANCE
# ============================================================

def daily_performance(
    df: pd.DataFrame,
) -> pd.DataFrame:

    records = []

    for period, part in (
        df.groupby(
            "period",
            sort=True,
        )
    ):

        if len(part) == 0:
            continue

        records.append(
            {
                "period": str(period),
                "rows": int(len(part)),
                "products": int(
                    part["product_id"]
                    .nunique()
                ),
                "mean_price": round(
                    float(
                        part["price"]
                        .mean()
                    ),
                    4,
                ),
                "median_price": round(
                    float(
                        part["price"]
                        .median()
                    ),
                    4,
                ),
                "actual_change_rate": round(
                    float(
                        part[
                            "target_price_changed"
                        ].mean()
                    ),
                    6,
                ),
                "mean_change_probability":
                    round(
                        float(
                            part[
                                "change_probability"
                            ].mean()
                        ),
                        6,
                    ),
                "baseline_mae": round(
                    mae(
                        part[
                            "target_next_price"
                        ],
                        part[
                            "baseline_prediction"
                        ],
                    ),
                    4,
                ),
                "lightgbm_mae": round(
                    mae(
                        part[
                            "target_next_price"
                        ],
                        part[
                            "lightgbm_predicted_next_price"
                        ],
                    ),
                    4,
                ),
                "change_aware_mae": round(
                    mae(
                        part[
                            "target_next_price"
                        ],
                        part[
                            "change_aware_prediction"
                        ],
                    ),
                    4,
                ),
                "baseline_rmse": round(
                    rmse(
                        part[
                            "target_next_price"
                        ],
                        part[
                            "baseline_prediction"
                        ],
                    ),
                    4,
                ),
                "lightgbm_rmse": round(
                    rmse(
                        part[
                            "target_next_price"
                        ],
                        part[
                            "lightgbm_predicted_next_price"
                        ],
                    ),
                    4,
                ),
                "change_aware_rmse": round(
                    rmse(
                        part[
                            "target_next_price"
                        ],
                        part[
                            "change_aware_prediction"
                        ],
                    ),
                    4,
                ),
            }
        )

    return pd.DataFrame(records)


# ============================================================
# ROLLING DRIFT
# ============================================================

def rolling_drift(
    df: pd.DataFrame,
) -> pd.DataFrame:

    periods = (
        df[
            [
                "period",
                "price",
                "target_price_changed",
                "change_probability",
            ]
        ]
        .groupby("period")
        .agg(
            rows=("price", "size"),
            mean_price=("price", "mean"),
            actual_change_rate=(
                "target_price_changed",
                "mean",
            ),
            mean_change_probability=(
                "change_probability",
                "mean",
            ),
        )
        .reset_index()
    )

    periods = periods.sort_values(
        "period"
    ).reset_index(drop=True)

    if len(periods) < 2:

        periods[
            "price_change_pct"
        ] = np.nan

        periods[
            "change_rate_change_pct"
        ] = np.nan

        periods[
            "probability_change_pct"
        ] = np.nan

        return periods

    periods[
        "price_change_pct"
    ] = (
        periods["mean_price"]
        .pct_change()
        * 100
    )

    periods[
        "change_rate_change_pct"
    ] = (
        periods[
            "actual_change_rate"
        ]
        .pct_change()
        * 100
    )

    periods[
        "probability_change_pct"
    ] = (
        periods[
            "mean_change_probability"
        ]
        .pct_change()
        * 100
    )

    return periods


# ============================================================
# FEATURE DISTRIBUTION DRIFT
# ============================================================

def feature_drift_analysis(
    reference: pd.DataFrame,
    current: pd.DataFrame,
) -> pd.DataFrame:

    features = [
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

    records = []

    for feature in features:

        if (
            feature not in reference.columns
            or feature not in current.columns
        ):
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
            len(reference_values) < 10
            or len(current_values) < 10
        ):
            continue

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

        psi = calculate_psi(
            reference_values,
            current_values,
        )

        ks = calculate_ks(
            reference_values,
            current_values,
        )

        records.append(
            {
                "feature": feature,
                "reference_rows": int(
                    len(reference_values)
                ),
                "current_rows": int(
                    len(current_values)
                ),
                "reference_mean": round(
                    reference_mean,
                    6,
                ),
                "current_mean": round(
                    current_mean,
                    6,
                ),
                "mean_change_percent":
                    round(
                        percentage_change(
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
                "psi_status": psi_status(
                    psi
                ),
                "ks_statistic": round(
                    ks,
                    6,
                ),
                "ks_status": ks_status(
                    ks
                ),
            }
        )

    return pd.DataFrame(records)


# ============================================================
# MODEL PERFORMANCE BY TEMPORAL QUARTILE
# ============================================================

def temporal_quartile_analysis(
    df: pd.DataFrame,
) -> pd.DataFrame:

    df = df.copy()

    dates = (
        df["recorded_at"]
        .sort_values()
        .dropna()
    )

    if len(dates) == 0:
        return pd.DataFrame()

    q1 = dates.quantile(0.25)
    q2 = dates.quantile(0.50)
    q3 = dates.quantile(0.75)

    def assign_quartile(timestamp):

        if timestamp <= q1:
            return "Q1_earliest"

        if timestamp <= q2:
            return "Q2"

        if timestamp <= q3:
            return "Q3"

        return "Q4_latest"

    df["temporal_quartile"] = (
        df["recorded_at"]
        .apply(assign_quartile)
    )

    records = []

    order = [
        "Q1_earliest",
        "Q2",
        "Q3",
        "Q4_latest",
    ]

    for quartile in order:

        part = df[
            df["temporal_quartile"]
            == quartile
        ]

        if part.empty:
            continue

        records.append(
            {
                "temporal_quartile":
                    quartile,
                "rows": int(len(part)),
                "mean_price": round(
                    float(
                        part["price"].mean()
                    ),
                    4,
                ),
                "actual_change_rate":
                    round(
                        float(
                            part[
                                "target_price_changed"
                            ].mean()
                        ),
                        6,
                    ),
                "mean_change_probability":
                    round(
                        float(
                            part[
                                "change_probability"
                            ].mean()
                        ),
                        6,
                    ),
                "baseline_mae": round(
                    mae(
                        part[
                            "target_next_price"
                        ],
                        part[
                            "baseline_prediction"
                        ],
                    ),
                    4,
                ),
                "lightgbm_mae": round(
                    mae(
                        part[
                            "target_next_price"
                        ],
                        part[
                            "lightgbm_predicted_next_price"
                        ],
                    ),
                    4,
                ),
                "change_aware_mae": round(
                    mae(
                        part[
                            "target_next_price"
                        ],
                        part[
                            "change_aware_prediction"
                        ],
                    ),
                    4,
                ),
                "lightgbm_directional_accuracy":
                    round(
                        directional_accuracy(
                            part[
                                "target_next_price"
                            ],
                            part[
                                "lightgbm_predicted_next_price"
                            ],
                            part["price"],
                        ),
                        4,
                    ),
                "change_aware_directional_accuracy":
                    round(
                        directional_accuracy(
                            part[
                                "target_next_price"
                            ],
                            part[
                                "change_aware_prediction"
                            ],
                            part["price"],
                        ),
                        4,
                    ),
            }
        )

    return pd.DataFrame(records)


# ============================================================
# HORIZON DRIFT
# ============================================================

def horizon_drift_analysis(
    df: pd.DataFrame,
) -> pd.DataFrame:

    df = df.copy()

    if "target_days_ahead" not in df.columns:
        return pd.DataFrame()

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

    records = []

    for bucket, part in (
        df.groupby(
            "horizon_bucket",
            observed=True,
        )
    ):

        if part.empty:
            continue

        records.append(
            {
                "horizon_bucket": str(
                    bucket
                ),
                "rows": int(len(part)),
                "mean_horizon_days":
                    round(
                        float(
                            part[
                                "target_days_ahead"
                            ].mean()
                        ),
                        4,
                    ),
                "actual_change_rate":
                    round(
                        float(
                            part[
                                "target_price_changed"
                            ].mean()
                        ),
                        6,
                    ),
                "baseline_mae": round(
                    mae(
                        part[
                            "target_next_price"
                        ],
                        part[
                            "baseline_prediction"
                        ],
                    ),
                    4,
                ),
                "lightgbm_mae": round(
                    mae(
                        part[
                            "target_next_price"
                        ],
                        part[
                            "lightgbm_predicted_next_price"
                        ],
                    ),
                    4,
                ),
                "change_aware_mae": round(
                    mae(
                        part[
                            "target_next_price"
                        ],
                        part[
                            "change_aware_prediction"
                        ],
                    ),
                    4,
                ),
            }
        )

    return pd.DataFrame(records)


# ============================================================
# PROMOTION DRIFT
# ============================================================

def promotion_drift_analysis(
    df: pd.DataFrame,
) -> pd.DataFrame:

    if "promotion_regime" not in df.columns:
        return pd.DataFrame()

    records = []

    for regime, part in (
        df.groupby(
            "promotion_regime",
            dropna=False,
        )
    ):

        if part.empty:
            continue

        records.append(
            {
                "promotion_regime":
                    str(regime),
                "rows": int(len(part)),
                "share": round(
                    float(
                        len(part)
                        / len(df)
                    ),
                    6,
                ),
                "actual_change_rate":
                    round(
                        float(
                            part[
                                "target_price_changed"
                            ].mean()
                        ),
                        6,
                    ),
                "mean_change_probability":
                    round(
                        float(
                            part[
                                "change_probability"
                            ].mean()
                        ),
                        6,
                    ),
                "baseline_mae": round(
                    mae(
                        part[
                            "target_next_price"
                        ],
                        part[
                            "baseline_prediction"
                        ],
                    ),
                    4,
                ),
                "lightgbm_mae": round(
                    mae(
                        part[
                            "target_next_price"
                        ],
                        part[
                            "lightgbm_predicted_next_price"
                        ],
                    ),
                    4,
                ),
                "change_aware_mae": round(
                    mae(
                        part[
                            "target_next_price"
                        ],
                        part[
                            "change_aware_prediction"
                        ],
                    ),
                    4,
                ),
            }
        )

    return pd.DataFrame(records)


# ============================================================
# ERROR DRIFT
# ============================================================

def error_drift_analysis(
    df: pd.DataFrame,
) -> pd.DataFrame:

    df = df.copy()

    df["error_gap_lightgbm"] = (
        df[
            "lightgbm_absolute_error"
        ]
        - df[
            "baseline_absolute_error"
        ]
    )

    df["error_gap_change_aware"] = (
        df[
            "change_aware_absolute_error"
        ]
        - df[
            "baseline_absolute_error"
        ]
    )

    records = []

    for period, part in (
        df.groupby(
            "period",
            sort=True,
        )
    ):

        records.append(
            {
                "period": str(period),
                "rows": int(len(part)),
                "baseline_mae": round(
                    float(
                        part[
                            "baseline_absolute_error"
                        ].mean()
                    ),
                    4,
                ),
                "lightgbm_mae": round(
                    float(
                        part[
                            "lightgbm_absolute_error"
                        ].mean()
                    ),
                    4,
                ),
                "change_aware_mae": round(
                    float(
                        part[
                            "change_aware_absolute_error"
                        ].mean()
                    ),
                    4,
                ),
                "lightgbm_mean_improvement":
                    round(
                        float(
                            part[
                                "lightgbm_vs_baseline_improvement"
                            ].mean()
                        ),
                        4,
                    ),
                "change_aware_mean_improvement":
                    round(
                        float(
                            part[
                                "change_aware_vs_baseline_improvement"
                            ].mean()
                        ),
                        4,
                    ),
                "lightgbm_win_rate":
                    round(
                        float(
                            (
                                part[
                                    "lightgbm_absolute_error"
                                ]
                                <
                                part[
                                    "baseline_absolute_error"
                                ]
                            ).mean()
                        ),
                        6,
                    ),
                "change_aware_win_rate":
                    round(
                        float(
                            (
                                part[
                                    "change_aware_absolute_error"
                                ]
                                <
                                part[
                                    "baseline_absolute_error"
                                ]
                            ).mean()
                        ),
                        6,
                    ),
            }
        )

    return pd.DataFrame(records)


# ============================================================
# REFERENCE VS LATEST PERIOD
# ============================================================

def latest_period_drift(
    df: pd.DataFrame,
) -> tuple[pd.DataFrame, dict]:

    periods = sorted(
        df["period"]
        .dropna()
        .unique()
    )

    if len(periods) < 2:

        return (
            pd.DataFrame(),
            {
                "status":
                    "insufficient_periods",
                "periods": len(periods),
            },
        )

    reference_period = periods[0]
    latest_period = periods[-1]

    reference = df[
        df["period"]
        == reference_period
    ]

    latest = df[
        df["period"]
        == latest_period
    ]

    feature_table = feature_drift_analysis(
        reference,
        latest,
    )

    return (
        feature_table,
        {
            "reference_period":
                str(reference_period),
            "latest_period":
                str(latest_period),
            "reference_rows":
                int(len(reference)),
            "latest_rows":
                int(len(latest)),
        },
    )


# ============================================================
# OVERALL DRIFT SCORE
# ============================================================

def calculate_overall_drift_status(
    feature_drift: pd.DataFrame,
) -> str:

    if feature_drift.empty:
        return "insufficient_data"

    critical_count = int(
        (
            (
                feature_drift[
                    "psi_status"
                ]
                == "critical_drift"
            )
            |
            (
                feature_drift[
                    "ks_status"
                ]
                == "critical_drift"
            )
        ).sum()
    )

    warning_count = int(
        (
            (
                feature_drift[
                    "psi_status"
                ]
                == "warning"
            )
            |
            (
                feature_drift[
                    "ks_status"
                ]
                == "warning"
            )
        ).sum()
    )

    if critical_count >= 2:
        return "critical"

    if critical_count >= 1:
        return "warning"

    if warning_count >= 2:
        return "warning"

    return "stable"


# ============================================================
# REPORT
# ============================================================

def generate_report(
    output_path: Path,
    metadata: dict,
    daily: pd.DataFrame,
    temporal: pd.DataFrame,
    feature_drift: pd.DataFrame,
    horizon: pd.DataFrame,
    promotion: pd.DataFrame,
    error_drift: pd.DataFrame,
) -> None:

    lines = []

    lines.append(
        "# DL-04-T11.7 Temporal Drift and Model Stability Report"
    )

    lines.append("")

    lines.append(
        "## Purpose"
    )

    lines.append("")

    lines.append(
        "T11.7 evaluates whether the DL-04 forecasting pipeline "
        "remains stable across time and whether changes in the "
        "underlying price, promotion, forecast horizon, and "
        "prediction distributions could affect model reliability."
    )

    lines.append("")

    lines.append(
        "The analysis compares the persistence baseline, "
        "LightGBM, and change-aware LightGBM."
    )

    lines.append("")

    lines.append(
        "## Dataset"
    )

    lines.append("")

    for key, value in metadata.items():

        lines.append(
            f"- **{key}:** {value}"
        )

    lines.append("")

    lines.append(
        "## Drift Interpretation"
    )

    lines.append("")

    lines.append(
        "- PSI < 0.10: stable distribution."
    )

    lines.append(
        "- PSI 0.10-0.25: warning level."
    )

    lines.append(
        "- PSI >= 0.25: substantial/critical distribution drift."
    )

    lines.append("")

    lines.append(
        "KS statistics are also reported as a complementary "
        "distribution-shift diagnostic."
    )

    lines.append("")

    lines.append(
        "## Latest-Period Feature Drift"
    )

    lines.append("")

    if feature_drift.empty:

        lines.append(
            "Insufficient data for reference/latest drift analysis."
        )

    else:

        lines.append(
            feature_drift.to_markdown(
                index=False
            )
        )

    lines.append("")

    lines.append(
        "## Temporal Performance"
    )

    lines.append("")

    if temporal.empty:

        lines.append(
            "No temporal performance table available."
        )

    else:

        lines.append(
            temporal.to_markdown(
                index=False
            )
        )

    lines.append("")

    lines.append(
        "## Horizon Stability"
    )

    lines.append("")

    if horizon.empty:

        lines.append(
            "No horizon analysis available."
        )

    else:

        lines.append(
            horizon.to_markdown(
                index=False
            )
        )

    lines.append("")

    lines.append(
        "## Promotion Stability"
    )

    lines.append("")

    if promotion.empty:

        lines.append(
            "No promotion analysis available."
        )

    else:

        lines.append(
            promotion.to_markdown(
                index=False
            )
        )

    lines.append("")

    lines.append(
        "## Daily Error Stability"
    )

    lines.append("")

    if error_drift.empty:

        lines.append(
            "No daily error analysis available."
        )

    else:

        lines.append(
            error_drift.to_markdown(
                index=False
            )
        )

    lines.append("")

    lines.append(
        "## HD-Level Interpretation"
    )

    lines.append("")

    overall_status = metadata.get(
        "overall_drift_status",
        "unknown",
    )

    lines.append(
        f"Overall drift status: **{overall_status}**."
    )

    lines.append("")

    lines.append(
        "The purpose of this analysis is not to assume that "
        "LightGBM must outperform persistence. Instead, it tests "
        "whether the forecasting system is stable under temporal "
        "distribution changes and identifies conditions under which "
        "forecast quality changes."
    )

    lines.append("")

    lines.append(
        "The resulting evidence can be used to justify monitoring "
        "requirements, retraining triggers, and production safeguards "
        "for the DiscountMate price-forecasting component."
    )

    lines.append("")

    lines.append(
        "## Limitations"
    )

    lines.append("")

    lines.append(
        "The available dataset covers a relatively short historical "
        "period. Therefore, observed drift should be interpreted as "
        "evidence of within-dataset temporal variation rather than "
        "proof of long-term production drift."
    )

    lines.append("")

    lines.append(
        "Generated by DL-04 T11.7 "
        f"v{SCRIPT_VERSION}."
    )

    output_path.write_text(
        "\n".join(lines),
        encoding="utf-8",
    )


# ============================================================
# MAIN
# ============================================================

def main() -> None:

    parser = argparse.ArgumentParser(
        description=(
            "DL-04 T11.7 temporal drift and "
            "model stability analysis."
        )
    )

    parser.add_argument(
        "--input",
        required=True,
        help=(
            "T10 enriched prediction CSV."
        ),
    )

    parser.add_argument(
        "--training-data",
        required=True,
        help=(
            "DL-04 training dataset CSV."
        ),
    )

    parser.add_argument(
        "--output-dir",
        required=True,
        help=(
            "Output directory."
        ),
    )

    args = parser.parse_args()

    input_path = Path(
        args.input
    )

    training_path = Path(
        args.training_data
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
        "DL-04 T11.7 TEMPORAL DRIFT ANALYSIS"
    )
    print("=" * 70)

    print()
    print(
        f"T10 predictions: {input_path}"
    )

    print(
        f"Training dataset: {training_path}"
    )

    print(
        f"Output: {output_dir}"
    )

    # --------------------------------------------------------
    # LOAD T10
    # --------------------------------------------------------

    test_df = pd.read_csv(
        input_path
    )

    print()
    print(
        f"T10 rows loaded: {len(test_df):,}"
    )

    validate_columns(
        test_df,
        [
            "product_id",
            "retailer_id",
            "recorded_at",
            "price",
            "target_next_price",
            "target_next_recorded_at",
            "change_probability",
            "lightgbm_predicted_next_price",
            "change_aware_prediction",
            "split",
        ],
        "T10 prediction dataset",
    )

    test_df = standardise_change_columns(
        test_df
    )

    test_df = prepare_timestamps(
        test_df
    )

    test_df = clean_numeric_columns(
        test_df
    )

    # --------------------------------------------------------
    # LOAD TRAINING DATA
    # --------------------------------------------------------

    training_df = pd.read_csv(
        training_path
    )

    print(
        f"Training rows loaded: "
        f"{len(training_df):,}"
    )

    validate_columns(
        training_df,
        [
            "product_id",
            "retailer_id",
            "recorded_at",
            "price",
            "target_next_price",
            "split",
        ],
        "Training dataset",
    )

    training_df = standardise_change_columns(
        training_df
    )

    training_df = prepare_timestamps(
        training_df
    )

    training_df = clean_numeric_columns(
        training_df
    )

    # --------------------------------------------------------
    # PREPARE TEST DATA
    # --------------------------------------------------------

    test_df = test_df[
        test_df["split"]
        == "test"
    ].copy()

    if test_df.empty:

        raise ValueError(
            "No rows with split='test' "
            "were found in T10 predictions."
        )

    test_df = create_temporal_period(
        test_df
    )

    # --------------------------------------------------------
    # ENSURE REQUIRED ERROR COLUMNS
    # --------------------------------------------------------

    if (
        "baseline_prediction"
        not in test_df.columns
    ):

        test_df[
            "baseline_prediction"
        ] = test_df["price"]

    if (
        "baseline_absolute_error"
        not in test_df.columns
    ):

        test_df[
            "baseline_absolute_error"
        ] = (
            test_df[
                "target_next_price"
            ]
            - test_df[
                "baseline_prediction"
            ]
        ).abs()

    if (
        "lightgbm_absolute_error"
        not in test_df.columns
    ):

        test_df[
            "lightgbm_absolute_error"
        ] = (
            test_df[
                "target_next_price"
            ]
            - test_df[
                "lightgbm_predicted_next_price"
            ]
        ).abs()

    if (
        "change_aware_absolute_error"
        not in test_df.columns
    ):

        test_df[
            "change_aware_absolute_error"
        ] = (
            test_df[
                "target_next_price"
            ]
            - test_df[
                "change_aware_prediction"
            ]
        ).abs()

    if (
        "lightgbm_vs_baseline_improvement"
        not in test_df.columns
    ):

        test_df[
            "lightgbm_vs_baseline_improvement"
        ] = (
            test_df[
                "baseline_absolute_error"
            ]
            -
            test_df[
                "lightgbm_absolute_error"
            ]
        )

    if (
        "change_aware_vs_baseline_improvement"
        not in test_df.columns
    ):

        test_df[
            "change_aware_vs_baseline_improvement"
        ] = (
            test_df[
                "baseline_absolute_error"
            ]
            -
            test_df[
                "change_aware_absolute_error"
            ]
        )

    # --------------------------------------------------------
    # BASIC INFORMATION
    # --------------------------------------------------------

    print()
    print(
        "Rows prepared for drift analysis: "
        f"{len(test_df):,}"
    )

    print(
        "Products: "
        f"{test_df['product_id'].nunique():,}"
    )

    print(
        "Date range:"
    )

    print(
        f"  {test_df['recorded_at'].min()}"
        f" -> "
        f"{test_df['recorded_at'].max()}"
    )

    print()
    print(
        "Actual price-change rate: "
        f"{test_df['target_price_changed'].mean():.4f}"
    )

    # ========================================================
    # DAILY ANALYSIS
    # ========================================================

    print_header(
        "DAILY TEMPORAL PERFORMANCE"
    )

    daily = daily_performance(
        test_df
    )

    if not daily.empty:

        print(
            daily.to_string(
                index=False
            )
        )

    # ========================================================
    # TEMPORAL QUARTILES
    # ========================================================

    print_header(
        "TEMPORAL QUARTILE STABILITY"
    )

    temporal = temporal_quartile_analysis(
        test_df
    )

    if not temporal.empty:

        print(
            temporal.to_string(
                index=False
            )
        )

    # ========================================================
    # REFERENCE VS LATEST DRIFT
    # ========================================================

    print_header(
        "REFERENCE VS LATEST PERIOD DRIFT"
    )

    feature_drift, period_metadata = (
        latest_period_drift(
            test_df
        )
    )

    if not feature_drift.empty:

        print(
            feature_drift.to_string(
                index=False
            )
        )

    else:

        print(
            "Insufficient data for drift calculation."
        )

    # ========================================================
    # HORIZON
    # ========================================================

    print_header(
        "FORECAST-HORIZON STABILITY"
    )

    horizon = horizon_drift_analysis(
        test_df
    )

    if not horizon.empty:

        print(
            horizon.to_string(
                index=False
            )
        )

    # ========================================================
    # PROMOTION
    # ========================================================

    print_header(
        "PROMOTION STABILITY"
    )

    promotion = promotion_drift_analysis(
        test_df
    )

    if not promotion.empty:

        print(
            promotion.to_string(
                index=False
            )
        )

    # ========================================================
    # ERROR DRIFT
    # ========================================================

    print_header(
        "DAILY MODEL ERROR DRIFT"
    )

    errors = error_drift_analysis(
        test_df
    )

    if not errors.empty:

        print(
            errors.to_string(
                index=False
            )
        )

    # ========================================================
    # ROLLING DRIFT
    # ========================================================

    print_header(
        "TEMPORAL DISTRIBUTION MOVEMENT"
    )

    rolling = rolling_drift(
        test_df
    )

    if not rolling.empty:

        print(
            rolling.to_string(
                index=False
            )
        )

    # ========================================================
    # OVERALL STATUS
    # ========================================================

    overall_status = (
        calculate_overall_drift_status(
            feature_drift
        )
    )

    # ========================================================
    # METADATA
    # ========================================================

    metadata = {
        "script_version":
            SCRIPT_VERSION,
        "prediction_rows":
            int(len(test_df)),
        "products":
            int(
                test_df[
                    "product_id"
                ].nunique()
            ),
        "retailers":
            int(
                test_df[
                    "retailer_id"
                ].nunique()
            ),
        "first_prediction_timestamp":
            str(
                test_df[
                    "recorded_at"
                ].min()
            ),
        "last_prediction_timestamp":
            str(
                test_df[
                    "recorded_at"
                ].max()
            ),
        "number_of_temporal_periods":
            int(
                test_df[
                    "period"
                ].nunique()
            ),
        "actual_change_rate":
            round(
                float(
                    test_df[
                        "target_price_changed"
                    ].mean()
                ),
                6,
            ),
        "mean_change_probability":
            round(
                float(
                    test_df[
                        "change_probability"
                    ].mean()
                ),
                6,
            ),
        "reference_period":
            period_metadata.get(
                "reference_period"
            ),
        "latest_period":
            period_metadata.get(
                "latest_period"
            ),
        "reference_rows":
            period_metadata.get(
                "reference_rows"
            ),
        "latest_rows":
            period_metadata.get(
                "latest_rows"
            ),
        "overall_drift_status":
            overall_status,
    }

    # ========================================================
    # SAVE OUTPUTS
    # ========================================================

    print_header(
        "T11.7 OUTPUTS"
    )

    daily_path = (
        output_dir
        / "dl04_t11_7_daily_performance.csv"
    )

    temporal_path = (
        output_dir
        / "dl04_t11_7_temporal_quartile_analysis.csv"
    )

    feature_path = (
        output_dir
        / "dl04_t11_7_feature_drift.csv"
    )

    horizon_path = (
        output_dir
        / "dl04_t11_7_horizon_drift.csv"
    )

    promotion_path = (
        output_dir
        / "dl04_t11_7_promotion_drift.csv"
    )

    error_path = (
        output_dir
        / "dl04_t11_7_error_drift.csv"
    )

    rolling_path = (
        output_dir
        / "dl04_t11_7_rolling_drift.csv"
    )

    summary_path = (
        output_dir
        / "dl04_t11_7_drift_summary.json"
    )

    report_path = (
        output_dir
        / "DL-04-T11.7_Temporal_Drift_Report.md"
    )

    daily.to_csv(
        daily_path,
        index=False,
    )

    temporal.to_csv(
        temporal_path,
        index=False,
    )

    feature_drift.to_csv(
        feature_path,
        index=False,
    )

    horizon.to_csv(
        horizon_path,
        index=False,
    )

    promotion.to_csv(
        promotion_path,
        index=False,
    )

    errors.to_csv(
        error_path,
        index=False,
    )

    rolling.to_csv(
        rolling_path,
        index=False,
    )

    summary_path.write_text(
        json.dumps(
            metadata,
            indent=2,
            default=str,
        ),
        encoding="utf-8",
    )

    generate_report(
        report_path,
        metadata,
        daily,
        temporal,
        feature_drift,
        horizon,
        promotion,
        errors,
    )

    # ========================================================
    # FINAL SUMMARY
    # ========================================================

    print()
    print(
        "Overall drift status: "
        f"{overall_status}"
    )

    print()
    print(
        "Reference period: "
        f"{period_metadata.get('reference_period')}"
    )

    print(
        "Latest period: "
        f"{period_metadata.get('latest_period')}"
    )

    print()
    print(
        "Generated files:"
    )

    print(
        f"  {daily_path}"
    )

    print(
        f"  {temporal_path}"
    )

    print(
        f"  {feature_path}"
    )

    print(
        f"  {horizon_path}"
    )

    print(
        f"  {promotion_path}"
    )

    print(
        f"  {error_path}"
    )

    print(
        f"  {rolling_path}"
    )

    print(
        f"  {summary_path}"
    )

    print(
        f"  {report_path}"
    )

    print()
    print(
        "DL-04 T11.7 temporal drift analysis completed."
    )


if __name__ == "__main__":
    main()