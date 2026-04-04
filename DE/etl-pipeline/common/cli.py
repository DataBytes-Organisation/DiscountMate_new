from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta


def parse_iso_date(date_value: str) -> date:
    return datetime.strptime(date_value, "%Y-%m-%d").date()


def iter_dates_to_today(
    start_date_value: str, *, today: date | None = None
) -> list[date]:
    start_date = parse_iso_date(start_date_value)
    inclusive_end = today or date.today()
    if start_date > inclusive_end:
        raise ValueError("`--start-date` cannot be after today's local date.")

    current_date = start_date
    run_dates: list[date] = []
    while current_date <= inclusive_end:
        run_dates.append(current_date)
        current_date += timedelta(days=1)
    return run_dates


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the reusable DuckDB ETL framework for a model/runner/date range."
    )
    parser.add_argument(
        "--model",
        required=True,
        help="ETL model selector: coles, woolworths, iga, aldi, example",
    )
    parser.add_argument(
        "--runner",
        required=True,
        help="Pipeline runner. Phase 1 supports only 'products'",
    )
    parser.add_argument(
        "--start-date",
        required=True,
        help="Inclusive start date in YYYY-MM-DD format. The range runs through today.",
    )
    return parser.parse_args()
