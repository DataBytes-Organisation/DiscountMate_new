"""
Build Recipe + Ingredient Vector Indexes (offline / one-time)

Loads all recipe JSONs, embeds them with sentence-transformers
(all-mpnet-base-v2, 768 dims, runs locally — no API calls), and
saves four files for the live RAG service to load at startup:

    recipe_rag/index/recipe_index.npz       — recipe embeddings (N x 768)
    recipe_rag/index/recipe_metadata.json   — text + metadata per recipe
    recipe_rag/index/ingredient_index.npz   — ingredient embeddings (M x 768)
    recipe_rag/index/ingredient_metadata.json
        — {"ingredients": [...], "ingredient_to_recipes": {...}}

Usage (from Backend/ml-service/):
    python build_recipe_index.py
    python build_recipe_index.py --recipe-dir "../../Recipe Scraper/woolworths_recipes"
    python build_recipe_index.py --skip-ingredients         # recipes only
    python build_recipe_index.py --test                     # quick search test
"""

import argparse
import json
import os
import sys
import time
import numpy as np

# Make recipe_rag importable when running this script directly
sys.path.insert(0, os.path.dirname(__file__))

from recipe_rag.preprocess import (
    load_recipes_from_directory,
    extract_unique_ingredients,
)

# Default output location — sits next to rag_pipeline.py for easy loading
INDEX_DIR = os.path.join(os.path.dirname(__file__), "recipe_rag", "index")
EMBEDDING_MODEL_NAME = "all-mpnet-base-v2"


# ---------------------------------------------------------------------------
# Index builders
# ---------------------------------------------------------------------------

def embed_recipes(model, recipes, batch_size=32):
    """Embed recipe text chunks. Returns (N, 768) float32 array."""
    texts = [r["text"] for r in recipes]
    print(f"\n[Embedding {len(texts)} recipes, batch_size={batch_size}]")
    start = time.time()
    embeddings = model.encode(
        texts,
        show_progress_bar=True,
        batch_size=batch_size,
        convert_to_numpy=True,
    ).astype(np.float32)
    elapsed = time.time() - start
    print(f"  Done in {elapsed:.1f}s ({len(texts)/elapsed:.1f} recipes/sec)")
    print(f"  Shape: {embeddings.shape}")
    return embeddings


def embed_ingredients(model, ingredients, batch_size=64):
    """Embed unique ingredient strings. Returns (M, 768) float32 array."""
    print(f"\n[Embedding {len(ingredients)} unique ingredients, "
          f"batch_size={batch_size}]")
    start = time.time()
    embeddings = model.encode(
        ingredients,
        show_progress_bar=True,
        batch_size=batch_size,
        convert_to_numpy=True,
    ).astype(np.float32)
    elapsed = time.time() - start
    print(f"  Done in {elapsed:.1f}s ({len(ingredients)/elapsed:.1f} ing/sec)")
    print(f"  Shape: {embeddings.shape}")
    return embeddings


def save_recipe_index(recipes, embeddings, index_dir):
    """Save recipe embeddings (.npz) + metadata (.json)."""
    os.makedirs(index_dir, exist_ok=True)

    emb_path = os.path.join(index_dir, "recipe_index.npz")
    np.savez_compressed(emb_path, embeddings=embeddings)
    emb_mb = os.path.getsize(emb_path) / (1024 * 1024)
    print(f"  Saved {emb_path} ({emb_mb:.1f} MB)")

    meta_path = os.path.join(index_dir, "recipe_metadata.json")
    payload = [{"text": r["text"], "metadata": r["metadata"]} for r in recipes]
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    meta_mb = os.path.getsize(meta_path) / (1024 * 1024)
    print(f"  Saved {meta_path} ({meta_mb:.1f} MB)")


