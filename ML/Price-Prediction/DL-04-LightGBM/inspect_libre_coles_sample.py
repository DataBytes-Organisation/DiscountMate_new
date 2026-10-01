from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

import pandas as pd


# ============================================================
# DL-04 Coles Dataset Inspection
# DiscountMate - LightGBM Price Forecasting
# ============================================================

# Optional local dependencies
LOCAL_DEPS = Path(__file__).resolve().parent / ".python_deps"

if LOCAL_DEPS.exists():
    sys.path.insert(0, str(LOCAL_DEPS))


# ------------------------------------------------------------
# Input dataset
# ------------------------------------------------------------

SAMPLE_PATH = Path(
    "data\\raw\\2024-03-05T20_36_54+10_00.jsonl"
)


# ------------------------------------------------------------
# Read JSONL records
# ------------------------------------------------------------

def read_records(
    path: Path,
    limit: int = 5000
) -> list[dict]:

    records = []

    with path.open(
        "r",
        encoding="utf-8",
        errors="replace"
    ) as fh:

        for line in fh:

            if line.strip():

                records.append(
                    json.loads(line)
                )

                if len(records) >= limit:
                    break

    return records


# ------------------------------------------------------------
# Flatten nested JSON
# ------------------------------------------------------------

def flatten(record: dict) -> dict:

    flat = {}

    for key, value in record.items():

        if isinstance(value, dict):

            for sub_key, sub_value in value.items():

                flat[f"{key}.{sub_key}"] = sub_value

        elif isinstance(value, list):

            flat[key] = json.dumps(value)[:250]

        else:

            flat[key] = value

    return flat


# ------------------------------------------------------------
# Main inspection
# ------------------------------------------------------------

