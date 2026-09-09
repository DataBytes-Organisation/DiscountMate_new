from __future__ import annotations

import argparse
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd


# ============================================================
# DL-04 T11
# Standardised Prediction Output
# ============================================================

SCHEMA_VERSION = "1.0.0"
TASK_ID = "DL-04"
TASK_NAME = "Next-price forecasting"

REQUIRED_COLUMNS = [
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
    "horizon_bucket",
    "change_regime",
    "promotion_regime",
    "split",
]


# ============================================================
# Helpers
# ============================================================

def clean_value(value):
    """
    Convert pandas / NumPy values into JSON-safe Python values.
    """

    if pd.isna(value):
        return None

    if isinstance(value, (np.integer,)):
        return int(value)

    if isinstance(value, (np.floating,)):
        return float(value)

    if isinstance(value, (np.bool_,)):
        return bool(value)

    return value


def validate_columns(df: pd.DataFrame) -> None:
    missing = [
        column
        for column in REQUIRED_COLUMNS
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing required columns: {missing}"
        )


def parse_timestamps(df: pd.DataFrame) -> pd.DataFrame:

    df = df.copy()

    for column in [
        "recorded_at",
        "target_next_recorded_at",
    ]:
        df[column] = pd.to_datetime(
            df[column],
            format="mixed",
            utc=True,
            errors="coerce",
        )

    return df


def validate_data(df: pd.DataFrame) -> dict:

    checks = {}

    # --------------------------------------------------------
    # Required columns
    # --------------------------------------------------------

    checks["required_columns_present"] = all(
        column in df.columns
        for column in REQUIRED_COLUMNS
    )

    # --------------------------------------------------------
    # Row count
    # --------------------------------------------------------

    checks["non_empty_dataset"] = len(df) > 0

    # --------------------------------------------------------
    # IDs
    # --------------------------------------------------------

    checks["product_id_not_null"] = (
        df["product_id"].notna().all()
    )

    checks["retailer_id_not_null"] = (
        df["retailer_id"].notna().all()
    )

    # --------------------------------------------------------
    # Prediction fields
    # --------------------------------------------------------

    checks["baseline_prediction_not_null"] = (
        df["baseline_prediction"].notna().all()
    )

    checks["lightgbm_prediction_not_null"] = (
        df["lightgbm_predicted_next_price"].notna().all()
    )

    checks["change_aware_prediction_not_null"] = (
        df["change_aware_prediction"].notna().all()
    )

    # --------------------------------------------------------
    # Probability
    # --------------------------------------------------------

    probability = df["change_probability"]

    checks["change_probability_valid"] = bool(
        probability.notna().all()
        and (probability >= 0).all()
        and (probability <= 1).all()
    )

    # --------------------------------------------------------
    # Predicted class
    # --------------------------------------------------------

    predicted_changed = df["predicted_price_changed"]

    checks["predicted_change_class_valid"] = bool(
        predicted_changed.notna().all()
        and predicted_changed.isin([0, 1]).all()
    )

    # --------------------------------------------------------
    # Forecast horizon
    # --------------------------------------------------------

    horizon = df["target_days_ahead"]

    checks["forecast_horizon_positive"] = bool(
        horizon.notna().all()
        and (horizon > 0).all()
    )

    # --------------------------------------------------------
    # Timestamp ordering
    # --------------------------------------------------------

    timestamp_mask = (
        df["recorded_at"].notna()
        & df["target_next_recorded_at"].notna()
    )

    if timestamp_mask.any():

        checks["target_timestamp_after_observation"] = bool(
            (
                df.loc[
                    timestamp_mask,
                    "target_next_recorded_at",
                ]
                >
                df.loc[
                    timestamp_mask,
                    "recorded_at",
                ]
            ).all()
        )

    else:
        checks["target_timestamp_after_observation"] = False

    # --------------------------------------------------------
    # Duplicate prediction keys
    # --------------------------------------------------------

    checks["unique_prediction_keys"] = bool(
        ~df.duplicated(
            [
                "product_id",
                "retailer_id",
                "recorded_at",
            ]
        ).any()
    )

    # --------------------------------------------------------
    # Split validity
    # --------------------------------------------------------

    checks["valid_split_labels"] = bool(
        df["split"]
        .dropna()
        .isin(
            [
                "train",
                "validation",
                "test",
            ]
        )
        .all()
    )

    # --------------------------------------------------------
    # Overall
    # --------------------------------------------------------

    checks["all_checks_pass"] = all(
        checks.values()
    )

    return checks


