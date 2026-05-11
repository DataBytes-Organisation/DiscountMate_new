# Discount Mate - Ingestion Pipeline

Unified scraper entrypoint for ALDI, Coles, IGA, Woolworths, and an example template source.

# Prerequisite
- Python 3.12+
- uv
- docker

## Getting started

Install dependencies
```bash
uv sync
```

Load env in `.env`, 
```bash
cp .env.example .env
```

then run:
```bash
uv run main.py --source aldi --runner products
uv run main.py --source coles --runner products
uv run main.py --source iga --runner products
uv run main.py --source ww --runner products
uv run main.py --source example --runner products
```

## Output Convention

Each run writes to:

```text
.output/<source>/<runner>/<run_id>/
```

Artifacts per run:

- `<source>_products_<run_id>.jsonl`
- `<source>_products_<run_id>.csv`
- `<source>_manifest_<run_id>.json`
- `<source>_run_<run_id>.log`

When `APP_DESTINATIONS` includes `gcs`, only the CSV artifact is uploaded to `GCS_PREFIX/<source>/<runner>/<source>_products_<run_id>.csv`.

## Container Build

Build the image with `docker buildx`:

```bash
docker buildx build --platform linux/amd64 -t discount-mate-ingestion:latest .
```

Run the container locally:

```bash
docker run --rm --env-file .env discount-mate-ingestion:latest --source ww --runner products
```

## Structure

- `main.py`: CLI entrypoint and source/runner dispatch
- `config/`: env-backed settings, logging, and telemetry setup
- `storage/`: shared file serialization and destination uploads
- `scraper/<source>/*_scraper.py`: source-specific fetch and transform logic with a single `run()` entrypoint
- `util/`: shared runtime models and common helpers
- `scraper/example/`: template for new sources/runners
