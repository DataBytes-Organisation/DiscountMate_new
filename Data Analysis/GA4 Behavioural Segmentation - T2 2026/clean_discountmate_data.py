#!/usr/bin/env python3
"""Validate and clean DiscountMate BigQuery or synthetic behavioural data.

The raw file is never modified. The cleaned output preserves the documented
schema and imputes the one intentionally incomplete feature,
``days_since_first_visit``. Scaling and p99 capping are intentionally left to
the downstream modelling pipeline, as specified in the project README.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import statistics
from collections import Counter
from datetime import date
from pathlib import Path


BEHAVIOURAL_FEATURES = [
    "sessions_count",
    "avg_engagement_time_sec",
    "pageviews_per_session",
    "compare_ratio",
    "specials_ratio",
    "mylists_ratio",
    "category_browse_ratio",
    "product_detail_ratio",
    "unique_pages_visited",
    "browsing_entropy",
    "days_since_first_visit",
    "days_since_last_activity",
]

SUPPORTING_FIELDS = [
    "user_pseudo_id",
    "reporting_window_start",
    "reporting_window_end",
    "is_included_in_run",
]

EXPECTED_COLUMNS = BEHAVIOURAL_FEATURES + SUPPORTING_FIELDS
BIGQUERY_COLUMNS = ["user_pseudo_id"] + BEHAVIOURAL_FEATURES
GA4_DIR = Path(__file__).resolve().parent
INTEGER_FIELDS = {
    "sessions_count",
    "unique_pages_visited",
    "days_since_first_visit",
    "days_since_last_activity",
    "is_included_in_run",
}
RATIO_FIELDS = [
    "compare_ratio",
    "specials_ratio",
    "mylists_ratio",
    "category_browse_ratio",
    "product_detail_ratio",
]
DATE_FIELDS = ["reporting_window_start", "reporting_window_end"]
ALLOWED_MISSING = {"days_since_first_visit"}


class DataValidationError(ValueError):
    """Raised when the input cannot be cleaned without guessing."""


def sha256(path: Path) -> str:
    """Return a stable checksum for audit and handoff purposes."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=GA4_DIR / "Data" / "Original_bigquery_data.csv",
        help="Raw CSV to clean (default: %(default)s)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=GA4_DIR / "Data" / "cleaned_bigquery_users.csv",
        help="Cleaned CSV path (default: %(default)s)",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=GA4_DIR / "Documentation" / "bigquery_cleaning_report.json",
        help="JSON audit report path (default: %(default)s)",
    )
    return parser.parse_args()


def _parse_number(value: str, field: str, row_number: int) -> int | float | None:
    value = value.strip()
    if not value:
        if field in ALLOWED_MISSING:
            return None
        raise DataValidationError(f"Row {row_number}: {field} is missing")

    try:
        number = float(value)
    except ValueError as exc:
        raise DataValidationError(
            f"Row {row_number}: {field} is not numeric: {value!r}"
        ) from exc
    if not math.isfinite(number):
        raise DataValidationError(f"Row {row_number}: {field} is not finite")

    if field in INTEGER_FIELDS:
        if not number.is_integer():
            raise DataValidationError(
                f"Row {row_number}: {field} must be an integer, got {value!r}"
            )
        return int(number)
    return number


