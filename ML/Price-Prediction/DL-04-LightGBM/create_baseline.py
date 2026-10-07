from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
import pandas as pd


# ============================================================
# METRICS
# ============================================================

def smape(
    actual: pd.Series,
    predicted: pd.Series,
) -> float:

    actual = pd.to_numeric(actual, errors="coerce")
    predicted = pd.to_numeric(predicted, errors="coerce")

    denominator = (
        actual.abs() + predicted.abs()
    ) / 2

    values = np.where(
        denominator == 0,
        0,
        (actual - predicted).abs() / denominator,
    )

    return float(
        np.mean(values) * 100
    )


def directional_accuracy(
    actual: pd.Series,
    predicted: pd.Series,
    current_price: pd.Series,
) -> float:

    actual = pd.to_numeric(
        actual,
        errors="coerce",
    )

    predicted = pd.to_numeric(
        predicted,
        errors="coerce",
    )

    current_price = pd.to_numeric(
        current_price,
        errors="coerce",
    )

    actual_delta = (
        actual - current_price
    )

    predicted_delta = (
        predicted - current_price
    )

    actual_trend = np.where(
        actual_delta > 0.05,
        "up",
        np.where(
            actual_delta < -0.05,
            "down",
            "stable",
        ),
    )

    predicted_trend = np.where(
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
            actual_trend
            == predicted_trend
        )
    )


# ============================================================
# TIME SPLIT FALLBACK
# ============================================================

def create_time_split(
    df: pd.DataFrame,
) -> pd.DataFrame:

    """
    Create a chronological 70/15/15 split.

    This function is ONLY used when the input dataset
    does not already contain a 'split' column.

    If 'split' already exists, the existing split must
    be preserved so that baseline and ML evaluation use
    exactly the same observations.
    """

    df = df.copy()

    df["recorded_at"] = pd.to_datetime(
        df["recorded_at"],
        format="mixed",
        utc=True,
        errors="coerce",
    )

    df = df.dropna(
        subset=["recorded_at"]
    )

    df = df.sort_values(
        "recorded_at"
    ).reset_index(
        drop=True
    )

    unique_dates = (
        df["recorded_at"]
        .dt.date
        .drop_duplicates()
        .tolist()
    )

    n_dates = len(
        unique_dates
    )

    if n_dates < 3:
        raise ValueError(
            "Need at least 3 distinct dates "
            "for train/validation/test split. "
            f"Found {n_dates}."
        )

    train_end = max(
        1,
        int(n_dates * 0.70),
    )

    validation_end = max(
        train_end + 1,
        int(n_dates * 0.85),
    )

    # Protect against validation_end exceeding
    # available dates.
    validation_end = min(
        validation_end,
        n_dates - 1,
    )

    train_dates = set(
        unique_dates[:train_end]
    )

    validation_dates = set(
        unique_dates[
            train_end:validation_end
        ]
    )

    test_dates = set(
        unique_dates[
            validation_end:
        ]
    )

    df["split"] = "test"

    df.loc[
        df["recorded_at"]
        .dt.date
        .isin(train_dates),
        "split",
    ] = "train"

    df.loc[
        df["recorded_at"]
        .dt.date
        .isin(validation_dates),
        "split",
    ] = "validation"

    df.loc[
        df["recorded_at"]
        .dt.date
        .isin(test_dates),
        "split",
    ] = "test"

    return df


# ============================================================
# SPLIT HANDLING
# ============================================================

def ensure_split(
    df: pd.DataFrame,
) -> pd.DataFrame:

    """
    Use an existing split column when available.

    This is important because the DL-04 training dataset
    already contains the authoritative shared split.

    If split is missing, create a chronological fallback.
    """

    df = df.copy()

    if "split" in df.columns:

        print(
            "\nExisting 'split' column detected."
        )

        print(
            "Using the existing shared split "
            "from the training dataset."
        )

        # Normalize split values.
        df["split"] = (
            df["split"]
            .astype(str)
            .str.strip()
            .str.lower()
        )

        valid_splits = {
            "train",
            "validation",
            "test",
        }

        invalid = sorted(
            set(df["split"].dropna())
            - valid_splits
        )

        if invalid:
            raise ValueError(
                "Invalid values found in "
                f"'split' column: {invalid}. "
                "Expected only train, validation, test."
            )

        missing_split = df["split"].isna()

        if missing_split.any():
            raise ValueError(
                f"{missing_split.sum():,} rows have "
                "missing split values."
            )

        return df

    print(
        "\nNo 'split' column found."
    )

    print(
        "Creating chronological fallback split."
    )

    return create_time_split(df)


# ============================================================
# EVALUATION
# ============================================================

