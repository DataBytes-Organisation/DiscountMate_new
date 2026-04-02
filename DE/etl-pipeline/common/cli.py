from __future__ import annotations

import argparse
from datetime import datetime


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the reusable DuckDB ETL framework for a source/runner/date."
    )
    parser.add_argument(
        "--source",
        required=True,
        help="Retailer source: coles, woolworths, iga, aldi",
    )
    parser.add_argument(
        "--runner",
        required=True,
        help="Pipeline runner. Phase 1 supports only 'products'",
    )
    parser.add_argument("--date", required=True, help="Run date in YYYY-MM-DD format")
    parser.add_argument(
        "--config",
        default="config/local.yaml",
        help="Path to YAML config relative to the project root or an absolute path",
    )
    return parser.parse_args()


def validate_date(date_value: str) -> tuple[str, str]:
    parsed = datetime.strptime(date_value, "%Y-%m-%d")
    return date_value, parsed.strftime("%Y%m%d")