def main() -> None:

    print("=" * 60)
    print("DL-04 COLES DATASET INSPECTION")
    print("=" * 60)

    print(f"\nInput file:")
    print(SAMPLE_PATH)

    print("\nReading sample records...")

    records = read_records(
        SAMPLE_PATH,
        limit=5000
    )

    print(
        f"Sample records read: {len(records):,}"
    )

    if not records:

        print("No records found.")

        return

    # --------------------------------------------------------
    # Top-level keys
    # --------------------------------------------------------

    key_counts = Counter()

    for record in records:

        key_counts.update(
            record.keys()
        )

    print("\n")
    print("=" * 60)
    print("TOP-LEVEL JSON KEYS")
    print("=" * 60)

    for key, count in key_counts.most_common():

        print(
            f"{key}: {count:,}"
        )

    # --------------------------------------------------------
    # Flatten records
    # --------------------------------------------------------

    df = pd.DataFrame(
        flatten(record)
        for record in records
    )

    # --------------------------------------------------------
    # Dataset shape
    # --------------------------------------------------------

    print("\n")
    print("=" * 60)
    print("SAMPLE DATASET SHAPE")
    print("=" * 60)

    print(
        f"Rows: {len(df):,}"
    )

    print(
        f"Columns: {len(df.columns):,}"
    )

    # --------------------------------------------------------
    # Columns
    # --------------------------------------------------------

    print("\n")
    print("=" * 60)
    print("AVAILABLE COLUMNS")
    print("=" * 60)

    for column in df.columns:

        print(column)

    # --------------------------------------------------------
    # Sample records
    # --------------------------------------------------------

    print("\n")
    print("=" * 60)
    print("SAMPLE RECORDS")
    print("=" * 60)

    print(
        df.head(3).to_string()
    )

    # --------------------------------------------------------
    # Important forecasting fields
    # --------------------------------------------------------

    possible_cols = [

        # Product information
        "id",
        "product_id",
        "name",
        "title",
        "brand",
        "size",

        # Pricing
        "pricing.now",
        "pricing.was",
        "pricing.comparable",
        "pricing.onlineSpecial",

        # Unit pricing
        "pricing.unit.price",
        "pricing.unit.quantity",
        "pricing.unit.ofMeasureQuantity",
        "pricing.unit.ofMeasureType",
        "pricing.unit.ofMeasureUnits",

        # Promotion
        "pricing.saveAmount",
        "pricing.saveStatement",
        "pricing.offerDescription",
        "pricing.promotionType",
        "pricing.specialType",

        # Store / category
        "store",
        "category",
        "aisle",

        # Timestamp
        "lastUpdated",
        "scraped_at",

        # URL
        "url",
    ]

    print("\n")
    print("=" * 60)
    print("IMPORTANT COLUMN SUMMARY")
    print("=" * 60)

    for col in possible_cols:

        if col in df.columns:

            non_null = int(
                df[col].notna().sum()
            )

            unique = int(
                df[col].nunique(
                    dropna=True
                )
            )

            samples = (
                df[col]
                .dropna()
                .head(3)
                .tolist()
            )

            print(f"\n{col}")

            print(
                f"  Non-null: {non_null:,}"
            )

            print(
                f"  Unique: {unique:,}"
            )

            print(
                f"  Samples: {samples}"
            )

    # --------------------------------------------------------
    # Unique identifiers
    # --------------------------------------------------------

    print("\n")
    print("=" * 60)
    print("UNIQUE VALUE COUNTS")
    print("=" * 60)

    identifier_columns = [

        "id",
        "product_id",
        "name",
        "title",
        "brand",
        "category",
        "aisle",
        "store",
    ]

    for col in identifier_columns:

        if col in df.columns:

            unique_count = df[col].nunique(
                dropna=True
            )

            print(
                f"{col}: {unique_count:,}"
            )

    # --------------------------------------------------------
    # Missing values
    # --------------------------------------------------------

    print("\n")
    print("=" * 60)
    print("MISSING VALUES")
    print("=" * 60)

    missing = (
        df.isnull()
        .sum()
        .sort_values(
            ascending=False
        )
    )

    for col, count in missing.items():

        if count > 0:

            percentage = (
                count / len(df) * 100
            )

            print(
                f"{col}: "
                f"{count:,} "
                f"({percentage:.2f}%)"
            )

    # --------------------------------------------------------
    # Price checks
    # --------------------------------------------------------

    print("\n")
    print("=" * 60)
    print("PRICE INFORMATION")
    print("=" * 60)

    if "pricing.now" in df.columns:

        price = pd.to_numeric(
            df["pricing.now"],
            errors="coerce"
        )

        print(
            f"Current price records: "
            f"{price.notna().sum():,}"
        )

        print(
            f"Current price <= 0: "
            f"{(price <= 0).sum():,}"
        )

        print(
            f"Current price range: "
            f"{price.min()} - {price.max()}"
        )

    if "pricing.was" in df.columns:

        previous_price = pd.to_numeric(
            df["pricing.was"],
            errors="coerce"
        )

        print(
            f"Previous/original price records: "
            f"{previous_price.notna().sum():,}"
        )

        print(
            f"Previous price > 0: "
            f"{(previous_price > 0).sum():,}"
        )

    # --------------------------------------------------------
    # Promotion check
    # --------------------------------------------------------

    print("\n")
    print("=" * 60)
    print("PROMOTION INFORMATION")
    print("=" * 60)

    if "pricing.onlineSpecial" in df.columns:

        promotion = df[
            "pricing.onlineSpecial"
        ]

        print(
            "pricing.onlineSpecial values:"
        )

        print(
            promotion.value_counts(
                dropna=False
            )
        )

    # --------------------------------------------------------
    # Timestamp check
    # --------------------------------------------------------

    print("\n")
    print("=" * 60)
    print("TIMESTAMP INFORMATION")
    print("=" * 60)

    if "lastUpdated" in df.columns:

        timestamps = pd.to_datetime(
            df["lastUpdated"],
            errors="coerce"
        )

        print(
            f"Valid timestamps: "
            f"{timestamps.notna().sum():,}"
        )

        print(
            f"Earliest timestamp: "
            f"{timestamps.min()}"
        )

        print(
            f"Latest timestamp: "
            f"{timestamps.max()}"
        )

    # --------------------------------------------------------
    # Product ID check
    # --------------------------------------------------------

    print("\n")
    print("=" * 60)
    print("PRODUCT ID CHECK")
    print("=" * 60)

    if "id" in df.columns:

        product_ids = df["id"]

        print(
            f"Total product records: "
            f"{len(product_ids):,}"
        )

        print(
            f"Unique product IDs: "
            f"{product_ids.nunique():,}"
        )

        duplicate_count = (
            product_ids.duplicated()
            .sum()
        )

        print(
            f"Duplicate product IDs "
            f"in sample: "
            f"{duplicate_count:,}"
        )

    # --------------------------------------------------------
    # Store check
    # --------------------------------------------------------

    print("\n")
    print("=" * 60)
    print("STORE INFORMATION")
    print("=" * 60)

    if "store" in df.columns:

        print(
            df["store"]
            .value_counts(
                dropna=False
            )
        )

    # --------------------------------------------------------
    # Finish
    # --------------------------------------------------------

    print("\n")
    print("=" * 60)
    print("DATASET INSPECTION COMPLETED")
    print("=" * 60)

    print(
        "\nNext step:"
    )

    print(
        "Review the output to determine "
        "whether the dataset supports "
        "historical next-price forecasting."
    )


# ------------------------------------------------------------
# Run
# ------------------------------------------------------------

if __name__ == "__main__":
    main()