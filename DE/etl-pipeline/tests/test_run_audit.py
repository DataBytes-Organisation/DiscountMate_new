from __future__ import annotations

from datetime import UTC, datetime

from common.run_audit import build_audit_record, finalize_product_run


def test_audit_record_preserves_source_counts_and_observation_date() -> None:
    record = build_audit_record(
        model="products_coles",
        start_date="2026-05-04",
        end_date="2026-05-04",
        started_at=datetime(2026, 5, 4, tzinfo=UTC),
        summary={
            "processed_dates": "2026-05-04",
            "skipped_dates": "none",
            "source_files": ["coles_products_20260504.csv"],
            "counts": {"raw_input": 12, "raw_input_normalized": 10},
        },
    )

    assert record["retailer_name"] == "Coles"
    assert record["observation_date"] == "2026-05-04"
    assert record["input_row_count"] == 12
    assert record["output_row_count"] == 10


def test_successful_product_run_refreshes_groups_and_writes_audit() -> None:
    class Result:
        def fetchone(self):
            return (datetime(2026, 5, 4, 2, 0, tzinfo=UTC),)

    class Connection:
        def __init__(self):
            self.calls = []

        def execute(self, sql, params=None):
            self.calls.append((sql, params))
            return Result()

    connection = Connection()
    record = build_audit_record(
        model="products_iga",
        start_date="2026-05-04",
        end_date="2026-05-04",
        started_at=datetime(2026, 5, 4, tzinfo=UTC),
        summary={
            "processed_dates": "2026-05-04",
            "skipped_dates": "none",
            "source_files": ["iga_sample_20260504.csv"],
            "counts": {"raw_input": 20, "raw_input_normalized": 18},
        },
    )

    finalize_product_run(connection, record)

    assert "refresh_comparison_product_groups" in connection.calls[0][0]
    assert "MAX(price.recorded_at)" in connection.calls[1][0]
    assert "etl_run_audit" in connection.calls[2][0]
