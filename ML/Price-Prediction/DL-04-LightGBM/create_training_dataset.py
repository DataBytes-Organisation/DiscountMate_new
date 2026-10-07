from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
import pandas as pd


def smape(actual: pd.Series, predicted: pd.Series) -> float:
    denominator = (actual.abs() + predicted.abs()) / 2

    values = np.where(
        denominator == 0,
        0,
        (actual - predicted).abs() / denominator,
    )

    return float(np.mean(values) * 100)


def directional_accuracy(
    actual: pd.Series,
    predicted: pd.Series,
    current_price: pd.Series,
) -> float:

    actual_delta = actual - current_price
    predicted_delta = predicted - current_price

    actual_trend = np.where(
        actual_delta > 0.05,
        "up",
        np.where(actual_delta < -0.05, "down", "stable"),
    )

    predicted_trend = np.where(
        predicted_delta > 0.05,
        "up",
        np.where(predicted_delta < -0.05, "down", "stable"),
    )

    return float(np.mean(actual_trend == predicted_trend))


def evaluate(part: pd.DataFrame) -> dict:

    actual = part["target_next_price"]
    predicted = part["baseline_predicted_next_price"]

    mae = float(
        np.mean(np.abs(actual - predicted))
    )

    rmse = math.sqrt(
        float(np.mean((actual - predicted) ** 2))
    )

    return {
        "split": part["split"].iloc[0],
        "model": "last_known_price",
        "rows": int(len(part)),
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
                part["price"],
            ),
            4,
        ),
    }


def main() -> None:

    parser = argparse.ArgumentParser(
        description="Create DL-04 last-known-price baseline using the existing shared split."
    )

    parser.add_argument(
        "--input",
        required=True,
    )

    parser.add_argument(
        "--output",
        required=True,
    )

    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    print("=" * 70)
    print("DL-04 BASELINE CREATION")
    print("=" * 70)

    print(f"Input: {input_path}")

    # ------------------------------------------------------------
    # Load dataset
    # ------------------------------------------------------------

    df = pd.read_csv(
        input_path,
        parse_dates=["recorded_at"],
    )

    print(f"Rows: {len(df):,}")

    # ------------------------------------------------------------
    # Required columns
    # ------------------------------------------------------------

    required_columns = [
        "product_id",
        "retailer_id",
        "recorded_at",
        "price",
        "target_next_price",
        "split",
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

    # ------------------------------------------------------------
    # Clean datetime
    # ------------------------------------------------------------

    df["recorded_at"] = pd.to_datetime(
        df["recorded_at"],
        format="mixed",
        utc=True,
        errors="coerce",
    )

    df = df.dropna(
        subset=[
            "recorded_at",
            "price",
            "target_next_price",
        ]
    ).copy()

    # ------------------------------------------------------------
    # IMPORTANT:
    # Use the existing shared split created by
    # create_training_dataset.py.
    #
    # Do NOT recreate the split here.
    # ------------------------------------------------------------

    valid_splits = {
        "train",
        "validation",
        "test",
    }

    actual_splits = set(
        df["split"].dropna().unique()
    )

    invalid_splits = actual_splits - valid_splits

    if invalid_splits:
        raise ValueError(
            f"Unexpected split values found: {sorted(invalid_splits)}"
        )

    if not valid_splits.issubset(actual_splits):
        raise ValueError(
            "Dataset must contain train, validation and test splits."
        )

    print()
    print("Using existing shared split:")
    print(
        df["split"]
        .value_counts()
        .sort_index()
        .to_string()
    )

    # ------------------------------------------------------------
    # Date ranges
    #
    # These are informational only.
    # The split itself is NOT recreated from these dates.
    # ------------------------------------------------------------

    print()
    print("Recorded-at date ranges:")

    for split in [
        "train",
        "validation",
        "test",
    ]:

        part = df[df["split"] == split]

        if part.empty:
            continue

        print(
            f"{split:10s}: "
            f"{part['recorded_at'].min()} "
            f"-> "
            f"{part['recorded_at'].max()}"
        )

    # ------------------------------------------------------------
    # Last-known-price baseline
    #
    # Prediction = current observed price
    # ------------------------------------------------------------

    df["baseline_predicted_next_price"] = (
        df["price"]
    )

    # ------------------------------------------------------------
    # Evaluate
    # ------------------------------------------------------------

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

    # ------------------------------------------------------------
    # Save results
    # ------------------------------------------------------------

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    results_df.to_csv(
        output_path,
        index=False,
    )

    # ------------------------------------------------------------
    # Print results
    # ------------------------------------------------------------

    print()
    print("=" * 70)
    print("BASELINE RESULTS")
    print("=" * 70)

    print(
        results_df.to_string(
            index=False
        )
    )

    print()
    print(f"Saved: {output_path}")

    print()
    print("Baseline creation completed.")


if __name__ == "__main__":
    main()