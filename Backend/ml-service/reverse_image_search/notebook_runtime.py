"""
Query-only runtime extracted from the reverse-image-search Jupyter notebook.

Loads reverse-image-search metadata plus the FAISS index cached from GCS, and
exposes two entrypoints for reverse-image search:

    search_image_file(image_path, top_k=3)    -> list[dict]
    search_image_array(bgr_image,  top_k=3)   -> list[dict]

Retrieval semantics (backbone, augmentations, score aggregation, dedup) are
copied verbatim from the notebook to preserve behaviour.
"""
from __future__ import annotations

import os
# Fix OpenMP duplicate-library conflict between faiss-cpu and PyTorch on macOS ARM64.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import json
import re
import sys
from pathlib import Path
from typing import Optional, cast

import google.auth
from dotenv import load_dotenv
from google.cloud.storage import Client as StorageClient  # pyright: ignore[reportMissingImports]

# torch MUST be imported before faiss (OpenMP runtime claim — see notebook).
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms

import numpy as np
import cv2
import faiss
from PIL import Image

# ---------------------------------------------------------------------------
# Paths (local project root)
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
METADATA_PATH = BASE_DIR.parent / "ml_models" / "reverse_image_search_metadata.json"
TEST_IMAGE_DIR = BASE_DIR / "Test_Image"

# Allow direct `uvicorn api:app` runs to use Backend/.env too. When spawned by
# node server.js, dotenv is already loaded there and these values are preserved.
load_dotenv(BASE_DIR.parent.parent / ".env", override=False)

# ---------------------------------------------------------------------------
# GCS config — override via env vars if needed
# ---------------------------------------------------------------------------
FAISS_BUCKET_NAME = os.environ.get("FAISS_BUCKET_NAME", "discountmate-ml-models")
FAISS_OBJECT_NAME = os.environ.get("FAISS_OBJECT_NAME", "reverse_image_search.faiss")
FAISS_GCP_PROJECT = (
    os.environ.get("FAISS_GCP_PROJECT")
    or os.environ.get("GOOGLE_CLOUD_PROJECT")
    or os.environ.get("GCLOUD_PROJECT")
    or os.environ.get("GCP_PROJECT")
)
FAISS_QUOTA_PROJECT = os.environ.get("FAISS_QUOTA_PROJECT") or FAISS_GCP_PROJECT


def _resolve_faiss_local_path() -> Path:
    if override := os.environ.get("LOCAL_FAISS_PATH"):
        return Path(override)
    if _is_gcp_serverless():
        return Path("/tmp") / FAISS_OBJECT_NAME
    return BASE_DIR.parent / "ml_models" / FAISS_OBJECT_NAME


def _is_gcp_serverless() -> bool:
    return bool(os.environ.get("K_SERVICE") or os.environ.get("GAE_SERVICE"))


INDEX_PATH = _resolve_faiss_local_path()


def load_faiss_index_from_gcs() -> Path:
    """Download the FAISS index from GCS if not already cached locally."""
    if INDEX_PATH.exists():
        return INDEX_PATH
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp_path = INDEX_PATH.with_name(f".{INDEX_PATH.name}.download")
    try:
        if not FAISS_GCP_PROJECT and not _is_gcp_serverless():
            raise RuntimeError(
                "GCP project is not configured for local Google Cloud Storage access."
            )
        auth_kwargs = {"scopes": ["https://www.googleapis.com/auth/devstorage.read_only"]}
        if not _is_gcp_serverless() and FAISS_QUOTA_PROJECT:
            auth_kwargs["quota_project_id"] = FAISS_QUOTA_PROJECT

        credentials, detected_project = google.auth.default(**auth_kwargs)
        client = StorageClient(
            project=FAISS_GCP_PROJECT or detected_project,
            credentials=credentials,
        )
        bucket = client.bucket(FAISS_BUCKET_NAME)
        blob = bucket.blob(FAISS_OBJECT_NAME)
        print(
            f"Downloading FAISS index from "
            f"gs://{FAISS_BUCKET_NAME}/{FAISS_OBJECT_NAME} to {INDEX_PATH}"
        )
        blob.download_to_filename(str(temp_path))
        os.replace(temp_path, INDEX_PATH)
    except Exception as exc:
        if temp_path.exists():
            temp_path.unlink()
        raise RuntimeError(
            f"Failed to download FAISS index from "
            f"gs://{FAISS_BUCKET_NAME}/{FAISS_OBJECT_NAME}: {exc}. "
            "For local development, set FAISS_GCP_PROJECT or GOOGLE_CLOUD_PROJECT "
            "to your GCP project ID, then run "
            "`gcloud config set project <project-id>` and "
            "`gcloud auth application-default set-quota-project <project-id>`."
        ) from exc
    return INDEX_PATH