def load_and_validate(path: Path) -> tuple[list[dict], dict]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        columns = reader.fieldnames or []
        synthetic = columns == EXPECTED_COLUMNS
        bigquery = (len(columns) == len(set(columns)) and
                    set(columns) in (set(BIGQUERY_COLUMNS), set(BIGQUERY_COLUMNS + ["avg_percent_scrolled"])))
        if not synthetic and not bigquery:
            raise DataValidationError(
                "Unexpected CSV schema/order.\n"
                f"Expected: {EXPECTED_COLUMNS}\n"
                f"Received: {reader.fieldnames}"
            )
        raw_rows = list(reader)

    rows: list[dict] = []
    exact_rows_seen: set[tuple[str, ...]] = set()
    exact_duplicates_removed = 0

    for row_number, raw in enumerate(raw_rows, start=2):
        if None in raw or any(raw[column] is None for column in columns):
            raise DataValidationError(f"Row {row_number}: incorrect number of CSV fields")
        exact_key = tuple(raw[column].strip() for column in columns)
        if exact_key in exact_rows_seen:
            exact_duplicates_removed += 1
            continue
        exact_rows_seen.add(exact_key)

        row: dict = {}
        for field in BEHAVIOURAL_FEATURES + (["is_included_in_run"] if synthetic else []):
            row[field] = _parse_number(raw[field], field, row_number)

        user_id = raw["user_pseudo_id"].strip()
        if not user_id:
            raise DataValidationError(f"Row {row_number}: user_pseudo_id is missing")
        row["user_pseudo_id"] = user_id

        for field in DATE_FIELDS if synthetic else []:
            value = raw[field].strip()
            try:
                date.fromisoformat(value)
            except ValueError as exc:
                raise DataValidationError(
                    f"Row {row_number}: {field} is not a valid ISO date: {value!r}"
                ) from exc
            row[field] = value

        if synthetic and row["reporting_window_start"] > row["reporting_window_end"]:
            raise DataValidationError(f"Row {row_number}: reporting window is reversed")
        if synthetic and row["is_included_in_run"] not in (0, 1):
            raise DataValidationError(
                f"Row {row_number}: is_included_in_run must be 0 or 1"
            )

        nonnegative = [
            "sessions_count",
            "avg_engagement_time_sec",
            "pageviews_per_session",
            "unique_pages_visited",
            "days_since_first_visit",
            "days_since_last_activity",
        ]
        for field in nonnegative:
            if row[field] is not None and row[field] < 0:
                raise DataValidationError(f"Row {row_number}: {field} is negative")

        for field in RATIO_FIELDS + ["browsing_entropy"]:
            if not 0 <= row[field] <= 1:
                raise DataValidationError(
                    f"Row {row_number}: {field} must be between 0 and 1"
                )
        if synthetic and sum(row[field] for field in RATIO_FIELDS) > 0.95 + 1e-9:
            raise DataValidationError(f"Row {row_number}: affinity ratios exceed 0.95")

        first_visit = row["days_since_first_visit"]
        if first_visit is not None and row["days_since_last_activity"] > first_visit:
            raise DataValidationError(
                f"Row {row_number}: last activity predates the first visit"
            )

        approximate_pageviews = round(
            row["sessions_count"] * row["pageviews_per_session"]
        )
        if row["unique_pages_visited"] > approximate_pageviews:
            raise DataValidationError(
                f"Row {row_number}: unique pages exceed approximate total pageviews"
            )
        if "avg_percent_scrolled" in columns:
            scroll = _parse_number(raw["avg_percent_scrolled"], "avg_percent_scrolled", row_number)
            if not 0 <= scroll <= 100:
                raise DataValidationError(f"Row {row_number}: scroll percentage outside 0..100")
        rows.append(row)

    if "avg_percent_scrolled" in columns and len({raw["avg_percent_scrolled"].strip() for raw in raw_rows}) > 1:
        raise DataValidationError("Scroll is no longer constant; review its exclusion before cleaning")

    id_counts = Counter(row["user_pseudo_id"] for row in rows)
    duplicate_ids = sorted(user_id for user_id, count in id_counts.items() if count > 1)
    if duplicate_ids:
        preview = ", ".join(duplicate_ids[:5])
        raise DataValidationError(f"Conflicting duplicate user IDs found: {preview}")

    report = {
        "input_file": str(path.resolve()),
        "input_sha256": sha256(path),
        "input_rows": len(raw_rows),
        "exact_duplicate_rows_removed": exact_duplicates_removed,
        "unique_rows_after_deduplication": len(rows),
        "source_kind": "synthetic" if synthetic else "bigquery",
        "specification_verification_status": "NOT_FULLY_VERIFIED",
        "specification_verification_note": (
            "Validation checks the implemented cleaning contract. Original DA-01-T3, "
            "DA-01-T7 and Persona Archetype Definitions were unavailable for direct comparison. "
            "See Documentation/SPECIFICATION_VERIFICATION.md."
        ),
        "output_columns": EXPECTED_COLUMNS if synthetic else BIGQUERY_COLUMNS,
        "dropped_columns": ["avg_percent_scrolled"] if "avg_percent_scrolled" in columns else [],
        "warnings": [] if synthetic else [
            "Reporting dates and inclusion flag are absent; none were invented.",
            "Session-level engagement eligibility cannot be verified from aggregate means.",
            "Synthetic affinity-sum constraint of 0.95 is not applied to BigQuery data.",
            "Cluster assignments and persona labels are not supplied by cleaning.",
        ],
    }
    return rows, report


