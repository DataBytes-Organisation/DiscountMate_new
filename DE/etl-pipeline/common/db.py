from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

import psycopg
from psycopg import sql

if TYPE_CHECKING:
    from pathlib import Path

    import duckdb

    from config.settings import AppSettings


def fetch_table_payload(
    conn: duckdb.DuckDBPyConnection,
    duck_table: str,
) -> tuple[list[tuple[object, ...]], list[str]]:
    rows = conn.execute(f"SELECT * FROM {duck_table}").fetchall()
    columns = [desc[0] for desc in conn.description]
    return rows, columns


def connect_postgres(settings: AppSettings) -> psycopg.Connection:
    return psycopg.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        dbname=settings.postgres_database,
        user=settings.postgres_user,
        password=settings.postgres_password,
    )


def load_duckdb_table_to_temp_table(
    cursor: psycopg.Cursor,
    conn: duckdb.DuckDBPyConnection,
    duck_table: str,
    temp_table: str,
    column_types: dict[str, str],
) -> int:
    rows, columns = fetch_table_payload(conn, duck_table)
    missing_columns = set(column_types) - set(columns)
    if missing_columns:
        raise RuntimeError(
            f"DuckDB table '{duck_table}' is missing columns: "
            f"{', '.join(sorted(missing_columns))}"
        )

    column_defs = sql.SQL(", ").join(
        sql.SQL("{} {}").format(sql.Identifier(column), sql.SQL(column_type))
        for column, column_type in column_types.items()
    )
    cursor.execute(
        sql.SQL("CREATE TEMP TABLE {} ({}) ON COMMIT DROP").format(
            sql.Identifier(temp_table),
            column_defs,
        )
    )

    if rows:
        insert_columns = sql.SQL(", ").join(sql.Identifier(column) for column in columns)
        placeholders = sql.SQL(", ").join(sql.Placeholder() for _ in columns)
        cursor.executemany(
            sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                sql.Identifier(temp_table),
                insert_columns,
                placeholders,
            ),
            rows,
        )
    return len(rows)


def load_pg_sql(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_demo_slice(
    conn: duckdb.DuckDBPyConnection,
    settings: AppSettings,
    duck_table: str,
    postgres_table: str,
    retailer: str,
    run_date: str,
) -> int:
    rows, columns = fetch_table_payload(conn, duck_table)
    slice_run_date = datetime.strptime(run_date, "%Y-%m-%d").date()
    qualified_table = sql.SQL("{}.{}").format(
        sql.Identifier(settings.postgres_schema),
        sql.Identifier(postgres_table),
    )
    insert_columns = sql.SQL(", ").join(sql.Identifier(column) for column in columns)
    insert_placeholders = sql.SQL(", ").join(sql.Placeholder() for _ in columns)

    with (
        psycopg.connect(
            host=settings.postgres_host,
            port=settings.postgres_port,
            dbname=settings.postgres_database,
            user=settings.postgres_user,
            password=settings.postgres_password,
        ) as pg_conn,
        pg_conn.cursor() as cursor,
    ):
        cursor.execute(
            sql.SQL("DELETE FROM {} WHERE retailer = %s AND run_date = %s").format(
                qualified_table
            ),
            (retailer, slice_run_date),
        )
        if rows:
            cursor.executemany(
                sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                    qualified_table,
                    insert_columns,
                    insert_placeholders,
                ),
                rows,
            )
    return len(rows)
