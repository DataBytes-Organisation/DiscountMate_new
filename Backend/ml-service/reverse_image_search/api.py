"""
FastAPI reverse-image-search service.

Start with:
    uvicorn api:app --host 0.0.0.0 --port 8001 --reload
"""
from __future__ import annotations

import os
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import io
from contextlib import asynccontextmanager
from typing import Optional

import cv2
import numpy as np
from PIL import Image

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from notebook_runtime import (
    METADATA_PATH,
    load_engine,
    search_image_array,
)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not METADATA_PATH.exists():
        raise RuntimeError(f"Metadata not found at '{METADATA_PATH}'.")
    load_engine()
    yield


app = FastAPI(title="DiscountMate Reverse Image Search", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchResult(BaseModel):
    rank: int
    product_id: str
    name: str
    similarity_score: float
    image_url: str
    mongo_id: Optional[str] = None
    price_now: Optional[str] = None
    price_was: Optional[str] = None
    price_comparable: Optional[str] = None
    woolworths_price: Optional[str] = None
    iga_price: Optional[str] = None


def _clean_price(val) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    return None if not s or s.lower() == "nan" else s


@app.post("/reverse-image-search", response_model=list[SearchResult])
async def reverse_image_search(
    file: UploadFile = File(...),
    top_k: int = 5,
) -> list[SearchResult]:
    if not (1 <= top_k <= 20):
        raise HTTPException(status_code=400, detail="top_k must be between 1 and 20.")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB).")

    try:
        pil_img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not decode image: {exc}")

    rgb = np.array(pil_img)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    try:
        hits = search_image_array(bgr, top_k=top_k)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Search failed: {exc}")

    return [
        SearchResult(
            rank=r["rank"],
            product_id=str(r["product_id"]),
            name=r["name"],
            similarity_score=float(r["similarity_score"]),
            image_url=r["image_url"],
            mongo_id=r.get("mongo_id"),
            price_now=_clean_price(r.get("price_now")),
            price_was=_clean_price(r.get("price_was")),
            price_comparable=_clean_price(r.get("price_comparable")),
            woolworths_price=_clean_price(r.get("woolworths_price")),
            iga_price=_clean_price(r.get("iga_price")),
        )
        for r in hits
    ]


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
