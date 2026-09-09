from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import psycopg

from common.job_models import JobSummary
from config.settings import AppSettings

RETAILER_BY_MODEL = {
    "products_aldi": "ALDI",
    "products_coles": "Coles",
    "products_iga": "IGA",
    "products_woolworths": "Woolworths",
}


def build_audit_record(
    *,
    model: str,
    start_date: str,
    end_date: str | None,
    started_at: datetime,
    summary: JobSummary | None = None,
    error: BaseException | None = None,
) -> dict[str, Any]:
    counts = summary["counts"] if summary else {}
    processed_dates = [] if not summary else [
        value for value in summary["processed_dates"].split(",") if value != "none"
    ]
    return {
        "model_name": model,
        "retailer_name": RETAILER_BY_MODEL.get(model),
        "source_files": [] if not summary else summary.get("source_files", []),
        "requested_start_date": start_date,
        "requested_end_date": end_date,
        "observation_date": max(processed_dates) if processed_dates else None,
        "input_row_count": int(counts.get("raw_input", 0)),
        "output_row_count": int(counts.get("raw_input_normalized", 0)),
        "status": "failed" if error else "succeeded",
        "error_message": None if error is None else str(error)[:2000],
        "started_at": started_at,
    }


def finalize_product_run(connection: Any, record: dict[str, Any]) -> None:
    if record["status"] == "succeeded":
        connection.execute("SELECT silver.refresh_comparison_product_groups()")

    watermark_result = connection.execute(
        """
        SELECT MAX(price.recorded_at)
        FROM silver.fct_product_prices price
        JOIN silver.dim_retailers retailer ON retailer.id = price.retailer_id
        WHERE lower(retailer.retailer_name) = lower(%s)
        """,
        (record["retailer_name"],),
    )
    watermark_row = watermark_result.fetchone()
    watermark = watermark_row[0] if watermark_row else None

    connection.execute(
        """
        INSERT INTO silver.etl_run_audit (
            model_name, retailer_name, source_files,
            requested_start_date, requested_end_date, observation_date,
            input_row_count, output_row_count, silver_watermark,
            status, error_message, started_at
        ) VALUES (
            %s, %s, %s::jsonb,
            %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s
        )
        """,
        (
            record["model_name"],
            record["retailer_name"],
            json.dumps(record["source_files"]),
            record["requested_start_date"],
            record["requested_end_date"],
            record["observation_date"],
            record["input_row_count"],
            record["output_row_count"],
            watermark,
            record["status"],
            record["error_message"],
            record["started_at"],
        ),
    )


def record_product_run(settings: AppSettings, record: dict[str, Any]) -> None:
    with psycopg.connect(settings.postgres_duckdb_uri()) as connection:
        finalize_product_run(connection, record)
