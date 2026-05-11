from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

import psycopg
from psycopg import sql

if TYPE_CHECKING:
    import duckdb

    from config.settings import AppSettings


def fetch_table_payload(
    conn: duckdb.DuckDBPyConnection,
    duck_table: str,
) -> tuple[list[tuple[object, ...]], list[str]]:
    rows = conn.execute(f"SELECT * FROM {duck_table}").fetchall()
    columns = [desc[0] for desc in conn.description]
    return rows, columns


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
