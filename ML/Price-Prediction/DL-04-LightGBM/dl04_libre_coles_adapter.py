from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote


LOCAL_DEPS = Path(__file__).resolve().parent / ".python_deps"
if LOCAL_DEPS.exists():
    sys.path.insert(0, str(LOCAL_DEPS))

import zstandard as zstd


OUTPUT_COLUMNS = [
    "id",
    "recorded_at",
    "product_id",
    "category_id",
    "retailer_id",
    "item_name",
    "special_text",
    "product_url",
    "price",
    "unit_price",
    "is_on_special",
    "created_at",
    "source_dataset",
    "source_file",
    "source_product_id",
    "source_store_id",
    "source_last_updated",
    "source_size",
    "source_price_was",
    "source_save_amount",
    "source_promotion_type",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert Libre Coles raw price snapshots to the DL-04 standard schema."
    )
    parser.add_argument("--input", nargs="+", required=True, help="One or more .jsonl.zst files.")
    parser.add_argument("--output", required=True, help="Output CSV path.")
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Optional maximum records to convert across all input files. Use 0 for all.",
    )
    return parser.parse_args()


def snapshot_timestamp(path: Path) -> str:
    raw = unquote(path.name).replace(".jsonl.zst", "")
    try:
        return datetime.fromisoformat(raw).isoformat()
    except ValueError:
        return raw


def iter_jsonl_zst(path: Path):
    with path.open("rb") as fh:
        reader = zstd.ZstdDecompressor().stream_reader(fh)
        buffer = ""
        while True:
            chunk = reader.read(1024 * 1024)
            if not chunk:
                break
            buffer += chunk.decode("utf-8", "replace")
            lines = buffer.split("\n")
            buffer = lines.pop()
            for line in lines:
                if line.strip():
                    yield json.loads(line)
        if buffer.strip():
            yield json.loads(buffer)


def promotion_text(pricing: dict) -> str:
    candidates = [
        pricing.get("saveStatement"),
        pricing.get("offerDescription"),
        pricing.get("promotionType"),
        pricing.get("specialType"),
        pricing.get("priceDescription"),
    ]
    return " | ".join(str(value) for value in candidates if value)


def standardize_record(record: dict, source_file: Path, recorded_at: str) -> dict | None:
    pricing = record.get("pricing") or {}
    product_id = record.get("id")
    store_id = record.get("store", "unknown")
    price = pricing.get("now")
    if product_id is None or price in (None, ""):
        return None

    unit = pricing.get("unit") or {}
    unit_price = unit.get("price")
    was_price = pricing.get("was")
    save_amount = pricing.get("saveAmount")
    promotion_type = pricing.get("promotionType")
    is_on_special = bool(
        promotion_type
        or pricing.get("onlineSpecial")
        or (save_amount is not None and float(save_amount or 0) > 0)
        or (
            was_price not in (None, "", 0)
            and price not in (None, "")
            and float(was_price) > float(price)
        )
    )

    source_product_id = str(product_id)
    retailer_id = f"coles_store_{store_id}"
    stable_id = f"libre_coles_{source_product_id}_{store_id}_{recorded_at}"

    return {
        "id": stable_id,
        "recorded_at": recorded_at,
        "product_id": f"coles_{source_product_id}",
        "category_id": "coles_unknown",
        "retailer_id": retailer_id,
        "item_name": f"Coles product {source_product_id}",
        "special_text": promotion_text(pricing),
        "product_url": f"https://www.coles.com.au/product/{source_product_id}",
        "price": price,
        "unit_price": unit_price,
        "is_on_special": is_on_special,
        "created_at": recorded_at,
        "source_dataset": "libre_coles_raw_prices",
        "source_file": source_file.name,
        "source_product_id": source_product_id,
        "source_store_id": store_id,
        "source_last_updated": record.get("lastUpdated"),
        "source_size": record.get("size"),
        "source_price_was": was_price,
        "source_save_amount": save_amount,
        "source_promotion_type": promotion_type,
    }


def main() -> None:
    args = parse_args()
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    converted = 0
    skipped = 0
    input_paths = [Path(path) for path in args.input]

    with output_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()

        for input_path in input_paths:
            recorded_at = snapshot_timestamp(input_path)
            for record in iter_jsonl_zst(input_path):
                row = standardize_record(record, input_path, recorded_at)
                if row is None:
                    skipped += 1
                    continue
                writer.writerow(row)
                converted += 1
                if args.limit and converted >= args.limit:
                    break
            if args.limit and converted >= args.limit:
                break

    print(
        json.dumps(
            {
                "input_files": [str(path) for path in input_paths],
                "output": str(output_path),
                "converted_rows": converted,
                "skipped_rows": skipped,
                "note": "Product names/categories are not present in the sampled raw price snapshot, so placeholders are used unless a metadata source is joined later.",
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
