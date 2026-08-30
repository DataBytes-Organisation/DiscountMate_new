---
title: ETL Pipeline Tech Specs
sidebar_label: Tech Specs
sidebar_position: 1
---

# ETL Pipeline Tech Specs

`DE/etl-pipeline` is the reusable ETL framework for transforming Bronze product files into curated PostgreSQL silver tables. It uses DuckDB for file reads and transformation work, PostgreSQL for persisted warehouse tables, and Alembic for migrations.

## Current capabilities

The pipeline is designed around model selectors.

| Model | Status | Notes |
|---|---|---|
| `example` | Runnable demo | Reads a Coles-shaped sample file and writes `silver.demo_product_pricing_summary`. |
| `products_coles` | Runnable | Normalizes Coles Bronze files and syncs product and price tables. |
| `products_iga` | Runnable | Normalizes IGA Bronze files and syncs product and price tables. |
| `products_aldi` | Scaffold only | Raises `NotImplementedError` until the retailer workflow is implemented. |
| `products_woolworths` | Scaffold only | Raises `NotImplementedError` until the retailer workflow is implemented. |

## Local setup

From `DE/etl-pipeline`:

```bash
uv sync
cp .env.example .env
cp config/config.yaml.example config/config.yaml
docker compose up -d
```

DuckDB needs writable runtime directories, especially in sandboxed or containerized environments:

```bash
export DUCKDB_HOME_DIRECTORY=/tmp/discountmate-duckdb/home
export DUCKDB_EXTENSION_DIRECTORY=/tmp/discountmate-duckdb/extensions
```

Apply database migrations:

```bash
uv run alembic upgrade head
```

## Runtime configuration

The app loads runtime model paths from YAML. Configuration can be provided in either form:

| Option | Behavior |
|---|---|
| `APP_CONFIG_BASE64` | Base64-encoded YAML content. Takes priority when set. |
| `APP_CONFIG_PATH` | Filesystem path to YAML config. Used when `APP_CONFIG_BASE64` is empty. |

The default template uses this shape:

```yaml
mode: local

paths:
  bronze_root: data/local_bronze

models:
  products_coles:
    products: "{bronze_root}/coles/coles_products_{date_compact}*.csv"
```

For GCS-backed Bronze files, set `paths.bronze_root` to a `gs://...` prefix and provide DuckDB HMAC credentials:

```bash
export GCS_KEY_ID=your_gcs_hmac_key_id
export GCS_SECRET=your_gcs_hmac_secret
```

## Running jobs

Run the example workflow:

```bash
uv run main.py --model example --start-date 2026-03-21 --end-date 2026-03-25
```

Run a retailer workflow:

```bash
uv run main.py --model products_coles --start-date 2026-04-01 --end-date 2026-04-25
uv run main.py --model products_iga --start-date 2026-04-01 --end-date 2026-04-25
```

Date handling:

| Argument | Behavior |
|---|---|
| `--start-date` | Inclusive start date in `YYYY-MM-DD` format. Defaults to the last 7 days including today. |
| `--end-date` | Inclusive end date in `YYYY-MM-DD` format. Defaults to today. |

Missing daily files are skipped and reported in the job summary.

## Processing flow

```text
Resolve date range
  -> resolve matching Bronze files
  -> load source CSV files into DuckDB
  -> normalize source-shaped rows
  -> attach PostgreSQL through DuckDB
  -> sync silver dimension and fact tables
```

The example workflow also runs a QA SQL check before persisting the demo summary table.

## Migrations

Apply the current schema:

```bash
uv run alembic upgrade head
```

Create a new migration:

```bash
uv run alembic revision -m "describe change"
```

The current migrations create the `silver` schema, seed core retailer and category rows, create product price warehouse tables, and add prediction fields to `silver.dim_products`.

## Container usage

Build the image from `DE/etl-pipeline`:

```bash
docker buildx build --platform linux/amd64 -t discount-mate-etl:latest .
```

Run the container with local config and data mounted:

```bash
docker run --rm \
  --env-file .env \
  -v "$(pwd)/config/config.yaml:/app/config/config.yaml:ro" \
  -v "$(pwd)/data:/app/data:ro" \
  discount-mate-etl:latest \
  --model example --start-date 2026-03-21 --end-date 2026-03-25
```

## Project structure

| Path | Purpose |
|---|---|
| `main.py` | CLI entrypoint and model dispatch. |
| `config/` | Environment settings and runtime YAML config loading. |
| `common/` | Shared CLI, path resolution, DuckDB, and PostgreSQL helpers. |
| `features/example/` | Working demo workflow. |
| `features/products/<retailer>/` | Retailer-specific product workflows. |
| `migrations/` | Alembic migration files for PostgreSQL. |

## What not to commit

Do not commit local runtime state or secrets:

- `.env`
- `config/config.yaml`
- `data/`
- `.venv/`

Commit the templates instead:

- `.env.example`
- `config/config.yaml.example`
- `config/deploy.yaml.example`