# ============================================================
# JSON Schema
# ============================================================

def build_schema() -> dict:

    return {
        "$schema": (
            "https://json-schema.org/draft/2020-12/schema"
        ),
        "$id": (
            "https://discountmate.local/schema/"
            "dl04-t11-prediction-v1.json"
        ),
        "title": "DiscountMate DL-04 Prediction",
        "description": (
            "Standardised next-price forecasting output "
            "for DiscountMate DL-04."
        ),
        "type": "object",

        "required": [
            "schema_version",
            "task",
            "prediction_id",
            "product",
            "observation",
            "forecast",
            "model",
        ],

        "properties": {

            "schema_version": {
                "type": "string"
            },

            "task": {
                "type": "object",
                "required": [
                    "id",
                    "name",
                ],
                "properties": {
                    "id": {
                        "type": "string"
                    },
                    "name": {
                        "type": "string"
                    },
                },
                "additionalProperties": False,
            },

            "prediction_id": {
                "type": "string"
            },

            "generated_at": {
                "type": "string"
            },

            "product": {
                "type": "object",
                "required": [
                    "product_id",
                    "retailer_id",
                ],
                "properties": {
                    "product_id": {},
                    "retailer_id": {
                        "type": "string"
                    },
                },
                "additionalProperties": False,
            },

            "observation": {
                "type": "object",
                "required": [
                    "recorded_at",
                    "current_price",
                ],
                "properties": {
                    "recorded_at": {
                        "type": "string"
                    },
                    "current_price": {
                        "type": "number"
                    },
                },
                "additionalProperties": False,
            },

            "forecast": {
                "type": "object",
                "required": [
                    "target",
                    "horizon_days",
                    "horizon_bucket",
                    "baseline_prediction",
                    "lightgbm_prediction",
                    "change_aware_prediction",
                    "selected_prediction",
                    "change_probability",
                    "predicted_price_changed",
                ],
                "properties": {

                    "target": {
                        "type": "string"
                    },

                    "horizon_days": {
                        "type": "number",
                        "exclusiveMinimum": 0,
                    },

                    "horizon_bucket": {
                        "type": "string"
                    },

                    "baseline_prediction": {
                        "type": "number"
                    },

                    "lightgbm_prediction": {
                        "type": "number"
                    },

                    "change_aware_prediction": {
                        "type": "number"
                    },

                    "selected_prediction": {
                        "type": "number"
                    },

                    "change_probability": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1,
                    },

                    "predicted_price_changed": {
                        "type": "integer",
                        "enum": [0, 1],
                    },
                },

                "additionalProperties": False,
            },

            "regime": {
                "type": "object",
                "properties": {
                    "change_regime": {
                        "type": "string"
                    },
                    "promotion_regime": {
                        "type": "string"
                    },
                },
                "additionalProperties": False,
            },

            "model": {
                "type": "object",
                "required": [
                    "family",
                    "variant",
                ],
                "properties": {
                    "family": {
                        "type": "string"
                    },
                    "variant": {
                        "type": "string"
                    },
                },
                "additionalProperties": False,
            },

            "evaluation": {
                "type": "object",
                "properties": {
                    "split": {
                        "type": "string"
                    },
                    "actual_next_price": {
                        "type": [
                            "number",
                            "null",
                        ]
                    },
                    "actual_price_change": {
                        "type": [
                            "number",
                            "null",
                        ]
                    },
                    "actual_price_changed": {
                        "type": [
                            "integer",
                            "null",
                        ]
                    },
                },
                "additionalProperties": False,
            },
        },

        "additionalProperties": False,
    }


# ============================================================
# Prediction ID
# ============================================================

def create_prediction_id(
    product_id,
    retailer_id,
    recorded_at,
) -> str:

    raw = (
        f"{product_id}|"
        f"{retailer_id}|"
        f"{recorded_at}"
    )

    digest = hashlib.sha256(
        raw.encode("utf-8")
    ).hexdigest()[:16]

    return f"DL04-{digest}"


# ============================================================
# Build Prediction Record
# ============================================================

