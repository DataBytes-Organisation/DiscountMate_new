"""
Product Embedder — Embeds product descriptions into the same 768-dim
vector space as recipes, so ingredients and products are comparable.

Input:
    A CSV (or DataFrame) with at minimum a description column,
    plus stable identifiers (barcode + product_id) for joining
    to a live prices table later.

Output (next to recipe_index.npz):
    Backend/ml-service/recipe_rag/index/product_index.npz
        - "embeddings"   (M x 768) float32
        - "barcodes"     (M,)      object/str
        - "product_ids"  (M,)      object/str

    Backend/ml-service/recipe_rag/index/product_metadata.json
        {
          "products": [
              {"barcode": "...", "product_id": "...",
               "description": "..."},
              ...
          ],
          "source_file": "...",
          "embedding_model": "all-mpnet-base-v2",
          "row_count": M
        }

Usage (from Backend/ml-service/):
    python product_embedder.py
    python product_embedder.py --csv "../../Master_Data_2026_Onward/Master_table_for_embedding.csv"
    python product_embedder.py --barcode-col Barcode --id-col ProductId --desc-col Description
"""

import argparse
import json
import os
import sys
import time
from typing import List

import numpy as np
import pandas as pd

# Make recipe_rag importable when running this script directly
sys.path.insert(0, os.path.dirname(__file__))

# Default output sits beside the recipe index
INDEX_DIR = os.path.join(os.path.dirname(__file__), "recipe_rag", "index")
EMBEDDING_MODEL_NAME = "all-mpnet-base-v2"

# Default input — relative to this script
DEFAULT_CSV = os.path.join(
    os.path.dirname(__file__), "..", "..",
    "Master_Data_2026_Onward", "Master_table_for_embedding.csv",
)


# ---------------------------------------------------------------------------
# Core function (importable / reusable)
# ---------------------------------------------------------------------------

