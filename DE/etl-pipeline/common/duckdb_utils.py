from __future__ import annotations

from typing import TYPE_CHECKING

from jinja2 import Environment, StrictUndefined

if TYPE_CHECKING:
    from pathlib import Path

    import duckdb

JINJA_ENVIRONMENT = Environment(
    autoescape=False,
    keep_trailing_newline=True,
    lstrip_blocks=True,
    trim_blocks=True,
    undefined=StrictUndefined,
)


def load_sql(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def render_sql_template(path: Path, **context: object) -> str:
    template = JINJA_ENVIRONMENT.from_string(load_sql(path))
    return template.render(**context)


def fetch_scalar(conn: duckdb.DuckDBPyConnection, query: str) -> int:
    row = conn.execute(query).fetchone()
    if row is None:
        raise RuntimeError(f"Expected a scalar result for query: {query}")
    return int(row[0])