def build_prediction_record(
    row: pd.Series,
) -> dict:

    recorded_at = row["recorded_at"]

    if pd.notna(recorded_at):

        recorded_at_string = (
            recorded_at.isoformat()
        )

    else:
        recorded_at_string = None

    prediction_id = create_prediction_id(
        row["product_id"],
        row["retailer_id"],
        recorded_at_string,
    )

    selected_prediction = (
        row["change_aware_prediction"]
    )

    record = {

        "schema_version": SCHEMA_VERSION,

        "task": {
            "id": TASK_ID,
            "name": TASK_NAME,
        },

        "prediction_id": prediction_id,

        "generated_at": datetime.now(
            timezone.utc
        ).isoformat(),

        "product": {
            "product_id": clean_value(
                row["product_id"]
            ),
            "retailer_id": clean_value(
                row["retailer_id"]
            ),
        },

        "observation": {
            "recorded_at": recorded_at_string,
            "current_price": clean_value(
                row["price"]
            ),
        },

        "forecast": {

            "target": "next_available_price",

            "horizon_days": clean_value(
                row["target_days_ahead"]
            ),

            "horizon_bucket": clean_value(
                row["horizon_bucket"]
            ),

            "baseline_prediction": clean_value(
                row["baseline_prediction"]
            ),

            "lightgbm_prediction": clean_value(
                row[
                    "lightgbm_predicted_next_price"
                ]
            ),

            "change_aware_prediction": clean_value(
                row["change_aware_prediction"]
            ),

            "selected_prediction": clean_value(
                selected_prediction
            ),

            "change_probability": clean_value(
                row["change_probability"]
            ),

            "predicted_price_changed": clean_value(
                row["predicted_price_changed"]
            ),
        },

        "regime": {
            "change_regime": clean_value(
                row["change_regime"]
            ),
            "promotion_regime": clean_value(
                row["promotion_regime"]
            ),
        },

        "model": {
            "family": "LightGBM",
            "variant": (
                "change_aware_lightgbm"
            ),
        },

        "evaluation": {
            "split": clean_value(
                row["split"]
            ),

            "actual_next_price": clean_value(
                row["target_next_price"]
            ),

            "actual_price_change": clean_value(
                row["actual_price_change"]
            ),

            "actual_price_changed": clean_value(
                row["actual_price_changed"]
            ),
        },
    }

    return record


# ============================================================
# Markdown Report
# ============================================================

def create_report(
    df: pd.DataFrame,
    checks: dict,
    json_path: Path,
    schema_path: Path,
    output_path: Path,
) -> None:

    passed = sum(
        bool(value)
        for value in checks.values()
        if isinstance(value, bool)
        and value is not checks["all_checks_pass"]
    )

    total = sum(
        isinstance(value, bool)
        for key, value in checks.items()
        if key != "all_checks_pass"
    )

    test_rows = int(
        (df["split"] == "test").sum()
    )

    products = int(
        df["product_id"].nunique()
    )

    report = f"""# DL-04-T11 Standardised Prediction Output Report

## Purpose

T11 standardises DL-04 forecasting results into a machine-readable
prediction contract suitable for downstream DiscountMate components.

## Output

- Prediction JSON: `{json_path.name}`
- JSON Schema: `{schema_path.name}`
- Schema version: `{SCHEMA_VERSION}`

## Dataset

- Prediction rows: {len(df):,}
- Products: {products:,}
- Test rows: {test_rows:,}
- Retailers: {df['retailer_id'].nunique():,}

## Prediction Contract

Each prediction contains:

1. Product and retailer identity
2. Observation timestamp
3. Current observed price
4. Forecast horizon
5. Persistence baseline
6. Raw LightGBM forecast
7. Change-aware forecast
8. Selected forecast
9. Change probability
10. Predicted price-change class
11. Change and promotion regimes
12. Model metadata
13. Evaluation metadata

## Validation

| Check | Result |
| --- | --- |
"""

    for key, value in checks.items():

        if key == "all_checks_pass":
            continue

        status = (
            "PASS"
            if value
            else "FAIL"
        )

        report += (
            f"| `{key}` | {status} |\n"
        )

    report += f"""
## Validation Summary

- Checks passed: {passed}/{total}
- Overall validation: {"PASS" if checks["all_checks_pass"] else "FAIL"}

## Design Decision

The `change_aware_lightgbm` forecast is exposed as the selected prediction
because T9 established it as the final change-aware forecasting strategy.

The persistence baseline and raw LightGBM prediction are retained so that
downstream consumers and evaluators can compare the selected forecast
against the established benchmark.

## Important Interpretation

`change_probability` represents the output of the change detector. It should
not automatically be interpreted as a calibrated probability of a price
change until calibration has been separately validated.

## Reproducibility

The prediction identifier is deterministically generated from:

- product ID
- retailer ID
- observation timestamp

This allows a prediction record to be traced back to its source observation.

"""

    output_path.write_text(
        report,
        encoding="utf-8",
    )


