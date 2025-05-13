# Import the SparkSession module
import json
import os

from pyspark.sql import SparkSession

MINIO_ACCESS_KEY_ID = os.getenv("MINIO_ACCESS_KEY_ID")
MINIO_SECRET_ACCESS_KEY = os.getenv("MINIO_SECRET_ACCESS_KEY")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT")

POSTGRES_HOST = os.getenv("POSTGRES_HOST")
POSTGRES_PORT = os.getenv("POSTGRES_PORT")
POSTGRES_DATABASE = os.getenv("POSTGRES_DATABASE")
POSTGRES_SCHEMA = os.getenv("POSTGRES_SCHEMA")
POSTGRES_USER = os.getenv("POSTGRES_USER")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")

PROCESSED_FILE_PATH_LIST_STR = os.getenv("PROCESSED_FILE_PATH_LIST_STR")


def _load_to_postgres():
    # Create a SparkSession
    spark = (
        SparkSession.builder.appName("LoadToPostgres")
        .config(
            "spark.jars",
            "spark/jars/postgresql-9.4.1207.jar,spark/jars/aws-java-sdk-bundle-1.11.1026.jar,spark/jars/hadoop-aws-3.3.2.jar",
        )
        .config("fs.s3a.access.key", MINIO_ACCESS_KEY_ID)
        .config("fs.s3a.secret.key", MINIO_SECRET_ACCESS_KEY)
        .config(
            "fs.s3a.endpoint",
            MINIO_ENDPOINT,
        )
        .config("fs.s3a.connection.ssl.enabled", "false")
        .config("fs.s3a.path.style.access", "true")
        .config("fs.s3a.attempts.maximum", "1")
        .config("fs.s3a.connection.establish.timeout", "50")
        .config("fs.s3a.connection.timeout", "100")
        .getOrCreate()
    )
    processed_file_path_list = json.loads(
        PROCESSED_FILE_PATH_LIST_STR.replace("'", '"')
    )
    for file_path in processed_file_path_list:
        print("=" * 100)
        print(f"Reading: {file_path}")
        df = spark.read.parquet(f"s3a://{file_path}")
        url = f"jdbc:postgresql://{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DATABASE}"
        properties = {
            "user": POSTGRES_USER,
            "password": POSTGRES_PASSWORD,
            "driver": "org.postgresql.Driver",
        }
        table_name = f"LND_{file_path.split('/')[-1].split('.')[0]}"
        table = f"{POSTGRES_SCHEMA}.{table_name}"
        df.write.jdbc(url=url, table=table, mode="overwrite", properties=properties)
        print("=" * 100)
    os.system("kill %d" % os.getpid())

_load_to_postgres()