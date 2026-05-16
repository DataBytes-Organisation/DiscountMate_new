# Discount Mate - ETL Pipeline

DuckDB-first ETL pipeline for loading retailer product data into the PostgreSQL `silver` layer.

This repo now contains:

- one generic example workflow for starter/reference use
- one implemented retailer workflow for Aldi product pricing
- PostgreSQL migrations for the current `silver` warehouse tables

The Aldi workflow reads raw Aldi Bronze CSV data, enriches it with conservative GTIN matching from `silver.static_master_coles_products`, and syncs the results into:

- `silver.dim_categories`
- `silver.dim_retailers`
- `silver.dim_products`
- `silver.fct_product_prices`

# Prerequisite

- Python 3.12+
- uv
- docker

## Getting started

Install dependencies:

```bash
uv sync
```

Load env and config templates:

```bash
cp .env.example .env
cp config/config.yaml.example config/config.yaml
```

Runtime config can be provided in either of two ways:

- `APP_CONFIG_BASE64`: base64-encoded contents of `config.yaml`. If this is set, it takes priority.
- `APP_CONFIG_PATH`: filesystem path to the YAML config. This is used only when `APP_CONFIG_BASE64` is empty.

If `APP_CONFIG_BASE64` is present but cannot be base64-decoded, UTF-8 decoded, or parsed as YAML, the app raises an exception and stops.

Start PostgreSQL:

```bash
docker compose up -d
```

DuckDB now mediates ETL reads and writes to PostgreSQL at runtime. Keep the
DuckDB runtime directories writable, especially when running in sandboxes:

```bash
export DUCKDB_HOME_DIRECTORY=/tmp/discountmate-duckdb/home
export DUCKDB_EXTENSION_DIRECTORY=/tmp/discountmate-duckdb/extensions
```

If Bronze files live in Google Cloud Storage, also provide GCS HMAC credentials
for DuckDB's `httpfs` extension:

```bash
export GCS_KEY_ID=your_gcs_hmac_key_id
export GCS_SECRET=your_gcs_hmac_secret
```

Apply migrations:

```bash
uv run alembic upgrade head
```

## Run the example workflow

Retailer selectors use the format `products_<retailer>`, for example `products_aldi`.

The example workflow stays generic on purpose:

- it reads a Coles-shaped sample CSV from `config/config.yaml`
- it writes output under `retailer='example'`
- it is meant to demonstrate the starter framework, not the final retailer job layout

```bash
uv run main.py --model example --start-date 2026-03-21 --end-date 2026-03-25
```

The run will process every available date from `--start-date` through the inclusive `--end-date`. If `--start-date` is omitted, it defaults to the last 7 days including today. If `--end-date` is omitted, the range runs through today. Missing daily files are skipped with logging.

Retailer workflows stage Bronze data in DuckDB first, then attach PostgreSQL
through DuckDB for the final silver-table sync. Bronze inputs can come from:

- local paths under `data/local_bronze`
- `gs://...` prefixes configured through `paths.bronze_root`

## Run the Aldi workflow

The implemented retailer workflow is `products_aldi`.

It uses:

- Aldi Bronze product files for the requested run dates
- glob matching for Aldi files with timestamp suffixes
- `silver.static_master_coles_products` as the GTIN reference source

Runtime paths are configured in `config/config.yaml`:

```yaml
models:
  products_aldi:
    products: "{bronze_root}/aldi/aldi_all_products_{date_compact}*.csv"
```

Run Aldi for one day:

```bash
uv run main.py --model products_aldi --start-date 2026-04-19 --end-date 2026-04-19
```

How the Aldi pipeline works:

1. Resolve matching Aldi Bronze files from `config/config.yaml`.
2. Load the CSVs into DuckDB as `raw_input`.
3. Attach PostgreSQL through DuckDB.
4. Transform raw Aldi data into `raw_input_normalized`.
5. Apply conservative GTIN matching against `silver.static_master_coles_products`.
6. Sync into `silver.dim_products` and `silver.fct_product_prices`.

