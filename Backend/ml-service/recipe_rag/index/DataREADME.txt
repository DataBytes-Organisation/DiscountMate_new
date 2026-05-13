# RAG Index Files

This folder holds the embedding artefacts loaded by `rag_pipeline.py`
at Flask startup. **The actual files are not committed to git** because
they're large (~240 MB total) and regenerable.

## Expected files

| File | Size | Source |
|------|------|--------|
| `recipe_index.npz` | ~38 MB | `python build_recipe_index.py` |
| `recipe_metadata.json` | ~34 MB | `python build_recipe_index.py` |
| `ingredient_index.npz` | ~160 MB | `python product_embedder.py` (ingredient mode) |
| `ingredient_metadata.json` | ~5 MB | `python product_embedder.py` (ingredient mode) |
| `product_index.npz` | ~42 MB | `python product_embedder.py` (product mode) |
| `product_metadata.json` | ~2 MB | `python product_embedder.py` (product mode) |

## Local setup

For now, request a copy of the prebuilt files from the RAG pipeline
maintainer and drop them into this folder.

## Deployment plan (TODO)

These files will be migrated to the team's existing GCS bucket
(`gs://discountmate-ml-models/recipe_rag/`) following the same
download-on-startup pattern used by `reverse_image_search/`.