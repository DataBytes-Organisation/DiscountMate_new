# Reference DuckDB + uv Silver Pipeline

This project is a local-first reference Silver pipeline for DiscountMate.

It demonstrates:

- `uv` for Python project management
- DuckDB for source normalization and shared Silver SQL transforms
- PostgreSQL as the Silver output target
- support for 4 retailer product samples:
  - `coles`
  - `woolworths`
  - `iga`
  - `aldi`

## Supported Retailers

Phase 1 currently supports the `products` runner for:

- `coles`
- `woolworths`
- `iga`
- `aldi`

## Silver Outputs

The pipeline writes 4 Silver tables:

- `silver.products_core`
  - standardized product identity and display fields for app/web joins
- `silver.product_pricing`
  - pricing and promotion facts for analytics and ML features
- `silver.product_availability`
  - stock and selling-constraint fields
- `silver.product_extended`
  - traceability and source-specific attributes

Each run refreshes only the matching `retailer + run_date` slice in PostgreSQL, so loading one retailer will not delete the others.

## What `run_date` Means

`--date` is stored as `run_date` in all Silver tables.

Use it as the batch slice for:

- safe delete-and-reload by `retailer + run_date`
- validating reruns
- querying multiple retailers for the same business date

## Local Setup

Create your local config first:

```bash
cp config/local.yaml.example config/local.yaml
```

Then update the PostgreSQL password in `config/local.yaml` to match your local Docker/Postgres setup.

Start PostgreSQL:

```bash
docker compose up -d
```

Install/update project dependencies locally:

```bash
uv sync
```

## Exact Run Commands

Run one retailer:

```bash
uv run main.py --source coles --runner products --date 2026-03-21 --config config/local.yaml
```

Run all current sample retailers:

```bash
uv run main.py --source coles --runner products --date 2026-03-21 --config config/local.yaml
uv run main.py --source woolworths --runner products --date 2026-03-21 --config config/local.yaml
uv run main.py --source iga --runner products --date 2026-03-21 --config config/local.yaml
uv run main.py --source aldi --runner products --date 2026-03-21 --config config/local.yaml
```

## CLI Args

- `--source`: retailer source
- `--runner`: pipeline type. Phase 1 supports only `products`
- `--date`: run date in `YYYY-MM-DD`
- `--config`: config file path

## Verify in pgAdmin

After running multiple retailers, verify they coexist with:

```sql
SELECT retailer, run_date, count(*)
FROM silver.products_core
GROUP BY retailer, run_date
ORDER BY run_date, retailer;
```

Check all 4 Silver tables:

```sql
SELECT retailer, run_date, count(*) FROM silver.products_core GROUP BY 1,2 ORDER BY 2,1;
SELECT retailer, run_date, count(*) FROM silver.product_pricing GROUP BY 1,2 ORDER BY 2,1;
SELECT retailer, run_date, count(*) FROM silver.product_availability GROUP BY 1,2 ORDER BY 2,1;
SELECT retailer, run_date, count(*) FROM silver.product_extended GROUP BY 1,2 ORDER BY 2,1;
```

Inspect rows directly:

```sql
SELECT * FROM silver.products_core LIMIT 20;
SELECT * FROM silver.product_pricing LIMIT 20;
SELECT * FROM silver.product_availability LIMIT 20;
SELECT * FROM silver.product_extended LIMIT 20;
```

## Local Bronze File Pattern

Configured in `config/local.yaml`:

- `data/local_bronze/coles/coles_sample_{date_compact}.csv`
- `data/local_bronze/woolworths/woolworths_sample_{date_compact}.csv`
- `data/local_bronze/iga/iga_sample_{date_compact}.csv`
- `data/local_bronze/aldi/aldi_sample_{date_compact}.csv`

Where `date_compact` means:

- `2026-03-21` -> `20260321`

## Config and Security

- `config/local.yaml` is local-only and should not be committed
- `config/local.yaml.example` is the safe template for teammates
- `config/deploy.yaml` is env-based and should not contain real secrets
- `data/` is local-only and should not be committed

## Docker and Deployment Shape

This repo includes:

- `docker-compose.yml` for local PostgreSQL
- `config/deploy.yaml` for env-based deployment config

The application config loader expands `${ENV_VAR}` values, so deployment config can be supplied through environment variables later.

Example Docker build:

```bash
docker build -t reference-duckdb-uv-pipeline .
```

Example container run:

```bash
docker run --rm \
  -e POSTGRES_HOST=host.docker.internal \
  -e POSTGRES_PORT=5433 \
  -e POSTGRES_DATABASE=discountmate \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e BRONZE_ROOT=data/local_bronze \
  reference-duckdb-uv-pipeline \
  python main.py --source coles --runner products --date 2026-03-21 --config config/deploy.yaml
```

## Notes

- Phase 1 is still local-Bronze focused
- the loader is now atomic per retailer/date run: all 4 Silver tables succeed or fail together
- the code is structured so VM or cloud scheduling can reuse the same CLI contract later