# ---------------------------------------------------------------------------
# Config — mirrors notebook defaults that produced the shipped index.
# index.faiss was built with DINOv2 (768-dim) + HNSW; do not change these
# unless the index is rebuilt.
# ---------------------------------------------------------------------------
BACKBONE: str = "dinov2_vitb14"
VECTOR_DIM: int = 1792 if BACKBONE == "efficientnet_b4" else 768
INDEX_TYPE: str = "hnsw"
TTA_STRATEGY: str = "max"

if torch.cuda.is_available():
    DEVICE = "cuda"
elif torch.backends.mps.is_available():
    DEVICE = "mps"
else:
    DEVICE = "cpu"


# ---------------------------------------------------------------------------
# Feature extractors (copied from the notebook)
# ---------------------------------------------------------------------------
class EfficientNetB4Extractor(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        from torchvision import models
        backbone = models.efficientnet_b4(
            weights=models.EfficientNet_B4_Weights.IMAGENET1K_V1
        )
        self.features = backbone.features
        self.avgpool = backbone.avgpool

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = self.avgpool(x)
        x = torch.flatten(x, 1)
        x = F.normalize(x, p=2, dim=1)
        return x


class DinoV2Extractor(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.backbone = load_dinov2_backbone()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.backbone(x)
        x = F.normalize(x, p=2, dim=1)
        return x


def _patch_cached_dinov2_for_python39() -> bool:
    """Patch Torch Hub's cached DINOv2 annotations that are invalid on Python 3.9."""
    cache_root = Path(torch.hub.get_dir()) / "facebookresearch_dinov2_main" / "dinov2" / "layers"
    targets = [cache_root / "attention.py", cache_root / "block.py"]
    patched = False

    for target in targets:
        if not target.exists():
            continue

        text = target.read_text(encoding="utf-8")
        updated = text.replace("float | None", "Optional[float]")

        if updated != text and target.name == "attention.py" and "from typing import Optional" not in updated:
            updated = updated.replace("import os\n", "import os\nfrom typing import Optional\n", 1)

        if updated != text:
            target.write_text(updated, encoding="utf-8")
            patched = True

    return patched


def load_dinov2_backbone() -> nn.Module:
    try:
        return cast(nn.Module, torch.hub.load("facebookresearch/dinov2", "dinov2_vitb14"))
    except TypeError as exc:
        if sys.version_info >= (3, 10) or "unsupported operand type(s) for |" not in str(exc):
            raise

        if not _patch_cached_dinov2_for_python39():
            raise RuntimeError(
                "DINOv2 requires Python 3.10+ unless the Torch Hub cache can be patched. "
                "Install Python 3.10+ or clear and re-download the DINOv2 Torch Hub cache."
            ) from exc

        for name in list(sys.modules):
            if name == "dinov2" or name.startswith("dinov2."):
                sys.modules.pop(name, None)

        return cast(nn.Module, torch.hub.load("facebookresearch/dinov2", "dinov2_vitb14"))


_PREPROCESS_EFFNET = transforms.Compose([
    transforms.Resize(380),
    transforms.CenterCrop(380),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

_PREPROCESS_DINOV2 = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])


def _get_preprocess() -> transforms.Compose:
    return _PREPROCESS_DINOV2 if BACKBONE == "dinov2_vitb14" else _PREPROCESS_EFFNET


def build_extractor(device: str = "cpu") -> nn.Module:
    if BACKBONE == "dinov2_vitb14":
        model = DinoV2Extractor().to(device)
    else:
        model = EfficientNetB4Extractor().to(device)
    model.eval()
    return model


def extract_vectors_batch(bgrs: list, model: nn.Module, device: str = "cpu") -> np.ndarray:
    if not bgrs:
        return np.empty((0, VECTOR_DIM), dtype=np.float32)
    preprocess = _get_preprocess()
    tensors = []
    for bgr in bgrs:
        if bgr is None or bgr.size == 0:
            raise ValueError("extract_vectors_batch received an empty image array.")
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        tensors.append(preprocess(Image.fromarray(rgb)))
    batch = torch.stack(tensors, dim=0).to(device)
    with torch.inference_mode():
        vecs = model(batch).cpu().numpy()
    return vecs.astype(np.float32)


# ---------------------------------------------------------------------------
# Augmentations (copied from the notebook)
# ---------------------------------------------------------------------------
def augment_image(bgr: np.ndarray, augment: str) -> np.ndarray:
    img = bgr.copy()
    if augment == "normal":
        return img
    if augment == "blur":
        return cv2.GaussianBlur(img, (15, 15), 0)
    if augment == "saturate":
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.5, 0, 255)
        return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    if augment == "flipped":
        return cv2.flip(img, 1)
    if augment == "centre_zoom":
        h, w = img.shape[:2]
        if h < 4 or w < 4:
            return img
        cy, cx = h // 2, w // 2
        ch, cw = int(h * 0.7), int(w * 0.7)
        y1, x1 = cy - ch // 2, cx - cw // 2
        cropped = img[y1:y1 + ch, x1:x1 + cw]
        return cv2.resize(cropped, (w, h), interpolation=cv2.INTER_LINEAR)
    raise ValueError(f"Unknown augmentation: '{augment}'")


AUGMENTS_MAIN = ["normal", "blur", "saturate", "flipped", "centre_zoom"]


# ---------------------------------------------------------------------------
# Engine: cached loader for model + index + metadata
# ---------------------------------------------------------------------------
_engine_cache: dict = {}


def load_engine(device: Optional[str] = None) -> dict:
    """Load (and memoise) the model, FAISS index, and metadata."""
    if _engine_cache:
        return _engine_cache

    dev = device or DEVICE

    if not METADATA_PATH.exists():
        raise FileNotFoundError(
            f"Metadata file not found at '{METADATA_PATH}'. "
            "Expected a prebuilt metadata file alongside the runtime module."
        )

    resolved_index = load_faiss_index_from_gcs()
    try:
        index = faiss.read_index(str(resolved_index))
    except Exception as exc:
        raise RuntimeError(
            f"Failed to load FAISS index from '{resolved_index}': {exc}. "
            "Delete the cached file and restart to download a fresh copy."
        ) from exc
    if index.d != VECTOR_DIM:
        raise ValueError(
            f"Index dimension ({index.d}) does not match BACKBONE "
            f"{BACKBONE!r} (expected {VECTOR_DIM}). "
            "Rebuild the index or change BACKBONE to match."
        )
    if index.ntotal == 0:
        print(
            "[ReverseImageSearch] WARNING: FAISS index contains 0 vectors — "
            "all searches will return empty results. "
            "Upload the correct index to GCS and delete the local cache to re-download.",
            file=sys.stderr,
        )
    with open(METADATA_PATH, encoding="utf-8") as f:
        metadata = json.load(f)

    model = build_extractor(dev)

    _engine_cache.update({
        "model": model,
        "index": index,
        "metadata": metadata,
        "device": dev,
    })
    return _engine_cache


# ---------------------------------------------------------------------------
# Core search — mirrors query_product() in the notebook (cell 25).
# Dedupes by product_id; aggregates scores across 5 TTA augments.
# ---------------------------------------------------------------------------
def _search_bgr(bgr: np.ndarray, top_k: int = 3) -> list:
    if bgr is None or bgr.size == 0:
        raise ValueError("Query image is empty or unreadable.")

    engine = load_engine()
    model = engine["model"]
    index = engine["index"]
    metadata = engine["metadata"]
    device = engine["device"]

    aug_imgs = [augment_image(bgr, aug) for aug in AUGMENTS_MAIN]
    aug_vecs = extract_vectors_batch(aug_imgs, model, device)  # (5, dim)

    fetch_k = top_k * 15
    product_agg: dict = {}

    for vec in aug_vecs:
        q = np.ascontiguousarray(vec.reshape(1, -1), dtype=np.float32)
        scores, indices_arr = index.search(q, fetch_k)
        for fidx, score in zip(indices_arr[0], scores[0]):
            if fidx == -1:
                continue
            meta = metadata[fidx]
            # Deduplicate by mongo_id (one entry per product in new index)
            pid = meta["mongo_id"]
            score_f = float(score)
            entry = product_agg.get(pid)
            if entry is None:
                product_agg[pid] = {"max": score_f, "sum": score_f,
                                    "count": 1, "meta": meta}
            else:
                if score_f > entry["max"]:
                    entry["max"] = score_f
                    entry["meta"] = meta
                entry["sum"] += score_f
                entry["count"] += 1

    scored = []
    for pid, agg in product_agg.items():
        if TTA_STRATEGY == "hybrid":
            mean_score = agg["sum"] / agg["count"]
            final_score = 0.7 * agg["max"] + 0.3 * mean_score
        else:
            final_score = agg["max"]
        scored.append((final_score, agg["meta"]))

    scored.sort(key=lambda x: x[0], reverse=True)
    ranked = scored[:top_k]

    results = []
    for rank, (score, meta) in enumerate(ranked, 1):
        results.append({
            "rank": rank,
            "mongo_id": meta["mongo_id"],
            "name": meta["title"],
            # product_code kept as product_id for API backward compatibility
            "product_id": meta.get("product_code") or meta["mongo_id"],
            "image_url": meta["image_url"],   # full CDN URL from MongoDB
            "similarity_score": float(score),
            "price_now": meta.get("coles_price"),
            "price_was": None,
            "price_comparable": None,
            "woolworths_price": meta.get("woolworths_price"),
            "iga_price": meta.get("iga_price"),
        })
    return results


def search_image_array(bgr_image: np.ndarray, top_k: int = 3) -> list:
    """Reverse-image search from an in-memory OpenCV BGR array."""
    return _search_bgr(bgr_image, top_k=top_k)


def search_image_file(image_path, top_k: int = 3) -> list:
    """Reverse-image search from a file path on disk."""
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Query image not found: {path}")
    bgr = cv2.imread(str(path))
    if bgr is None:
        raise ValueError(f"Cannot read query image: {path}")
    return _search_bgr(bgr, top_k=top_k)
