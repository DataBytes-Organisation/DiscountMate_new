---
title: Ingestion Pipeline Tech Specs
sidebar_label: Tech Specs
sidebar_position: 1
---

# Ingestion Pipeline Tech Specs

`DE/ingestion-pipeline` is the unified scraper entrypoint for collecting product data from ALDI, Coles, IGA, Woolworths, and an example template source.

## What it does

The pipeline runs one source and one runner at a time. Each run creates a UTC `run_id`, configures logging and telemetry, executes the selected scraper, and persists the resulting records through the shared storage layer.

Supported source and runner combinations:

| Source | Runner | Command selector |
|---|---|---|
| ALDI | Products | `--source aldi --runner products` |
| Coles | Products | `--source coles --runner products` |
| IGA | Products | `--source iga --runner products` |
| Woolworths | Products | `--source ww --runner products` |
| Example | Products | `--source example --runner products` |

## Local setup

From `DE/ingestion-pipeline`:

```bash
uv sync
cp .env.example .env
```

Run a scraper:

```bash
uv run main.py --source aldi --runner products
uv run main.py --source coles --runner products
uv run main.py --source iga --runner products
uv run main.py --source ww --runner products
uv run main.py --source example --runner products
```

## Configuration

Settings are loaded from environment variables and `.env`.

| Area | Key variables | Notes |
|---|---|---|
| App output | `APP_OUTPUT_DIR`, `APP_DESTINATIONS`, `APP_LOG_LEVEL`, `APP_BRANDS_PATH` | `APP_DESTINATIONS` accepts `local`, `gcs`, or both as a comma-separated list. |
| GCS upload | `GCS_BUCKET`, `GCS_PREFIX`, `GOOGLE_APPLICATION_CREDENTIALS` | Required when `APP_DESTINATIONS` includes `gcs`. |
| Telemetry | `OTEL_ENABLED`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` | Telemetry is configured at startup. |
| ALDI | `ALDI_SITEMAP_URL`, `ALDI_API_URL`, `ALDI_PAGE_SIZE`, `ALDI_DELAY_SECONDS` | Uses the ALDI sitemap and product search API. |
| Coles | `COLES_COOKIE_STRING`, `COLES_SCRAPERAPI_KEY`, `COLES_PAGE_SIZE`, `COLES_MAX_PAGES` | Cookie and ScraperAPI settings help when direct requests are blocked. |
| IGA | `IGA_STORE_ID`, `IGA_SHOPPING_MODE_COOKIE`, `IGA_PAGE_SIZE` | `IGA_STORE_ID` controls the store context used in API requests. |
| Woolworths | `WW_COOKIE_STRING`, `WW_SCRAPERAPI_KEY`, `WW_PAGE_SIZE`, `WW_MAX_PAGES` | Cookie and ScraperAPI settings help when direct requests are blocked. |

## Output convention

Each run writes files under:

```text
.output/<source>/<runner>/<run_id>/
```

Artifacts per run:

| Artifact | Purpose |
|---|---|
| `<source>_products_<run_id>.jsonl` | Record-level output in JSON Lines format. |
| `<source>_products_<run_id>.csv` | Tabular output for ETL and manual inspection. |
| `<source>_manifest_<run_id>.json` | Run metadata, destinations, and uploaded URIs when applicable. |
| `<source>_run_<run_id>.log` | Run log for troubleshooting. |

When `APP_DESTINATIONS` includes `gcs`, the CSV artifact is uploaded to:

```text
GCS_PREFIX/<source>/<runner>/<source>_products_<run_id>.csv
```

## Container usage

Build the image from `DE/ingestion-pipeline`:

```bash
docker buildx build --platform linux/amd64 -t discount-mate-ingestion:latest .
```

Run a scraper in the container:

```bash
docker run --rm --env-file .env discount-mate-ingestion:latest --source ww --runner products
```

## Project structure

| Path | Purpose |
|---|---|
| `main.py` | CLI parsing, source dispatch, logging, telemetry, and storage orchestration. |
| `config/` | Environment-backed settings, logging, and telemetry setup. |
| `storage/` | Local and GCS artifact persistence. |
| `scraper/<source>/` | Source-specific scraper implementation. |
| `scraper/example/` | Template for adding new source/runner workflows. |
| `util/` | Runtime models and common helpers. |

## Adding a new scraper

1. Add a new `scraper/<source>/` package with a `run(context)` function that returns a `RunResult`.
2. Add source-specific settings in `config/settings.py` when the scraper needs environment configuration.
3. Register the source and runner in `main.py`.
4. Keep output records as simple dictionaries so the shared storage layer can materialize JSONL and CSV artifacts.
5. Run the existing quality checks before opening a pull request:

```bash
uvx ty check
uv run ruff check .
uv run ruff format --check .
```
