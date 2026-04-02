from __future__ import annotations

from pathlib import Path


def load_sql(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def sql_bool(column: str) -> str:
    return (
        f"CASE "
        f"WHEN lower(trim(coalesce(CAST({column} AS VARCHAR), ''))) IN ('true', '1', 'yes', 'y') THEN TRUE "
        f"WHEN lower(trim(coalesce(CAST({column} AS VARCHAR), ''))) IN ('false', '0', 'no', 'n') THEN FALSE "
        f"ELSE NULL END"
    )


def sql_number(column: str) -> str:
    return (
        f"TRY_CAST("
        f"regexp_replace(coalesce(CAST({column} AS VARCHAR), ''), '[^0-9.-]', '', 'g') "
        f"AS DOUBLE)"
    )
