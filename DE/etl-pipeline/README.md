# Discount Mate - ETL Pipeline

Reusable ETL starter framework for the DE team to copy when building later retailer workflows.

This phase is intentionally scoped to:

- `DE-03-T1`: initialize a clean DuckDB ETL workflow
- `DE-03-T2`: initialize PostgreSQL and set up migration workflow

It is **not** the final warehouse model yet. The current database target is one temporary demo summary table plus a seeded `dim_retailers` reference table. The later warehouse design will evolve into tables such as:

- `fct_product_pricing`
- `dim_products`
- `dim_retailers`

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

The working example is exposed only through `--model example`. The retailer models remain scaffold placeholders for future implementation.

Retailer selectors now use the composite format `products_<retailer>`, for example `products_aldi`.

The example stays generic on purpose:

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

## Output convention

Current PostgreSQL outputs:

- `silver.demo_product_pricing_summary`
- `silver.dim_retailers`

The demo summary is grouped by:

- `retailer`
- `run_date`
- `category`

and includes simple pricing and coverage metrics.

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
SELECT store_chain, store_name
FROM silver.dim_retailers
ORDER BY store_chain;
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
- `features/products/<retailer>/job.py`: scaffold jobs for teammates to imitate later
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
  --model example --start-date 2026-03-21 --end-date 2026-03-25
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

- Only the example workflow is implemented in this phase
- retailer `job.py` files under `features/products/` are scaffolds only
- local Bronze sample data is kept local
- deployment, CI/CD, and the final warehouse schema are out of scope for this refactor
