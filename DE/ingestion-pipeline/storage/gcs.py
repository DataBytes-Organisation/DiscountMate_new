from __future__ import annotations

from pathlib import Path

from google.cloud import storage as google_storage
from storage.models import MaterializedArtifacts


class GCSStorage:
    def __init__(self, bucket_name: str, prefix: str = "") -> None:
        self.bucket_name = bucket_name
        self.prefix = prefix.strip("/")

    def upload(self, artifacts: MaterializedArtifacts, output_root: Path) -> list[str]:
        client = google_storage.Client()
        bucket = client.bucket(self.bucket_name)
        uploaded_uris: list[str] = []

        for path in (artifacts.jsonl_path, artifacts.csv_path, artifacts.manifest_path):
            relative_path = path.relative_to(output_root).as_posix()
            blob_name = "/".join(part for part in (self.prefix, relative_path) if part)
            blob = bucket.blob(blob_name)
            blob.upload_from_filename(path)
            uploaded_uris.append(f"gs://{self.bucket_name}/{blob_name}")

        return uploaded_uris
