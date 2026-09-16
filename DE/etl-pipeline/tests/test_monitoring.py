from __future__ import annotations

import io
import json
import unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from common.monitoring import EtlRunStatus, classify_summary, emit_etl_run_event

if TYPE_CHECKING:
    from common.job_models import JobSummary

STARTED_AT = datetime(2026, 9, 9, tzinfo=UTC)
SAFE_ERROR_MESSAGE = "Silver ETL execution failed; see Cloud Logging traceback"


def _summary(
    *,
    processed_dates: str = "2026-09-09",
    skipped_dates: str = "none",
    input_rows: int = 100,
    output_rows: int = 95,
) -> JobSummary:
    return {
        "processed_dates": processed_dates,
        "skipped_dates": skipped_dates,
        "counts": {
            "raw_input": input_rows,
            "raw_input_normalized": output_rows,
        },
    }


class ClassifySummaryTests(unittest.TestCase):
    def test_no_processed_dates_is_empty_input(self) -> None:
        self.assertEqual(
            classify_summary(_summary(processed_dates="none")),
            EtlRunStatus.EMPTY_INPUT,
        )

    def test_zero_raw_rows_is_empty_input(self) -> None:
        self.assertEqual(
            classify_summary(_summary(input_rows=0, output_rows=0)),
            EtlRunStatus.EMPTY_INPUT,
        )

    def test_zero_normalized_rows_is_empty_output(self) -> None:
        self.assertEqual(
            classify_summary(_summary(input_rows=10, output_rows=0)),
            EtlRunStatus.EMPTY_OUTPUT,
        )

    def test_positive_normalized_rows_is_succeeded(self) -> None:
        self.assertEqual(
            classify_summary(_summary()),
            EtlRunStatus.SUCCEEDED,
        )


class EmitEtlRunEventTests(unittest.TestCase):
    def test_success_event_is_one_json_line_on_stdout(self) -> None:
        stdout = io.StringIO()
        stderr = io.StringIO()

        with redirect_stdout(stdout), redirect_stderr(stderr):
            emit_etl_run_event(
                model="products_aldi",
                start_date="2026-09-09",
                end_date="2026-09-09",
                started_at=STARTED_AT,
                summary=_summary(skipped_dates="2026-09-08"),
            )

        lines = stdout.getvalue().splitlines()
        self.assertEqual(len(lines), 1)
        self.assertEqual(stderr.getvalue(), "")
        payload = json.loads(lines[0])
        self.assertEqual(
            {
                "event": payload["event"],
                "pipeline": payload["pipeline"],
                "model": payload["model"],
                "status": payload["status"],
                "requested_start_date": payload["requested_start_date"],
                "requested_end_date": payload["requested_end_date"],
                "processed_dates": payload["processed_dates"],
                "skipped_dates": payload["skipped_dates"],
                "input_rows": payload["input_rows"],
                "output_rows": payload["output_rows"],
                "error_type": payload["error_type"],
                "error_message": payload["error_message"],
                "severity": payload["severity"],
            },
            {
                "event": "etl_run_finished",
                "pipeline": "silver",
                "model": "products_aldi",
                "status": "succeeded",
                "requested_start_date": "2026-09-09",
                "requested_end_date": "2026-09-09",
                "processed_dates": ["2026-09-09"],
                "skipped_dates": ["2026-09-08"],
                "input_rows": 100,
                "output_rows": 95,
                "error_type": None,
                "error_message": None,
                "severity": "INFO",
            },
        )
        self.assertIn("started_at", payload)
        self.assertIn("completed_at", payload)
        self.assertGreaterEqual(payload["duration_seconds"], 0)

    def test_empty_output_event_is_warning_on_stdout(self) -> None:
        stdout = io.StringIO()

        with redirect_stdout(stdout):
            emit_etl_run_event(
                model="products_coles",
                start_date="2026-09-09",
                end_date=None,
                started_at=STARTED_AT,
                summary=_summary(input_rows=10, output_rows=0),
            )

        payload = json.loads(stdout.getvalue())
        self.assertEqual(payload["event"], "etl_run_finished")
        self.assertEqual(payload["status"], "empty_output")
        self.assertEqual(payload["severity"], "WARNING")

    def test_failure_event_is_on_stderr_without_exception_details(self) -> None:
        stdout = io.StringIO()
        stderr = io.StringIO()
        secret = "do-not-log-this-password"
        error = RuntimeError(
            f"postgresql://discount_mate:{secret}@database.example/discount_mate"
        )

        with redirect_stdout(stdout), redirect_stderr(stderr):
            emit_etl_run_event(
                model="products_iga",
                start_date="2026-09-09",
                end_date="2026-09-09",
                started_at=STARTED_AT,
                error=error,
            )

        self.assertEqual(stdout.getvalue(), "")
        payload = json.loads(stderr.getvalue())
        self.assertEqual(payload["event"], "etl_run_failed")
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["severity"], "ERROR")
        self.assertEqual(payload["error_type"], "RuntimeError")
        self.assertEqual(payload["error_message"], SAFE_ERROR_MESSAGE)
        self.assertNotIn(secret, stderr.getvalue())
        self.assertEqual(payload["processed_dates"], [])
        self.assertEqual(payload["skipped_dates"], [])
        self.assertEqual(payload["input_rows"], 0)
        self.assertEqual(payload["output_rows"], 0)


if __name__ == "__main__":
    unittest.main()
