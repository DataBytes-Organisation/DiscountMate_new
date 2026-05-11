import io
from scripts.connectors import _get_minio_client

RAW_BUCKET = 'raw'
PROCESSED_BUCKET = 'processed'

def _check_minio_buckets():
    minio_client = _get_minio_client()
    if not minio_client.bucket_exists(RAW_BUCKET):
        minio_client.make_bucket(RAW_BUCKET)
    if not minio_client.bucket_exists(PROCESSED_BUCKET):
        minio_client.make_bucket(PROCESSED_BUCKET)
        
def _ingest_to_minio(object_name, data):
    minio_client = _get_minio_client()
    data_stream = io.BytesIO(data)
    minio_client.put_object(
        bucket_name=RAW_BUCKET,
        object_name=object_name,
        data=data_stream,
        length=len(data),
    )
    file_path = f"{RAW_BUCKET}/{object_name}"
    return file_path