def save_ingredient_index(ingredients, mapping, embeddings, index_dir):
    """Save ingredient embeddings (.npz) + ingredient→recipe mapping (.json)."""
    os.makedirs(index_dir, exist_ok=True)

    emb_path = os.path.join(index_dir, "ingredient_index.npz")
    np.savez_compressed(emb_path, embeddings=embeddings)
    emb_mb = os.path.getsize(emb_path) / (1024 * 1024)
    print(f"  Saved {emb_path} ({emb_mb:.1f} MB)")

    meta_path = os.path.join(index_dir, "ingredient_metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(
            {"ingredients": ingredients, "ingredient_to_recipes": mapping},
            f, ensure_ascii=False,
        )
    meta_mb = os.path.getsize(meta_path) / (1024 * 1024)
    print(f"  Saved {meta_path} ({meta_mb:.1f} MB)")


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def build(recipe_dir, index_dir, skip_ingredients=False):
    print("=" * 70)
    print("RECIPE INDEX BUILDER")
    print("=" * 70)

    print("\n[1/4] Loading & preprocessing recipes...")
    recipes = load_recipes_from_directory(recipe_dir)
    if not recipes:
        print("ERROR: No recipes found. Check --recipe-dir path.")
        return False

    print(f"\n[2/4] Loading embedding model: {EMBEDDING_MODEL_NAME}")
    print("  (~420MB on first download, then cached locally)")
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    print(f"  Embedding dim: {model.get_sentence_embedding_dimension()}")
    print(f"  Max seq length: {model.max_seq_length}")

    print("\n[3/4] Embedding recipes...")
    recipe_embeddings = embed_recipes(model, recipes)
    save_recipe_index(recipes, recipe_embeddings, index_dir)

    if skip_ingredients:
        print("\n[4/4] Skipping ingredient index (--skip-ingredients)")
    else:
        print("\n[4/4] Building ingredient index...")
        ingredients, mapping = extract_unique_ingredients(recipes)
        ing_embeddings = embed_ingredients(model, ingredients)
        save_ingredient_index(ingredients, mapping, ing_embeddings, index_dir)

    print("\n" + "=" * 70)
    print("BUILD COMPLETE")
    print(f"  Index dir: {index_dir}")
    print("=" * 70)
    return True


# ---------------------------------------------------------------------------
# Optional smoke test
# ---------------------------------------------------------------------------

def test_search(index_dir, query="quick chicken dinner for family", top_k=3):
    """Quick verification that the saved index loads and searches correctly."""
    print(f"\n--- Smoke test: '{query}' ---")
    from sentence_transformers import SentenceTransformer

    embeddings = np.load(os.path.join(index_dir, "recipe_index.npz"))["embeddings"]
    with open(os.path.join(index_dir, "recipe_metadata.json"), "r",
              encoding="utf-8") as f:
        meta = json.load(f)

    model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    q = model.encode([query], convert_to_numpy=True).astype(np.float32)

    # Cosine similarity
    q_norm = q / (np.linalg.norm(q, axis=1, keepdims=True) + 1e-10)
    e_norm = embeddings / (np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-10)
    sims = (e_norm @ q_norm.T).flatten()

    top = np.argsort(sims)[::-1][:top_k]
    for rank, i in enumerate(top, 1):
        print(f"  #{rank} ({sims[i]:.3f}) {meta[i]['metadata']['name']}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build recipe + ingredient indexes")
    parser.add_argument(
        "--recipe-dir",
        default=os.path.join(
            os.path.dirname(__file__), "..", "..",
            "Recipe Scraper", "woolworths_recipes",
        ),
        help="Directory containing recipe JSON files",
    )
    parser.add_argument(
        "--index-dir",
        default=INDEX_DIR,
        help="Output directory for .npz + .json index files",
    )
    parser.add_argument(
        "--skip-ingredients",
        action="store_true",
        help="Build only the recipe index (skip ingredient embedding)",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run a smoke search after building",
    )
    args = parser.parse_args()

    ok = build(args.recipe_dir, args.index_dir, args.skip_ingredients)
    if ok and args.test:
        test_search(args.index_dir)