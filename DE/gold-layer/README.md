# Discount Mate - Gold Layer

This dbt project manages the business-facing gold layer in PostgreSQL. It
transforms the `silver` tables maintained by `../etl-pipeline` into documented,
tested views for reporting and analytics.

## Project structure

```text
models/
├── sources/          # declarations for ETL-managed silver tables
└── marts/            # business-facing gold views grouped by subject area
tests/                # cross-model and business-grain data tests
selectors.yml         # reusable dbt resource selections
dbt_project.yml       # project paths and default model configuration
profiles.yml          # environment-backed PostgreSQL connection
```

All models are configured as views and are created in the target `gold` schema
by default. Source declarations belong under `models/sources/`; gold models and
their documentation belong under `models/marts/`.

## Setup

Install the project dependencies:

```bash
uv sync
```

Reuse the PostgreSQL settings from the ETL pipeline. dbt does not load `.env`
files automatically.

```bash
set -a
source ../etl-pipeline/.env
set +a
uv run dbt debug --profiles-dir .
```

## Configuration

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DATABASE`, `POSTGRES_USER`, and
  `POSTGRES_PASSWORD` configure the shared PostgreSQL connection.
- `POSTGRES_SCHEMA` identifies the source schema and defaults to `silver`.
- `DBT_TARGET_SCHEMA` identifies the output schema and defaults to `gold`.

The database user must be able to read the source schema and create views in the
target schema. Credentials must remain in environment variables and must not be
committed.

## Common commands

Validate project configuration and connectivity:

```bash
uv run dbt debug --profiles-dir .
```

Parse the project without building relations:

```bash
uv run dbt parse --profiles-dir .
```

Build and test the complete gold layer:

```bash
uv run dbt build --profiles-dir .
```

Build a configured selector:

```bash
uv run dbt build --selector <selector_name> --profiles-dir .
```

## Development conventions

- Declare silver inputs with dbt `source()` definitions.
- Organize marts by business subject area and use `ref()` for model dependencies.
- Keep model descriptions and column tests alongside their models in YAML files.
- Add singular data tests under `tests/` for business rules spanning columns or
  models.
- Keep every gold model materialized as a PostgreSQL view unless the project
  requirements are explicitly changed.
