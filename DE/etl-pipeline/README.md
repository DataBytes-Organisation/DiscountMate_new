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

Start PostgreSQL:

```bash
docker compose up -d
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

The run will process every available date from `--start-date` through the inclusive `--end-date`. If `--end-date` is omitted, the range runs through today. Missing daily files are skipped with logging.

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
