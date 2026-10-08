from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from enum import StrEnum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from common.job_models import JobSummary

SAFE_ERROR_MESSAGE = "Silver ETL execution failed; see Cloud Logging traceback"


class EtlRunStatus(StrEnum):
    SUCCEEDED = "succeeded"
    EMPTY_INPUT = "empty_input"
    EMPTY_OUTPUT = "empty_output"
    FAILED = "failed"


def classify_summary(summary: JobSummary) -> EtlRunStatus:
    counts = summary["counts"]
    input_rows = int(counts.get("raw_input", 0))
    output_rows = int(counts.get("raw_input_normalized", 0))

    if summary["processed_dates"] == "none" or input_rows <= 0:
        return EtlRunStatus.EMPTY_INPUT
    if output_rows <= 0:
        return EtlRunStatus.EMPTY_OUTPUT
    return EtlRunStatus.SUCCEEDED


def _date_values(value: str) -> list[str]:
    if value == "none":
        return []
    return [item for item in value.split(",") if item]


def emit_etl_run_event(
    *,
    model: str,
    start_date: str,
    end_date: str | None,
    started_at: datetime,
    summary: JobSummary | None = None,
    error: BaseException | None = None,
) -> None:
    completed_at = datetime.now(UTC)

    if error is not None:
        event = "etl_run_failed"
        status = EtlRunStatus.FAILED
        severity = "ERROR"
    else:
        if summary is None:
            raise ValueError("A completed ETL event requires a job summary.")
        event = "etl_run_finished"
        status = classify_summary(summary)
        severity = "INFO" if status is EtlRunStatus.SUCCEEDED else "WARNING"

    counts = summary["counts"] if summary is not None else {}
    payload = {
        "event": event,
        "pipeline": "silver",
        "model": model,
        "status": status,
        "requested_start_date": start_date,
        "requested_end_date": end_date,
        "processed_dates": (
            _date_values(summary["processed_dates"]) if summary is not None else []
        ),
        "skipped_dates": (
            _date_values(summary["skipped_dates"]) if summary is not None else []
        ),
        "input_rows": int(counts.get("raw_input", 0)),
        "output_rows": int(counts.get("raw_input_normalized", 0)),
        "started_at": started_at.isoformat(),
        "completed_at": completed_at.isoformat(),
        "duration_seconds": round(
            max((completed_at - started_at).total_seconds(), 0.0), 3
        ),
        "error_type": type(error).__name__ if error is not None else None,
        "error_message": SAFE_ERROR_MESSAGE if error is not None else None,
        "severity": severity,
    }
    output = sys.stderr if error is not None else sys.stdout
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), file=output)
