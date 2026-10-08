from __future__ import annotations

import io
import json
import unittest
from argparse import Namespace
from contextlib import redirect_stderr, redirect_stdout
from typing import TYPE_CHECKING
from unittest.mock import patch

import main as etl_main

if TYPE_CHECKING:
    from common.job_models import JobSummary

SUCCESS_SUMMARY: JobSummary = {
    "processed_dates": "2026-09-09",
    "skipped_dates": "none",
    "counts": {"raw_input": 100, "raw_input_normalized": 95},
}
SAFE_ERROR_MESSAGE = "Silver ETL execution failed; see Cloud Logging traceback"


class MainMonitoringTests(unittest.TestCase):
    def _run_main(
        self,
        *,
        model: str,
        runner: object,
    ) -> tuple[int, str, str]:
        args = Namespace(
            model=model,
            start_date="2026-09-09",
            end_date="2026-09-09",
        )
        stdout = io.StringIO()
        stderr = io.StringIO()

        with (
            patch.object(etl_main, "parse_args", return_value=args),
            patch.object(etl_main, "load_settings", return_value=object()),
            patch.object(etl_main, "load_runtime_config", return_value=object()),
            patch.object(etl_main, "resolve_job", return_value=runner),
            redirect_stdout(stdout),
            redirect_stderr(stderr),
        ):
            result = etl_main.main()

        return result, stdout.getvalue(), stderr.getvalue()

    def test_product_success_emits_structured_outcome(self) -> None:
        def runner(**_kwargs: object) -> JobSummary:
            return SUCCESS_SUMMARY

        result, stdout, stderr = self._run_main(
            model="products_aldi",
            runner=runner,
        )

        payload = json.loads(stdout.splitlines()[0])
        self.assertEqual(result, 0)
        self.assertEqual(payload["event"], "etl_run_finished")
        self.assertEqual(payload["status"], "succeeded")
        self.assertEqual(stderr, "")

    def test_product_empty_input_emits_warning_and_keeps_success_exit(self) -> None:
        def runner(**_kwargs: object) -> JobSummary:
            return {
                "processed_dates": "none",
                "skipped_dates": "2026-09-09",
                "counts": {"raw_input": 0, "raw_input_normalized": 0},
            }

        result, stdout, stderr = self._run_main(
            model="products_coles",
            runner=runner,
        )

        payload = json.loads(stdout.splitlines()[0])
        self.assertEqual(result, 0)
        self.assertEqual(payload["status"], "empty_input")
        self.assertEqual(payload["severity"], "WARNING")
        self.assertEqual(stderr, "")

    def test_product_empty_output_emits_warning_and_keeps_success_exit(self) -> None:
        def runner(**_kwargs: object) -> JobSummary:
            return {
                "processed_dates": "2026-09-09",
                "skipped_dates": "none",
                "counts": {"raw_input": 10, "raw_input_normalized": 0},
            }

        result, stdout, stderr = self._run_main(
            model="products_coles",
            runner=runner,
        )

        payload = json.loads(stdout.splitlines()[0])
        self.assertEqual(result, 0)
        self.assertEqual(payload["status"], "empty_output")
        self.assertEqual(payload["severity"], "WARNING")
        self.assertEqual(stderr, "")

    def test_product_failure_emits_event_and_preserves_original_exception(self) -> None:
        def runner(**_kwargs: object) -> JobSummary:
            raise ValueError("database unavailable")

        args = Namespace(
            model="products_iga",
            start_date="2026-09-09",
            end_date="2026-09-09",
        )
        stdout = io.StringIO()
        stderr = io.StringIO()

        with (
            patch.object(etl_main, "parse_args", return_value=args),
            patch.object(etl_main, "load_settings", return_value=object()),
            patch.object(etl_main, "load_runtime_config", return_value=object()),
            patch.object(etl_main, "resolve_job", return_value=runner),
            redirect_stdout(stdout),
            redirect_stderr(stderr),
            self.assertRaisesRegex(ValueError, "database unavailable"),
        ):
            etl_main.main()

        payload = json.loads(stderr.getvalue())
        self.assertEqual(stdout.getvalue(), "")
        self.assertEqual(payload["event"], "etl_run_failed")
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["error_type"], "ValueError")
        self.assertEqual(payload["error_message"], SAFE_ERROR_MESSAGE)

    def test_product_configuration_failure_emits_event_and_preserves_error(
        self,
    ) -> None:
        args = Namespace(
            model="products_aldi",
            start_date="2026-09-09",
            end_date="2026-09-09",
        )
        secret = "do-not-log-this-password"
        error_message = (
            f"postgresql://discount_mate:{secret}@database.example/discount_mate"
        )
        stdout = io.StringIO()
        stderr = io.StringIO()

        with (
            patch.object(etl_main, "parse_args", return_value=args),
            patch.object(
                etl_main,
                "load_settings",
                side_effect=ValueError(error_message),
            ),
            redirect_stdout(stdout),
            redirect_stderr(stderr),
            self.assertRaisesRegex(ValueError, secret),
        ):
            etl_main.main()

        payload = json.loads(stderr.getvalue())
        self.assertEqual(stdout.getvalue(), "")
        self.assertEqual(payload["event"], "etl_run_failed")
        self.assertEqual(payload["error_type"], "ValueError")
        self.assertEqual(payload["error_message"], SAFE_ERROR_MESSAGE)
        self.assertNotIn(secret, stderr.getvalue())

    def test_example_model_keeps_existing_plain_text_output(self) -> None:
        def runner(**_kwargs: object) -> JobSummary:
            return SUCCESS_SUMMARY

        result, stdout, stderr = self._run_main(model="example", runner=runner)

        self.assertEqual(result, 0)
        self.assertTrue(stdout.startswith("Pipeline completed successfully\n"))
        self.assertEqual(stderr, "")

    def test_monitoring_failure_does_not_fail_successful_etl(self) -> None:
        def runner(**_kwargs: object) -> JobSummary:
            return SUCCESS_SUMMARY

        with patch.object(
            etl_main,
            "emit_etl_run_event",
            side_effect=RuntimeError("monitoring unavailable"),
        ):
            result, stdout, stderr = self._run_main(
                model="products_woolworths",
                runner=runner,
            )

        self.assertEqual(result, 0)
        self.assertIn("Pipeline completed successfully", stdout)
        self.assertIn("Unable to emit Silver ETL monitoring event", stderr)

    def test_monitoring_failure_does_not_replace_etl_exception(self) -> None:
        def runner(**_kwargs: object) -> JobSummary:
            raise ValueError("original ETL failure")

        args = Namespace(
            model="products_aldi",
            start_date="2026-09-09",
            end_date="2026-09-09",
        )
        stderr = io.StringIO()

        with (
            patch.object(etl_main, "parse_args", return_value=args),
            patch.object(etl_main, "load_settings", return_value=object()),
            patch.object(etl_main, "load_runtime_config", return_value=object()),
            patch.object(etl_main, "resolve_job", return_value=runner),
            patch.object(
                etl_main,
                "emit_etl_run_event",
                side_effect=RuntimeError("monitoring unavailable"),
            ),
            redirect_stderr(stderr),
            self.assertRaisesRegex(ValueError, "original ETL failure"),
        ):
            etl_main.main()

        self.assertIn("Unable to emit Silver ETL monitoring event", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
