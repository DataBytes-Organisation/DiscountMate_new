"""Regression tests for the DiscountMate cleaning pipeline."""

from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

from clean_discountmate_data import (
    EXPECTED_COLUMNS,
    BIGQUERY_COLUMNS,
    GA4_DIR,
    DataValidationError,
    clean,
    load_and_validate,
    verify_cleaned_output,
    write_csv,
)


PROJECT_DIR = Path(__file__).resolve().parent
RAW_DATA = GA4_DIR / "Data" / "synthetic_users_20260831.csv"


class CleaningPipelineTests(unittest.TestCase):
    def test_output_verifier_rejects_exact_duplicate_rows(self) -> None:
        rows, report = load_and_validate(RAW_DATA)
        cleaned = clean(rows, report)
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "duplicate.csv"
            write_csv(cleaned + [cleaned[0]], output)
            with self.assertRaisesRegex(DataValidationError, "duplicate rows"):
                verify_cleaned_output(output, 1500)

    def test_output_verifier_rejects_wrong_row_count(self) -> None:
        rows, report = load_and_validate(RAW_DATA)
        cleaned = clean(rows, report)
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "short.csv"
            write_csv(cleaned[:-1], output)
            with self.assertRaisesRegex(DataValidationError, "row count changed"):
                verify_cleaned_output(output, 1500)

    def test_output_verifier_rejects_excluded_users(self) -> None:
        rows, report = load_and_validate(RAW_DATA)
        cleaned = clean(rows, report)
        cleaned[0]["is_included_in_run"] = 0
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "excluded.csv"
            write_csv(cleaned, output)
            with self.assertRaisesRegex(DataValidationError, "excluded users"):
                verify_cleaned_output(output, 1500)

    def test_output_verifier_rejects_reordered_bigquery_columns(self) -> None:
        rows, report = load_and_validate(GA4_DIR / "Data" / "Original_bigquery_data.csv")
        cleaned = clean(rows, report)
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "reordered.csv"
            write_csv(cleaned, output, list(reversed(BIGQUERY_COLUMNS)))
            with self.assertRaisesRegex(DataValidationError, "canonical order"):
                verify_cleaned_output(output, 21)

    def test_bigquery_handoff_preserves_ids_and_observed_features(self) -> None:
        source = GA4_DIR / "Data" / "Original_bigquery_data.csv"
        rows, report = load_and_validate(source)
        cleaned = clean(rows, report)
        self.assertEqual(len(cleaned), 21)
        self.assertEqual(report["missing_days_since_first_visit_before"], 5)
        for before, after in zip(rows, cleaned):
            for column in BIGQUERY_COLUMNS:
                if before[column] is not None:
                    self.assertEqual(before[column], after[column])
            self.assertGreaterEqual(after["days_since_first_visit"], after["days_since_last_activity"])
            self.assertNotIn("is_included_in_run", after)
            self.assertNotIn("reporting_window_start", after)
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "cleaned.csv"
            write_csv(cleaned, output, BIGQUERY_COLUMNS)
            checks = verify_cleaned_output(output, 21)
            self.assertFalse(any(checks["missing_values_by_column"].values()))

    def test_malformed_rows_fail_with_validation_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "bad.csv"
            source.write_text(",".join(BIGQUERY_COLUMNS) + "\nonly_one_field\n")
            with self.assertRaises(DataValidationError):
                load_and_validate(source)

    def test_nonconstant_scroll_requires_review(self) -> None:
        source = GA4_DIR / "Data" / "Original_bigquery_data.csv"
        with tempfile.TemporaryDirectory() as tmp:
            changed = Path(tmp) / "changed.csv"
            changed.write_text(source.read_text().replace(",90,", ",80,", 1))
            with self.assertRaisesRegex(DataValidationError, "no longer constant"):
                load_and_validate(changed)

    def test_cleaning_changes_only_intended_missing_values(self) -> None:
        rows, report = load_and_validate(RAW_DATA)
        cleaned = clean(rows, report)

        with RAW_DATA.open(newline="", encoding="utf-8-sig") as handle:
            raw = list(csv.DictReader(handle))

        self.assertEqual(len(cleaned), 1500)
        self.assertEqual(len({row["user_pseudo_id"] for row in cleaned}), 1500)
        self.assertEqual(report["missing_days_since_first_visit_before"], 300)
        self.assertEqual(
            report["days_since_first_visit_imputation"][
                "recency_constraint_adjustments"
            ],
            2,
        )

        changed_cells = []
        for raw_row, clean_row in zip(raw, cleaned):
            for column in EXPECTED_COLUMNS:
                clean_value = str(clean_row[column])
                if raw_row[column] != clean_value:
                    changed_cells.append((column, raw_row[column], clean_value))

        self.assertEqual(len(changed_cells), 300)
        self.assertTrue(
            all(
                column == "days_since_first_visit" and before == "" and after
                for column, before, after in changed_cells
            )
        )

    def test_written_output_passes_post_write_validation(self) -> None:
        rows, report = load_and_validate(RAW_DATA)
        cleaned = clean(rows, report)
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "cleaned.csv"
            write_csv(cleaned, output)
            checks = verify_cleaned_output(output, 1500)

        self.assertEqual(checks["post_write_schema_check"], "PASS")
        self.assertEqual(checks["post_write_unique_id_check"], "PASS")
        self.assertEqual(checks["post_write_missing_value_check"], "PASS")
        self.assertFalse(any(checks["missing_values_by_column"].values()))


if __name__ == "__main__":
    unittest.main()
