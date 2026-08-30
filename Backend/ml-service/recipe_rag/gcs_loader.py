"""
GCS loader for RAG index files.

Binary index artefacts live in the team's existing GCS bucket
(discountmate-ml-models) under a recipe_rag/ prefix, and are
downloaded to a local cache on first run.

Behaviour by environment:
  - LOCAL DEV:        if a file already exists at the expected local
                      path, it is used as-is (no download). Only files
                      that are MISSING locally trigger a GCS fetch.
  - CLOUD RUN / GAE:  cache directory defaults to /tmp/recipe_rag/.

Required env vars (already set in Backend/.env):
  GOOGLE_CLOUD_PROJECT       sit-26t1-discountmate-935cb94
  RAG_BUCKET_NAME            discountmate-ml-models
  RAG_OBJECT_PREFIX          recipe_rag/
"""

from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional

# google.auth + google.cloud.storage are imported lazily inside the
# download function so the rest of the pipeline still works on machines
# that haven't installed the GCS deps.

# Load Backend/.env (2 levels up: recipe_rag/ -> ml-service/ -> Backend)
try:
    from dotenv import load_dotenv
    _ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
    if _ENV_PATH.exists():
        load_dotenv(_ENV_PATH, override=False)
except ImportError:
    pass  # dotenv optional; env vars may be set by the host (Cloud Run)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# All artefacts the RAG pipeline needs at runtime. If you add new ones
# to the index folder later, add the filename here.
INDEX_FILES = [
    "recipe_index.npz",
    "recipe_metadata.json",
    "product_index.npz",
    "product_metadata.json",
]

RAG_BUCKET_NAME = os.environ.get("RAG_BUCKET_NAME", "discountmate-ml-models")
RAG_OBJECT_PREFIX = os.environ.get("RAG_OBJECT_PREFIX", "recipe_rag/")
RAG_GCP_PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_gcp_serverless() -> bool:
    """True when running in Cloud Run / App Engine."""
    return bool(os.environ.get("K_SERVICE") or os.environ.get("GAE_SERVICE"))


def _resolve_local_index_dir() -> Path:
    """Where the index files should live on this machine."""
    if _is_gcp_serverless():
        return Path("/tmp") / "recipe_rag"
    # Default: same place rag_pipeline.py already expects
    # (Backend/ml-service/recipe_rag/index/)
    return Path(__file__).resolve().parent / "index"


def _download_one(blob_name: str, dest_path: Path) -> None:
    """Download a single object from GCS to dest_path (atomic via temp file)."""
    # Lazy imports — only blow up if we actually need to download
    import google.auth
    from google.cloud.storage import Client as StorageClient

    if not RAG_GCP_PROJECT and not _is_gcp_serverless():
        raise RuntimeError(
            "GOOGLE_CLOUD_PROJECT is not set. Add it to your .env, then run:\n"
            "  gcloud auth application-default login"
        )

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = dest_path.with_name(f".{dest_path.name}.download")

    try:
        auth_kwargs = {"scopes": ["https://www.googleapis.com/auth/devstorage.read_only"]}
        if not _is_gcp_serverless() and RAG_GCP_PROJECT:
            auth_kwargs["quota_project_id"] = RAG_GCP_PROJECT

        credentials, detected_project = google.auth.default(**auth_kwargs)
        client = StorageClient(
            project=RAG_GCP_PROJECT or detected_project,
            credentials=credentials,
        )
        bucket = client.bucket(RAG_BUCKET_NAME)
        blob = bucket.blob(blob_name)
        print(f"[gcs_loader] downloading "
              f"gs://{RAG_BUCKET_NAME}/{blob_name} -> {dest_path}")
        blob.download_to_filename(str(temp_path))
        os.replace(temp_path, dest_path)
    except Exception as exc:
        if temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass
        raise RuntimeError(
            f"Failed to download gs://{RAG_BUCKET_NAME}/{blob_name}: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_local_index_dir() -> str:
    """Return the directory where the RAG index files are cached locally."""
    return str(_resolve_local_index_dir())


def ensure_index_file(filename: str,
                      index_dir: Optional[str] = None) -> str:
    """
    Make sure a single index file exists locally; download from GCS if not.
    Returns the absolute local path.

    Safe to call repeatedly — it's a no-op when the file is already present.
    """
    target_dir = Path(index_dir) if index_dir else _resolve_local_index_dir()
    local_path = target_dir / filename

    if local_path.exists():
        return str(local_path)

    blob_name = f"{RAG_OBJECT_PREFIX}{filename}"
    _download_one(blob_name, local_path)
    return str(local_path)


def ensure_all_indexes(index_dir: Optional[str] = None) -> None:
    """Ensure every file in INDEX_FILES is present locally, downloading in parallel."""
    target_dir = Path(index_dir) if index_dir else _resolve_local_index_dir()
    missing = [f for f in INDEX_FILES if not (target_dir / f).exists()]
    if not missing:
        return
    print(f"[gcs_loader] {len(missing)} file(s) missing locally, "
          f"fetching from GCS in parallel: {missing}")
    with ThreadPoolExecutor(max_workers=min(len(missing), 4)) as executor:
        futures = {
            executor.submit(ensure_index_file, f, str(target_dir)): f
            for f in missing
        }
        for future in as_completed(futures):
            filename = futures[future]
            try:
                future.result()
            except RuntimeError as exc:
                raise RuntimeError(
                    f"Failed to download {filename}: {exc}"
                ) from exc
