import os

import duckdb

from airflow.hooks.base import BaseHook

PROCESSED_BUCKET = "processed"
MINIO_ACCESS_KEY_ID = os.getenv("MINIO_ACCESS_KEY_ID")
MINIO_SECRET_ACCESS_KEY = os.getenv("MINIO_SECRET_ACCESS_KEY")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT")

class MinioCSVFileProcessor:
    def __init__(self):
        self.conn = duckdb.connect()

        # In case you're using Airflow and prefer to get MinIO credentials from the Airflow connection, uncomment the following:
        self.airflow_minio_connection = BaseHook.get_connection("minio")
        self.conn.execute(f"""
            SET s3_access_key_id = '{self.airflow_minio_connection.login}';
            SET s3_secret_access_key = '{self.airflow_minio_connection.password}';
            SET s3_endpoint = \'{self.airflow_minio_connection.extra_dejson["endpoint_url"].split("//")[1]}\';
            SET s3_url_style = 'path';
            SET s3_use_ssl = false;
        """)

    def _process_file(self, file_path):
        bucket, object_name = file_path.split("/", 1)
        table_name = object_name.split(".")[0]

        # Load data and infer schema
        self.conn.execute(f"""
            CREATE OR REPLACE TABLE temp_raw AS
            SELECT * FROM read_json_auto('s3://{bucket}/{object_name}')
        """)

        # Get column names
        cols = self.conn.execute("PRAGMA table_info('temp_raw')").fetchall()
        col_names = [col[1] for col in cols]  # col[1] is the column name

        # Build the SELECT clause with casting
        select_clause = ",\n".join([f"CAST({col} AS STRING) AS {col}" for col in col_names])

        # Create final table with string-typed columns
        self.conn.execute(f"""
            CREATE OR REPLACE TABLE {table_name} AS
            SELECT {select_clause}
            FROM temp_raw
        """)

        # Save to Parquet
        self._save_file(table_name)
        processed_file_path = f"{PROCESSED_BUCKET}/{table_name}.parquet"
        return processed_file_path

    
    def _save_file(self, table_name):
        self.conn.execute(f"""
            COPY {table_name}
            TO 's3://{PROCESSED_BUCKET}/{table_name}.parquet'
            (FORMAT 'parquet');
        """)