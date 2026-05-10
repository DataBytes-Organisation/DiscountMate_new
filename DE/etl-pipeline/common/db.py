from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

import duckdb
from duckdb_extensions import import_extension

if TYPE_CHECKING:
    from config.settings import AppSettings

HTTPFS_GCS_SECRET_NAME = "bronze_gcs_secret"
POSTGRES_ATTACH_ALIAS = "postgres_silver"


def _quote_identifier(identifier: str) -> str:
    return f'"{identifier.replace(chr(34), chr(34) * 2)}"'


def _quote_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _ensure_runtime_directories(settings: AppSettings) -> None:
    Path(settings.duckdb_home_directory).mkdir(parents=True, exist_ok=True)
    Path(settings.duckdb_extension_directory).mkdir(parents=True, exist_ok=True)


def configure_duckdb_runtime(
    conn: duckdb.DuckDBPyConnection,
    settings: AppSettings,
) -> None:
    _ensure_runtime_directories(settings)
    conn.execute(
        f"SET home_directory = {_quote_literal(settings.duckdb_home_directory)}"
    )
    conn.execute(
        f"SET extension_directory = {_quote_literal(settings.duckdb_extension_directory)}"
    )


def open_etl_connection(settings: AppSettings) -> duckdb.DuckDBPyConnection:
    conn = duckdb.connect()
    configure_duckdb_runtime(conn, settings)
    return conn


def _load_httpfs_extension(
    conn: duckdb.DuckDBPyConnection,
    settings: AppSettings,
) -> None:
    configure_duckdb_runtime(conn, settings)
    try:
        conn.execute("LOAD httpfs")
        return
    except duckdb.Error:
        pass

    try:
        import_extension("httpfs", con=conn)
        conn.execute("LOAD httpfs")
    except duckdb.Error as exc:
        raise RuntimeError(
            "DuckDB could not load the httpfs extension. "
            "Ensure the packaged DuckDB httpfs extension is installed and "
            f"that '{settings.duckdb_extension_directory}' is writable."
        ) from exc


def _load_postgres_extension(
    conn: duckdb.DuckDBPyConnection,
    settings: AppSettings,
) -> None:
    configure_duckdb_runtime(conn, settings)
    try:
        conn.execute("LOAD postgres")
        return
    except duckdb.Error:
        pass

    try:
        import_extension("postgres", con=conn)
        conn.execute("LOAD postgres")
    except duckdb.Error as exc:
        raise RuntimeError(
            "DuckDB could not load the postgres extension. "
            "Ensure the packaged DuckDB postgres extension is installed and "
            f"that '{settings.duckdb_extension_directory}' is writable."
        ) from exc


def configure_bronze_storage(
    conn: duckdb.DuckDBPyConnection,
    settings: AppSettings,
    bronze_root: str,
) -> None:
    if not bronze_root.startswith(("gs://", "gcs://")):
        return

    if not settings.gcs_key_id or not settings.gcs_secret:
        raise RuntimeError(
            "GCS bronze input requires GCS HMAC credentials. "
            "Set GCS_KEY_ID and GCS_SECRET in the environment."
        )

    _load_httpfs_extension(conn, settings)

    scope = bronze_root.rstrip("/")
    if "/" in scope.removeprefix("gs://").removeprefix("gcs://"):
        scope = f"{scope}/"

    conn.execute(
        f"""
        CREATE OR REPLACE SECRET {_quote_identifier(HTTPFS_GCS_SECRET_NAME)} (
            TYPE gcs,
            KEY_ID {_quote_literal(settings.gcs_key_id)},
            SECRET {_quote_literal(settings.gcs_secret)},
            SCOPE {_quote_literal(scope)}
        )
        """
    )


def ensure_postgres_attached(
    conn: duckdb.DuckDBPyConnection,
    settings: AppSettings,
    *,
    alias: str = POSTGRES_ATTACH_ALIAS,
    read_only: bool = False,
) -> str:
    attached_databases = {row[0] for row in conn.execute("SHOW DATABASES").fetchall()}
    if alias in attached_databases:
        return alias

    _load_postgres_extension(conn, settings)
    read_only_sql = ", READ_ONLY" if read_only else ""
    conn.execute(
        f"""
        ATTACH {_quote_literal(settings.postgres_duckdb_uri())}
        AS {_quote_identifier(alias)}
        (TYPE postgres, SCHEMA {_quote_literal(settings.postgres_schema)}{read_only_sql})
        """
    )
    return alias


def postgres_table(
    table_name: str,
    *,
    alias: str = POSTGRES_ATTACH_ALIAS,
) -> str:
    return f"{_quote_identifier(alias)}.{_quote_identifier(table_name)}"


def fetch_table_payload(
    conn: duckdb.DuckDBPyConnection,
    duck_table: str,
) -> tuple[list[tuple[object, ...]], list[str]]:
    rows = conn.execute(f"SELECT * FROM {_quote_identifier(duck_table)}").fetchall()
    columns = [desc[0] for desc in conn.description]
    return rows, columns


def _run_transaction(
    conn: duckdb.DuckDBPyConnection,
    statements: list[tuple[str, list[object] | None]],
) -> None:
    conn.execute("BEGIN")
    try:
        for statement, params in statements:
            if params is None:
                conn.execute(statement)
            else:
                conn.execute(statement, params)
        conn.execute("COMMIT")
    except duckdb.Error:
        conn.execute("ROLLBACK")
        raise


def load_demo_slice(
    conn: duckdb.DuckDBPyConnection,
    settings: AppSettings,
    duck_table: str,
    postgres_table: str,
    retailer: str,
    run_date: str,
) -> int:
    ensure_postgres_attached(conn, settings)
    row_count = conn.execute(
        f"SELECT count(*) FROM {_quote_identifier(duck_table)}"
    ).fetchone()
    if row_count is None:
        raise RuntimeError(f"Expected count(*) result for table '{duck_table}'.")

    slice_run_date = datetime.strptime(run_date, "%Y-%m-%d").date()
    target_table = postgres_table_name(postgres_table)
    source_table = _quote_identifier(duck_table)
    _run_transaction(
        conn,
        [
            (
                f"DELETE FROM {target_table} WHERE retailer = ? AND run_date = ?",
                [retailer, slice_run_date],
            ),
            (
                f"INSERT INTO {target_table} SELECT * FROM {source_table}",
                None,
            ),
        ],
    )
    return int(row_count[0])


def postgres_table_name(
    table_name: str,
    *,
    alias: str = POSTGRES_ATTACH_ALIAS,
) -> str:
    return postgres_table(table_name, alias=alias)
