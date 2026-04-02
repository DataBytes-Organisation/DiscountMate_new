# Discount Mate - ETL Pipeline

Reusable ETL framework for the DE team to load retailer product data, transform it with DuckDB, and save a simple demo output into PostgreSQL.

This refactor is intentionally scoped to:

- `DE-03-T1`: initialize a clean DuckDB ETL workflow
- `DE-03-T2`: initialize PostgreSQL and set up migration workflow

It is **not** the final warehouse model yet. The current database target is one temporary demo table that proves the framework works. Future schema design will evolve into tables such as:

- `fct_product_pricing`
- `dim_products`
- `dim_retailers`

## Supported Sources

Phase 1 supports the `products` runner for:

- `coles`
- `woolworths`
- `iga`
- `aldi`

## Project Structure

- `main.py`: thin CLI entrypoint and runner dispatch
- `config/`: typed settings and config templates
- `common/`: reusable CLI, DB, path, and DuckDB helpers
- `features/products/`: source normalization, ETL orchestration, and SQL assets
- `migrations/`: Alembic migration files

## Local Setup

Install dependencies:

```bash
uv sync
```

Create local config files:

```bash
cp .env.example .env
cp config/local.yaml.example config/local.yaml
```

Start PostgreSQL:

```bash
docker compose up -d
```

Apply migrations:

```bash
uv run alembic upgrade head
```

## Run the Demo ETL

```bash
uv run main.py --source coles --runner products --date 2026-03-21 --config config/local.yaml
uv run main.py --source woolworths --runner products --date 2026-03-21 --config config/local.yaml
uv run main.py --source iga --runner products --date 2026-03-21 --config config/local.yaml
uv run main.py --source aldi --runner products --date 2026-01-31 --config config/local.yaml
```

Each run:

- reads one retailer source file
- normalizes the source into a common DuckDB shape
- runs a simple grouped transform
- loads one retailer/date slice into PostgreSQL

## Demo Output

The temporary demo table is:

- `silver.demo_product_pricing_summary`

It is grouped by:

- `retailer`
- `run_date`
- `category`

and includes simple metrics like:

- product count
- priced product count
- average current price
- min/max current price
- discounted product count

## Verify in pgAdmin

```sql
SELECT retailer, run_date, category, product_count, avg_current_price
FROM silver.demo_product_pricing_summary
ORDER BY run_date, retailer, category
LIMIT 50;
```

Check retailer coverage:

```sql
SELECT retailer, run_date, count(*)
FROM silver.demo_product_pricing_summary
GROUP BY retailer, run_date
ORDER BY run_date, retailer;
```

## Migration Workflow

Apply the current schema:

```bash
uv run alembic upgrade head
```

Create a new migration later:

```bash
uv run alembic revision -m "describe change"
```

## Config and Secrets

Commit:

- `.env.example`
- `config/local.yaml.example`
- `config/deploy.yaml`

Do not commit:

- `.env`
- `config/local.yaml`
- `data/`
- `.venv/`

## Notes

- `config/deploy.yaml` is a template only
- local Bronze sample data is kept local
- deployment, CI/CD, and final warehouse schema are out of scope for this refactor
