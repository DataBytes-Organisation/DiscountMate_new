from __future__ import annotations

from typing import TYPE_CHECKING

from google.cloud import storage as google_storage

if TYPE_CHECKING:
    from storage.models import MaterializedArtifacts


class GCSStorage:
    def __init__(self, bucket_name: str, prefix: str = "") -> None:
        self.bucket_name = bucket_name
        self.prefix = prefix.strip("/")

    def upload(
        self, source: str, runner: str, artifacts: MaterializedArtifacts
    ) -> list[str]:
        client = google_storage.Client()
        bucket = client.bucket(self.bucket_name)
        blob_name = "/".join(
            part
            for part in (self.prefix, source, runner, artifacts.csv_path.name)
            if part
        )
        blob = bucket.blob(blob_name)
        blob.upload_from_filename(artifacts.csv_path)
        return [f"gs://{self.bucket_name}/{blob_name}"]
