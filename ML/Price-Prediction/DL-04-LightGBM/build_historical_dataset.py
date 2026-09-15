from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd
import zstandard as zstd


RAW_DIR = Path("data/raw")
OUTPUT_DIR = Path("data/processed")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def read_jsonl(path: Path):
    """Read an uncompressed JSONL file."""

    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()

            if line:
                yield json.loads(line)


def read_jsonl_zst(path: Path):
    """Read a compressed JSONL Zstandard file."""

    with path.open("rb") as fh:
        dctx = zstd.ZstdDecompressor()

        with dctx.stream_reader(fh) as reader:
            buffer = ""

            while True:
                chunk = reader.read(1024 * 1024)

                if not chunk:
                    break

                buffer += chunk.decode("utf-8", "replace")

                lines = buffer.split("\n")
                buffer = lines.pop()

                for line in lines:
                    line = line.strip()

                    if line:
                        yield json.loads(line)

            if buffer.strip():
                yield json.loads(buffer)


def read_snapshot(path: Path, max_records: int = 0):

    if path.suffix == ".zst":
        iterator = read_jsonl_zst(path)
    else:
        iterator = read_jsonl(path)

    count = 0

    for record in iterator:

        yield record

        count += 1

        if max_records > 0 and count >= max_records:
            break


def extract_record(record: dict, source_file: str):

    pricing = record.get("pricing") or {}
    unit = pricing.get("unit") or {}

    timestamp = record.get("lastUpdated")

    if not timestamp:
        return None

    price = pricing.get("now")

    if price is None:
        return None

    previous_price = pricing.get("was")

    save_amount = pricing.get("saveAmount")

    save_percent = pricing.get("savePercent")

    promotion_type = pricing.get("promotionType")

    special_type = pricing.get("specialType")

    offer_description = pricing.get("offerDescription")

    online_special = pricing.get("onlineSpecial")

    unit_price = unit.get("price")

    return {
        "product_id": str(record.get("id")),
        "retailer_id": "coles",
        "recorded_at": timestamp,
        "price": float(price),
        "previous_price_source": (
            float(previous_price)
            if previous_price is not None
            else None
        ),
        "unit_price": (
            float(unit_price)
            if unit_price is not None
            else None
        ),
        "discount_amount": (
            float(save_amount)
            if save_amount is not None
            else None
        ),
        "discount_percent": (
            float(save_percent)
            if save_percent is not None
            else None
        ),
        "is_on_special": int(
            bool(online_special)
            or save_amount is not None
            or promotion_type is not None
            or special_type is not None
        ),
        "promotion_type": promotion_type,
        "special_type": special_type,
        "offer_description": offer_description,
        "source_file": source_file,
    }


def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Maximum records per snapshot. 0 = all.",
    )

    args = parser.parse_args()

    files = sorted(
        list(RAW_DIR.glob("*.jsonl"))
        + list(RAW_DIR.glob("*.jsonl.zst"))
    )

    if not files:
        raise FileNotFoundError(
            f"No JSONL/JSONL.ZST files found in {RAW_DIR}"
        )

    print("=" * 70)
    print("DL-04 HISTORICAL DATASET BUILDER")
    print("=" * 70)

    print(f"Files found: {len(files)}")

    rows = []

    for path in files:

        print(f"\nReading: {path.name}")

        count_before = len(rows)

        for record in read_snapshot(
            path,
            max_records=args.limit,
        ):

            extracted = extract_record(
                record,
                path.name,
            )

            if extracted is not None:
                rows.append(extracted)

        added = len(rows) - count_before

        print(f"Records added: {added:,}")

    df = pd.DataFrame(rows)

    if df.empty:
        raise RuntimeError("No usable records were extracted.")

    df["recorded_at"] = pd.to_datetime(
        df["recorded_at"],
        errors="coerce",
        utc=True,
    )

    df = df.dropna(
        subset=[
            "product_id",
            "recorded_at",
            "price",
        ]
    )

    df = df.sort_values(
        [
            "product_id",
            "recorded_at",
        ]
    )

    # Remove duplicate product observations at the same timestamp.
    df = df.drop_duplicates(
        subset=[
            "product_id",
            "recorded_at",
        ],
        keep="last",
    )

    output_path = (
        OUTPUT_DIR
        / "coles_historical_prices.csv"
    )

    df.to_csv(
        output_path,
        index=False,
    )

    print("\n" + "=" * 70)
    print("HISTORICAL DATASET CREATED")
    print("=" * 70)

    print(f"Rows: {len(df):,}")
    print(f"Products: {df['product_id'].nunique():,}")
    print(f"Retailer: {df['retailer_id'].unique().tolist()}")

    print(
        f"Date range: "
        f"{df['recorded_at'].min()} "
        f"to "
        f"{df['recorded_at'].max()}"
    )

    print("\nRecords per snapshot:")

    print(
        df.groupby(
            df["recorded_at"].dt.date
        ).size()
    )

    print(f"\nSaved to: {output_path}")


if __name__ == "__main__":
    main()