The current Aldi implementation is intentionally conservative:

- brand equality is a hard gate for GTIN matching
- size and pack conflicts block GTIN assignment
- fuzzy matching is only used after size or pack agreement

## Output convention

Current PostgreSQL outputs:

- `silver.demo_product_pricing_summary`
- `silver.dim_categories`
- `silver.dim_retailers`
- `silver.dim_products`
- `silver.fct_product_prices`

The demo summary is grouped by:

- `retailer`
- `run_date`
- `category`

and includes simple pricing and coverage metrics.

For the Aldi workflow:

- `silver.dim_products` stores the product identity, pack metadata, GTIN when safely matched, and current/last-week retailer price columns
- `silver.fct_product_prices` stores one snapshot row per `product_id`, `retailer_id`, and `recorded_at`
- `silver.dim_categories` and `silver.dim_retailers` are seeded reference tables used during upsert

`silver.dim_retailers` is seeded by Alembic with 4 retailer rows:

- Coles
- Woolworths
- IGA
- Aldi

## Verify in pgAdmin

```sql
SELECT retailer, run_date, category, product_count, avg_current_price
FROM silver.demo_product_pricing_summary
ORDER BY run_date, retailer, category
LIMIT 50;
```

```sql
SELECT retailer_name, website_url
FROM silver.dim_retailers
ORDER BY retailer_name;
```

```sql
SELECT p.product_name, p.brand_name, p.gtin, f.recorded_at, f.price
FROM silver.fct_product_prices f
JOIN silver.dim_products p ON p.id = f.product_id
JOIN silver.dim_retailers r ON r.id = f.retailer_id
WHERE r.retailer_name = 'Aldi'
ORDER BY f.recorded_at DESC, p.product_name
LIMIT 50;
```

## Migration workflow

Apply the current schema:

```bash
uv run alembic upgrade head
```

Create a new migration later:

```bash
uv run alembic revision -m "describe change"
```

## Structure

- `main.py`: thin CLI entrypoint and workflow dispatch
- `config/`: env-backed settings and runtime config templates
- `common/`: shared CLI, path, DuckDB, normalization, and PostgreSQL helpers
- `features/example/`: one working example workflow
- `features/products/aldi/`: implemented Aldi job plus workflow SQL for normalize, QA, and silver upsert
- `features/products/<retailer>/job.py`: retailer jobs, with Aldi implemented and others available for later expansion
- `migrations/`: Alembic migration files

## Container build

Build the image:

```bash
docker buildx build --platform linux/amd64 -t discount-mate-etl:latest .
```

Run the container locally:

```bash
docker run --rm \
  --env-file .env \
  -v "$(pwd)/config/config.yaml:/app/config/config.yaml:ro" \
  -v "$(pwd)/data:/app/data:ro" \
  discount-mate-etl:latest \
  --model products_aldi --start-date 2026-04-19 --end-date 2026-04-19
```

The runtime config and local sample CSV files are mounted because they are kept out of the image on purpose.

For GCS-backed Bronze inputs, set `paths.bronze_root` to a `gs://bucket/prefix`
value in `config/config.yaml` and provide `GCS_KEY_ID` / `GCS_SECRET`.

## Config and secrets

Commit:

- `.env.example`
- `config/config.yaml.example`
- `config/deploy.yaml.example`

Do not commit:

- `.env`
- `config/config.yaml`
- `data/`
- `.venv/`

## Notes

- `example` is still useful as a starter workflow, but `products_aldi` is the implemented retailer pipeline in this repo
- Aldi GTIN matching uses `silver.static_master_coles_products` as a reference source and optimizes for precision over recall
- retailer `job.py` files under `features/products/` other than Aldi remain expansion points
- local Bronze sample data is kept local
- deployment, CI/CD, and the final warehouse schema are out of scope for this refactor