# ============================================================
# Main
# ============================================================

def main() -> None:

    parser = argparse.ArgumentParser(
        description=(
            "DL-04 T11 standardised prediction "
            "output generator."
        )
    )

    parser.add_argument(
        "--input",
        required=True,
        help=(
            "T10 enriched test prediction CSV."
        ),
    )

    parser.add_argument(
        "--output-dir",
        required=True,
        help="Output directory.",
    )

    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    json_path = (
        output_dir
        / "dl04_t11_predictions.json"
    )

    schema_path = (
        output_dir
        / "dl04_t11_prediction_schema.json"
    )

    report_path = (
        output_dir
        / "DL-04-T11_Prediction_Output_Report.md"
    )

    print("=" * 70)
    print(
        "DL-04 T11 STANDARDISED PREDICTION OUTPUT"
    )
    print("=" * 70)

    print()
    print(f"Input: {input_path}")
    print(f"Output: {output_dir}")

    # --------------------------------------------------------
    # Load
    # --------------------------------------------------------

    df = pd.read_csv(input_path)

    print()
    print(
        f"Rows loaded: {len(df):,}"
    )

    # --------------------------------------------------------
    # Validate structure
    # --------------------------------------------------------

    validate_columns(df)

    df = parse_timestamps(df)

    # --------------------------------------------------------
    # Data validation
    # --------------------------------------------------------

    checks = validate_data(df)

    print()
    print("=" * 70)
    print("T11 DATA VALIDATION")
    print("=" * 70)

    for key, value in checks.items():

        if key == "all_checks_pass":
            continue

        status = (
            "PASS"
            if value
            else "FAIL"
        )

        print(
            f"{status:5s} {key}"
        )

    print()
    print(
        "Overall:",
        "PASS"
        if checks["all_checks_pass"]
        else "FAIL",
    )

    if not checks["all_checks_pass"]:

        raise ValueError(
            "T11 validation failed. "
            "Prediction output was not generated."
        )

    # --------------------------------------------------------
    # Build JSON records
    # --------------------------------------------------------

    print()
    print(
        "Generating standardised prediction records..."
    )

    records = [
        build_prediction_record(row)
        for _, row in df.iterrows()
    ]

    # --------------------------------------------------------
    # Write JSON
    # --------------------------------------------------------

    payload = {
        "schema_version": SCHEMA_VERSION,

        "task": {
            "id": TASK_ID,
            "name": TASK_NAME,
        },

        "generated_at": datetime.now(
            timezone.utc
        ).isoformat(),

        "record_count": len(records),

        "predictions": records,
    }

    with json_path.open(
        "w",
        encoding="utf-8",
    ) as handle:

        json.dump(
            payload,
            handle,
            indent=2,
            ensure_ascii=False,
        )

    # --------------------------------------------------------
    # Write schema
    # --------------------------------------------------------

    schema = build_schema()

    with schema_path.open(
        "w",
        encoding="utf-8",
    ) as handle:

        json.dump(
            schema,
            handle,
            indent=2,
            ensure_ascii=False,
        )

    # --------------------------------------------------------
    # Write report
    # --------------------------------------------------------

    create_report(
        df=df,
        checks=checks,
        json_path=json_path,
        schema_path=schema_path,
        output_path=report_path,
    )

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("DL-04 T11 SUMMARY")
    print("=" * 70)

    print(
        f"Prediction records: {len(records):,}"
    )

    print(
        f"Products: "
        f"{df['product_id'].nunique():,}"
    )

    print(
        f"Retailers: "
        f"{df['retailer_id'].nunique():,}"
    )

    print()
    print(
        "Selected forecast: "
        "change_aware_lightgbm"
    )

    print()
    print("Generated files:")

    print(
        f"  {json_path}"
    )

    print(
        f"  {schema_path}"
    )

    print(
        f"  {report_path}"
    )

    print()
    print(
        "DL-04 T11 prediction output completed."
    )


if __name__ == "__main__":
    main()