def clean(rows: list[dict], report: dict) -> list[dict]:
    included = [row.copy() for row in rows if row.get("is_included_in_run", 1) == 1]
    excluded_count = len(rows) - len(included)
    observed = [
        row["days_since_first_visit"]
        for row in included
        if row["days_since_first_visit"] is not None
    ]
    if not observed:
        raise DataValidationError(
            "days_since_first_visit has no observed values available for imputation"
        )

    median_first_visit = int(round(statistics.median(observed)))
    missing_count = 0
    constraint_adjustments = 0
    for row in included:
        if row["days_since_first_visit"] is None:
            missing_count += 1
            imputed = max(median_first_visit, row["days_since_last_activity"])
            if imputed != median_first_visit:
                constraint_adjustments += 1
            row["days_since_first_visit"] = imputed

    report.update(
        {
            "excluded_rows_removed": excluded_count,
            "output_rows": len(included),
            "missing_days_since_first_visit_before": missing_count,
            "missing_days_since_first_visit_after": 0,
            "days_since_first_visit_imputation": {
                "method": "rounded median, raised to days_since_last_activity when required",
                "observed_median": statistics.median(observed),
                "imputed_base_value": median_first_visit,
                "recency_constraint_adjustments": constraint_adjustments,
            },
            "p99_capping_applied": False,
            "scaling_applied": False,
            "validation_status": "PASS",
        }
    )
    return included


def write_csv(rows: list[dict], path: Path, columns: list[str] = EXPECTED_COLUMNS) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows({field: row[field] for field in columns} for row in rows)


def verify_cleaned_output(path: Path, expected_rows: int) -> dict:
    """Re-read the output and prove it is complete and internally consistent."""
    rows, validation = load_and_validate(path)
    if validation["exact_duplicate_rows_removed"]:
        raise DataValidationError("Cleaned output contains duplicate rows")
    if validation["input_rows"] != expected_rows:
        raise DataValidationError(
            f"Output row count changed: expected {expected_rows}, received {validation['input_rows']}"
        )
    with path.open(newline="", encoding="utf-8-sig") as handle:
        if next(csv.reader(handle)) != validation["output_columns"]:
            raise DataValidationError("Cleaned output columns are not in canonical order")
    if validation["dropped_columns"]:
        raise DataValidationError("Cleaned output still contains excluded columns")
    if any(row.get("is_included_in_run", 1) != 1 for row in rows):
        raise DataValidationError("Cleaned output still contains excluded users")
    missing_by_column = {
        column: sum(row[column] is None or row[column] == "" for row in rows)
        for column in validation["output_columns"]
    }
    if any(missing_by_column.values()):
        raise DataValidationError(
            f"Cleaned output still contains missing values: {missing_by_column}"
        )
    if len({row["user_pseudo_id"] for row in rows}) != expected_rows:
        raise DataValidationError("Cleaned output user IDs are not unique")

    return {
        "output_sha256": sha256(path),
        "post_write_schema_check": "PASS",
        "post_write_row_count_check": "PASS",
        "post_write_unique_id_check": "PASS",
        "post_write_duplicate_row_check": "PASS",
        "post_write_inclusion_flag_check": "PASS",
        "post_write_missing_value_check": "PASS",
        "post_write_constraint_check": "PASS",
        "missing_values_by_column": missing_by_column,
        "post_write_validation_rows": validation["input_rows"],
    }


def main() -> None:
    args = parse_args()
    if len({p.resolve() for p in (args.input, args.output, args.report)}) != 3:
        raise DataValidationError("Input, output and report must be different files")
    rows, report = load_and_validate(args.input)
    cleaned = clean(rows, report)
    write_csv(cleaned, args.output, report["output_columns"])

    report["output_file"] = str(args.output.resolve())
    report.update(verify_cleaned_output(args.output, len(cleaned)))
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {len(cleaned)} cleaned rows to {args.output}")
    print(f"Wrote audit report to {args.report}")
    print("Validation: PASS")


if __name__ == "__main__":
    main()
