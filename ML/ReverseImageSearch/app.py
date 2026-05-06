"""
Streamlit webcam reverse-image-search app.

Launch:
    streamlit run app.py
"""
from __future__ import annotations

import numpy as np
import streamlit as st
import cv2
from PIL import Image

from notebook_runtime import (
    INDEX_PATH,
    METADATA_PATH,
    load_engine,
    search_image_array,
)


st.set_page_config(page_title="Coles Reverse Image Search", layout="wide")
st.title("Coles Reverse Image Search — Webcam")
st.caption("Snap a product with your webcam. We return the 3 closest catalogue matches.")


@st.cache_resource(show_spinner="Loading model, FAISS index, and metadata…")
def _cached_engine() -> dict:
    return load_engine()


# Pre-flight checks surface friendly errors instead of a traceback.
if not INDEX_PATH.exists():
    st.error(f"FAISS index not found at `{INDEX_PATH}`.")
    st.stop()
if not METADATA_PATH.exists():
    st.error(f"Metadata file not found at `{METADATA_PATH}`.")
    st.stop()

try:
    _cached_engine()
except Exception as exc:
    st.error(f"Failed to load search engine: {exc}")
    st.stop()

st.info(
    "If your browser asks for camera permission, click **Allow**. "
    "The camera widget below will then activate."
)

snapshot = st.camera_input("Take a picture")

if snapshot is None:
    st.stop()

try:
    pil_img = Image.open(snapshot).convert("RGB")
except Exception as exc:
    st.error(f"Could not decode the captured image: {exc}")
    st.stop()

rgb = np.array(pil_img)
bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

with st.spinner("Searching catalogue…"):
    try:
        results = search_image_array(bgr, top_k=3)
    except Exception as exc:
        st.error(f"Search failed: {exc}")
        st.stop()

st.subheader("Top 3 matches")

left, right = st.columns([1, 3])
with left:
    st.image(rgb, caption="Your capture", use_container_width=True)

def _fmt_price(val) -> str:
    """Render price_now / price_was as $X.XX when numeric, else pass through.

    Dollar signs are backslash-escaped so Streamlit's markdown renderer does
    not interpret them as LaTeX math delimiters.
    """
    if val is None:
        return "—"
    s = str(val).strip()
    if not s or s.lower() == "nan":
        return "—"
    try:
        return f"\\${float(s):.2f}"
    except ValueError:
        return s.replace("$", "\\$")


with right:
    cols = st.columns(3)
    for col, r in zip(cols, results):
        with col:
            img_path = r["matched_image_path"]
            if img_path.exists():
                st.image(str(img_path), use_container_width=True)
            else:
                st.warning("Catalogue image file missing")
            score_pct = r["similarity_score"] * 100
            price_now = _fmt_price(r.get("price_now"))
            price_was = _fmt_price(r.get("price_was"))
            comparable = r.get("price_comparable") or "—"
            if str(comparable).strip().lower() == "nan":
                comparable = "—"
            price_line = f"Price: **{price_now}**"
            if price_was != "—" and price_was != price_now:
                price_line += f"  ~~{price_was}~~"
            st.markdown(
                f"**#{r['rank']} — {r['name']}**\n\n"
                f"{price_line}\n\n"
                f"Unit price: `{comparable}`\n\n"
                f"Score: `{r['similarity_score']:.4f}`  ({score_pct:.1f}%)\n\n"
                f"Product ID: `{r['product_id']}`"
            )

if len(results) < 3:
    st.warning(f"Only {len(results)} result(s) returned — fewer than top_k=3.")
