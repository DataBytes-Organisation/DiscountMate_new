from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta


def parse_iso_date(date_value: str) -> date:
    return datetime.strptime(date_value, "%Y-%m-%d").date()


def iter_dates(
    start_date_value: str,
    end_date_value: str | None = None,
    *,
    today: date | None = None,
) -> list[date]:
    start_date = parse_iso_date(start_date_value)
    current_day = today or date.today()
    inclusive_end = (
        parse_iso_date(end_date_value) if end_date_value is not None else current_day
    )
    if inclusive_end > current_day:
        raise ValueError("`--end-date` cannot be after today's local date.")
    if start_date > inclusive_end:
        raise ValueError("`--start-date` cannot be after `--end-date`.")

    current_date = start_date
    run_dates: list[date] = []
    while current_date <= inclusive_end:
        run_dates.append(current_date)
        current_date += timedelta(days=1)
    return run_dates


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the reusable DuckDB ETL framework for a model/date range."
    )
    parser.add_argument(
        "--model",
        required=True,
        help="ETL model selector",
    )
    parser.add_argument(
        "--start-date",
        required=True,
        help="Inclusive start date in YYYY-MM-DD format.",
    )
    parser.add_argument(
        "--end-date",
        required=False,
        help=(
            "Optional inclusive end date in YYYY-MM-DD format. "
            "Defaults to today's local date."
        ),
    )
    return parser.parse_args()
