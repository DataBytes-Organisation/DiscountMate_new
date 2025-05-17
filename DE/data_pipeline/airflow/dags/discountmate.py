import os
import json
from datetime import datetime
from pymongo import MongoClient
from scripts.ingestion import _ingest_to_minio, _check_minio_buckets
from scripts.minio_processor import MinioCSVFileProcessor
from airflow.decorators import dag, task
from airflow.providers.docker.operators.docker import DockerOperator
from airflow.operators.bash import BashOperator

# MongoDB connection details
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB")

# MinIO connection details
RAW_BUCKET = 'raw'
PROCESSED_BUCKET = 'processed'
MINIO_ACCESS_KEY_ID = os.getenv("MINIO_ACCESS_KEY_ID")
MINIO_SECRET_ACCESS_KEY = os.getenv("MINIO_SECRET_ACCESS_KEY")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT")

# PostgreSQL connection details
POSTGRES_HOST = os.getenv("POSTGRES_HOST")
POSTGRES_PORT = os.getenv("POSTGRES_PORT")
POSTGRES_DATABASE = os.getenv("POSTGRES_DATABASE")
POSTGRES_SCHEMA = os.getenv("POSTGRES_SCHEMA")
POSTGRES_USER = os.getenv("POSTGRES_USER")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")


@dag(
    start_date=datetime(2022, 1, 1),
    schedule_interval=None,
    catchup=False,
    tags=['pipeline']
)
def pipeline():
    @task
    def check_minio_buckets():
        _check_minio_buckets()

    @task
    def ingest_from_mongo_to_minio():
        client = MongoClient(MONGO_URI)
        db = client[MONGO_DB]
        collections = db.list_collection_names()
        file_paths = []

        for collection_name in collections:
            collection = db[collection_name]
            data = list(collection.find())
            if not data:
                continue
            serialized_data = json.dumps(data, default=str)
            file_name = f"{collection_name}.json"
            file_path = _ingest_to_minio(file_name, serialized_data.encode('utf-8'))
            file_paths.append(file_path)

        return file_paths

    @task
    def process_file(file_paths: list):
        processor = MinioCSVFileProcessor()
        processed_paths = []
        for path in file_paths:
            processed = processor._process_file(file_path=path)
            processed_paths.append(processed)
        return processed_paths

    load_to_dw = DockerOperator(
        task_id="load_to_dw",
        image="spark-app",
        api_version="auto",
        auto_remove=True,
        docker_url="tcp://docker-proxy:2375",
        network_mode="container:spark-master",
        tty=True,
        mount_tmp_dir=False,
        environment={
            "MINIO_ACCESS_KEY_ID": MINIO_ACCESS_KEY_ID,
            "MINIO_SECRET_ACCESS_KEY": MINIO_SECRET_ACCESS_KEY,
            "MINIO_ENDPOINT": MINIO_ENDPOINT,
            "POSTGRES_HOST": POSTGRES_HOST,
            "POSTGRES_PORT": POSTGRES_PORT,
            "POSTGRES_DATABASE": POSTGRES_DATABASE,
            "POSTGRES_SCHEMA": POSTGRES_SCHEMA,
            "POSTGRES_USER": POSTGRES_USER,
            "POSTGRES_PASSWORD": POSTGRES_PASSWORD,
            "PROCESSED_FILE_PATH_LIST_STR": "{{ task_instance.xcom_pull(task_ids='process_file') | tojson }}",
        },
    )

    dbt_Path = "/opt/airflow/dags/discountmate_dbt"

    install_packages_in_dbt = BashOperator(task_id = "install_extensions_for_dbt",
                                           bash_command = (f"cd {dbt_Path} && dbt deps"))

    dbt_check_error = BashOperator(task_id = "check_error_free_in_dbt",
                                           bash_command = (f"cd {dbt_Path} && dbt compile"))
    
    dbt_seed = BashOperator(task_id = "add_seed_data_to_dbt",
                                           bash_command = (f"cd {dbt_Path} && dbt seed"))
    
    run_staging = BashOperator(task_id = "construct_staging_layer",
                                           bash_command = (f"cd {dbt_Path} && dbt run --select staging"))
    
    run_snapshots = BashOperator(task_id = "track_dim_data_changes",
                                           bash_command = (f"cd {dbt_Path} && dbt snapshot"))
    
    run_intermediate = BashOperator(task_id = "construct_intermediate_layer",
                                           bash_command = (f"cd {dbt_Path} && dbt run --select intermediate"))
    
    run_marts = BashOperator(task_id = "construct_marts_layer",
                                           bash_command = (f"cd {dbt_Path} && dbt run --select marts"))
    
    # Define DAG chain
    bucket_check = check_minio_buckets()
    raw_file_path = ingest_from_mongo_to_minio()
    processed_file_path = process_file(raw_file_path)

    (bucket_check >> 
    raw_file_path >> 
    processed_file_path >> 
    load_to_dw >> 
    install_packages_in_dbt >> 
    dbt_check_error >> 
    dbt_seed >> 
    run_staging >> 
    run_snapshots >> 
    run_intermediate >> 
    run_marts)

dag = pipeline()