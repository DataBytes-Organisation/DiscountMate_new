from __future__ import annotations

from datetime import datetime

import duckdb
import psycopg

from config.settings import AppSettings


def fetch_table_payload(
    conn: duckdb.DuckDBPyConnection,
    duck_table: str,
) -> tuple[list[tuple], list[str]]:
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
    full_table = f"{settings.postgres_schema}.{postgres_table}"
    placeholders = ", ".join(["%s"] * len(columns))
    column_list = ", ".join(columns)

    with psycopg.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        dbname=settings.postgres_database,
        user=settings.postgres_user,
        password=settings.postgres_password,
    ) as pg_conn:
        with pg_conn.cursor() as cursor:
            cursor.execute(
                f"DELETE FROM {full_table} WHERE retailer = %s AND run_date = %s",
                (retailer, slice_run_date),
            )
            if rows:
                cursor.executemany(
                    f"INSERT INTO {full_table} ({column_list}) VALUES ({placeholders})",
                    rows,
                )
    return len(rows)