def evaluate(
    part: pd.DataFrame,
) -> dict:

    actual = pd.to_numeric(
        part["target_next_price"],
        errors="coerce",
    )

    predicted = pd.to_numeric(
        part["baseline_predicted_next_price"],
        errors="coerce",
    )

    current_price = pd.to_numeric(
        part["price"],
        errors="coerce",
    )

    valid = (
        actual.notna()
        & predicted.notna()
        & current_price.notna()
    )

    actual = actual.loc[valid]
    predicted = predicted.loc[valid]
    current_price = current_price.loc[valid]

    if len(actual) == 0:
        raise ValueError(
            "No valid rows available for evaluation "
            f"for split '{part['split'].iloc[0]}'."
        )

    mae = float(
        np.mean(
            np.abs(
                actual - predicted
            )
        )
    )

    rmse = math.sqrt(
        float(
            np.mean(
                (
                    actual
                    - predicted
                ) ** 2
            )
        )
    )

    return {
        "split": part["split"].iloc[0],
        "model": "last_known_price",
        "rows": int(len(actual)),
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "smape_percent": round(
            smape(
                actual,
                predicted,
            ),
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
# MAIN
# ============================================================

def main() -> None:

    parser = argparse.ArgumentParser(
        description=(
            "Create DL-04 last-known-price "
            "baseline using the shared dataset split."
        )
    )

    parser.add_argument(
        "--input",
        required=True,
        help="Input DL-04 training dataset CSV.",
    )

    parser.add_argument(
        "--output",
        required=True,
        help="Output baseline results CSV.",
    )

    args = parser.parse_args()

    input_path = Path(
        args.input
    )

    output_path = Path(
        args.output
    )

    print("=" * 70)
    print("DL-04 BASELINE CREATION")
    print("=" * 70)

    print(
        f"Input: {input_path}"
    )

    # --------------------------------------------------------
    # Load dataset
    # --------------------------------------------------------

    df = pd.read_csv(
        input_path,
        low_memory=False,
    )

    print(
        f"Rows: {len(df):,}"
    )

    # --------------------------------------------------------
    # Required columns
    # --------------------------------------------------------

    required_columns = [
        "product_id",
        "retailer_id",
        "recorded_at",
        "price",
        "target_next_price",
    ]

    missing = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing required columns: {missing}"
        )

    # --------------------------------------------------------
    # Parse timestamp
    # --------------------------------------------------------

    df["recorded_at"] = pd.to_datetime(
        df["recorded_at"],
        format="mixed",
        utc=True,
        errors="coerce",
    )

    invalid_dates = (
        df["recorded_at"].isna().sum()
    )

    if invalid_dates > 0:
        print(
            f"\nWarning: removing "
            f"{invalid_dates:,} rows with invalid "
            "recorded_at values."
        )

        df = df.dropna(
            subset=["recorded_at"]
        ).copy()

    # --------------------------------------------------------
    # Ensure shared split
    # --------------------------------------------------------

    df = ensure_split(df)

    # --------------------------------------------------------
    # Display split counts
    # --------------------------------------------------------

    print()
    print("Split:")

    split_counts = (
        df["split"]
        .value_counts()
        .reindex(
            [
                "test",
                "train",
                "validation",
            ],
            fill_value=0,
        )
    )

    print(
        split_counts.to_string()
    )

    # --------------------------------------------------------
    # Display date ranges
    # --------------------------------------------------------

    print()
    print("Date ranges:")

    for split in [
        "train",
        "validation",
        "test",
    ]:

        part = df[
            df["split"] == split
        ]

        if part.empty:
            print(
                f"{split:10s}: EMPTY"
            )
            continue

        print(
            f"{split:10s}: "
            f"{part['recorded_at'].min()} "
            f"-> "
            f"{part['recorded_at'].max()}"
        )

    # --------------------------------------------------------
    # Last-known-price baseline
    #
    # Prediction = current observed price
    #
    # For next-price forecasting:
    #
    #     predicted next price = current price
    # --------------------------------------------------------

    df[
        "baseline_predicted_next_price"
    ] = pd.to_numeric(
        df["price"],
        errors="coerce",
    )

    # --------------------------------------------------------
    # Evaluate each split
    # --------------------------------------------------------

    results = []

    for split in [
        "train",
        "validation",
        "test",
    ]:

        part = df[
            df["split"] == split
        ].copy()

        if part.empty:
            continue

        results.append(
            evaluate(part)
        )

    results_df = pd.DataFrame(
        results
    )

    # --------------------------------------------------------
    # Print results
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("BASELINE RESULTS")
    print("=" * 70)

    print(
        results_df.to_string(
            index=False
        )
    )

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    results_df.to_csv(
        output_path,
        index=False,
    )

    print()
    print(
        f"Saved: {output_path}"
    )

    print()
    print(
        "Baseline creation completed."
    )


if __name__ == "__main__":
    main()