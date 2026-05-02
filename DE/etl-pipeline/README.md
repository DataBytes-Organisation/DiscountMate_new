# Discount Mate - ETL Pipeline

DuckDB-first ETL pipeline for loading retailer product data into the PostgreSQL `silver` layer.

This repo now contains:

- one generic example workflow for starter/reference use
- one implemented retailer workflow for Aldi product pricing
- PostgreSQL migrations for the current `silver` warehouse tables

The Aldi workflow reads raw Aldi Bronze CSV data, enriches it with conservative GTIN matching from a Coles master file, runs QA checks, and upserts the results into:

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

Start PostgreSQL:

```bash
docker compose up -d
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

The run will process every available date from `--start-date` through the inclusive `--end-date`. If `--end-date` is omitted, the range runs through today. Missing daily files are skipped with logging.

## Run the Aldi workflow

The implemented retailer workflow is `products_aldi`.

It uses:

- an Aldi Bronze product file for the run date
- a same-day filename fallback glob for Aldi files with timestamp suffixes
- a Coles master CSV as the GTIN reference source

Runtime paths are configured in `config/config.yaml`:

```yaml
models:
  products_aldi:
    products: "{bronze_root}/aldi/aldi_all_products_{date_compact}.csv"
    products_glob: "{bronze_root}/aldi/aldi_all_products_{date_compact}*.csv"
    coles_master: "{bronze_root}/coles/Master_Coles_Scrape.csv"
```

Run Aldi for one day:

```bash
uv run main.py --model products_aldi --start-date 2026-04-19 --end-date 2026-04-19
```

How the Aldi pipeline works:

1. Resolve the Aldi Bronze file and Coles master file from `config/config.yaml`.
2. Load both CSVs into DuckDB.
3. Transform raw Aldi data into `aldi_silver_stage`.
4. Apply conservative GTIN matching against Coles master.
5. Run SQL QA checks. The job stops if QA fails.
6. Load the stage rows into a temporary Postgres table.
7. Upsert into `silver.dim_products` and `silver.fct_product_prices`.

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
- Aldi GTIN matching uses Coles master as a reference source and optimizes for precision over recall
- retailer `job.py` files under `features/products/` other than Aldi remain expansion points
- local Bronze sample data is kept local
- deployment, CI/CD, and the final warehouse schema are out of scope for this refactor
