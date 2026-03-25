from __future__ import annotations

import json

from storage.gcs import GCSStorage
from storage.local import LocalStorage
from storage.models import MaterializedArtifacts


class StorageManager:
    def __init__(self, settings) -> None:
        self.settings = settings
        self.local_storage = LocalStorage(settings.app.output_dir)
        self.gcs_storage = (
            GCSStorage(settings.gcs.bucket, settings.gcs.prefix)
            if settings.gcs.bucket
            else None
        )

    def persist(
        self,
        source: str,
        runner: str,
        run_id: str,
        records: list[dict[str, object]],
        metadata: dict[str, object],
    ) -> MaterializedArtifacts:
        artifacts = self.local_storage.materialize(
            source, runner, run_id, records, metadata
        )

        uploaded_uris: list[str] = []
        if "gcs" in self.settings.app.destinations:
            if self.gcs_storage is None:
                raise RuntimeError(
                    "GCS destination selected but GCS_BUCKET is not configured"
                )
            uploaded_uris = self.gcs_storage.upload(
                artifacts, self.settings.app.output_dir
            )

        if uploaded_uris:
            artifacts.uploaded_uris.extend(uploaded_uris)
            artifacts.manifest["uploaded_uris"] = uploaded_uris
            artifacts.manifest_path.write_text(
                json.dumps(artifacts.manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

        return artifacts