def embed_products(
    csv_path: str,
    barcode_col: str = "Barcode",
    id_col: str = "ProductId",
    desc_col: str = "Description",
    index_dir: str = INDEX_DIR,
    batch_size: int = 64,
    drop_duplicates: bool = True,
):
    """
    Load product CSV, embed descriptions, save .npz + .json.

    Returns the loaded DataFrame (with embeddings attached as `_emb` column
    NOT included — that would bloat memory; embeddings are saved separately).
    """
    print("=" * 70)
    print("PRODUCT EMBEDDER")
    print("=" * 70)
    print(f"CSV: {csv_path}")
    print(f"Columns: barcode='{barcode_col}', id='{id_col}', desc='{desc_col}'")

    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    # 1. Load + validate
    df = pd.read_csv(csv_path, dtype=str)  # keep barcodes as strings (preserve leading zeros)
    print(f"\n[1/4] Loaded {len(df):,} rows")

    missing = [c for c in (barcode_col, id_col, desc_col) if c not in df.columns]
    if missing:
        raise ValueError(
            f"CSV is missing column(s) {missing}. "
            f"Available columns: {list(df.columns)}"
        )

    # Drop empty descriptions — can't embed them
    before = len(df)
    df = df[df[desc_col].notna() & (df[desc_col].str.strip() != "")]
    if len(df) < before:
        print(f"  Dropped {before - len(df):,} rows with empty description")

    # Optional: dedupe identical descriptions (keeps first product_id seen)
    if drop_duplicates:
        before = len(df)
        df = df.drop_duplicates(subset=[desc_col], keep="first").reset_index(drop=True)
        if len(df) < before:
            print(f"  Dropped {before - len(df):,} duplicate descriptions")

    descriptions: List[str] = df[desc_col].astype(str).str.strip().tolist()
    barcodes: List[str] = df[barcode_col].fillna("").astype(str).tolist()
    product_ids: List[str] = df[id_col].fillna("").astype(str).tolist()

    # 2. Load embedding model
    print(f"\n[2/4] Loading embedding model: {EMBEDDING_MODEL_NAME}")
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    print(f"  Embedding dim: {model.get_sentence_embedding_dimension()}")

    # 3. Embed
    print(f"\n[3/4] Embedding {len(descriptions):,} product descriptions"
          f" (batch_size={batch_size})...")
    start = time.time()
    embeddings = model.encode(
        descriptions,
        show_progress_bar=True,
        batch_size=batch_size,
        convert_to_numpy=True,
    ).astype(np.float32)
    elapsed = time.time() - start
    print(f"  Done in {elapsed:.1f}s "
          f"({len(descriptions)/elapsed:.0f} products/sec)")
    print(f"  Shape: {embeddings.shape}")

    # 4. Save
    print(f"\n[4/4] Saving index to {index_dir}/")
    os.makedirs(index_dir, exist_ok=True)

    npz_path = os.path.join(index_dir, "product_index.npz")
    np.savez_compressed(
        npz_path,
        embeddings=embeddings,
        barcodes=np.array(barcodes, dtype=object),
        product_ids=np.array(product_ids, dtype=object),
    )
    npz_mb = os.path.getsize(npz_path) / (1024 * 1024)
    print(f"  Saved {npz_path} ({npz_mb:.1f} MB)")

    meta_path = os.path.join(index_dir, "product_metadata.json")
    payload = {
        "products": [
            {"barcode": b, "product_id": p, "description": d}
            for b, p, d in zip(barcodes, product_ids, descriptions)
        ],
        "source_file": os.path.basename(csv_path),
        "embedding_model": EMBEDDING_MODEL_NAME,
        "row_count": len(descriptions),
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    meta_mb = os.path.getsize(meta_path) / (1024 * 1024)
    print(f"  Saved {meta_path} ({meta_mb:.1f} MB)")

    print("\n" + "=" * 70)
    print("BUILD COMPLETE")
    print(f"  Products: {len(descriptions):,}")
    print(f"  Index dir: {index_dir}")
    print("=" * 70)
    return df


# ---------------------------------------------------------------------------
# Optional smoke test
# ---------------------------------------------------------------------------

def test_lookup(index_dir: str, query: str = "beef mince", top_k: int = 5):
    """Verify the saved index loads + returns sensible matches."""
    print(f"\n--- Smoke test: '{query}' ---")
    from sentence_transformers import SentenceTransformer

    data = np.load(os.path.join(index_dir, "product_index.npz"), allow_pickle=True)
    embeddings = data["embeddings"]
    barcodes = data["barcodes"]
    product_ids = data["product_ids"]

    with open(os.path.join(index_dir, "product_metadata.json"),
              "r", encoding="utf-8") as f:
        meta = json.load(f)
    products = meta["products"]

    model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    q = model.encode([query], convert_to_numpy=True).astype(np.float32)
    q_norm = q / (np.linalg.norm(q, axis=1, keepdims=True) + 1e-10)
    e_norm = embeddings / (np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-10)
    sims = (e_norm @ q_norm.T).flatten()

    top = np.argsort(sims)[::-1][:top_k]
    for rank, i in enumerate(top, 1):
        print(f"  #{rank} ({sims[i]:.3f}) "
              f"barcode={barcodes[i]} id={product_ids[i]} | "
              f"{products[i]['description']}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Embed product descriptions")
    parser.add_argument("--csv", default=DEFAULT_CSV,
                        help="Path to product CSV file")
    parser.add_argument("--barcode-col", default="Barcode")
    parser.add_argument("--id-col", default="ProductId")
    parser.add_argument("--desc-col", default="Description")
    parser.add_argument("--index-dir", default=INDEX_DIR)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--no-dedupe", action="store_true",
                        help="Keep duplicate descriptions")
    parser.add_argument("--test", action="store_true",
                        help="Run a smoke lookup after building")
    parser.add_argument("--test-query", default="beef mince")
    args = parser.parse_args()

    embed_products(
        csv_path=args.csv,
        barcode_col=args.barcode_col,
        id_col=args.id_col,
        desc_col=args.desc_col,
        index_dir=args.index_dir,
        batch_size=args.batch_size,
        drop_duplicates=not args.no_dedupe,
    )

    if args.test:
        test_lookup(args.index_dir, args.test_query)