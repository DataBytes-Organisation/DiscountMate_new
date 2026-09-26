---
title: Troubleshooting
sidebar_label: Troubleshooting
sidebar_position: 6
---

# Troubleshooting

Common errors when setting up or running the DE pipeline, and how to fix them. These are the
issues most people actually hit. Make sure to check here before asking.

## Setup & environment

| Symptom | Likely cause | Fix |
|---|---|---|
| `alembic upgrade head` hangs or errors on connection | PostgreSQL isn't ready yet, or `.env` points at a different database than Docker started. | Wait until `docker compose ps` shows **healthy**, then confirm `.env` host/port/db/user match `docker-compose.yml` (defaults: `127.0.0.1:5433`, db `discountmate`). |
| "cannot connect to the Docker daemon" / pipe error | Docker Desktop isn't running. | Start Docker Desktop, wait for it to finish loading, re-run. |
| DuckDB fails to load an extension / permission error | DuckDB runtime directories aren't set or aren't writable. | `export DUCKDB_HOME_DIRECTORY=/tmp/discountmate-duckdb/home` and `DUCKDB_EXTENSION_DIRECTORY=/tmp/discountmate-duckdb/extensions`, then re-run. |
| `uv` or `python` "not recognized" | Missing prerequisite. | Install Python 3.12+ and `uv`; re-open the terminal. |

## Running a workflow

| Symptom | Likely cause | Fix |
|---|---|---|
| Run "completes successfully" but processes **0 rows** (`skipped_dates`, `raw_input_rows=0`) | The Bronze file name doesn't match the config glob for that date, so the job found no file. | Check `config/config.yaml` for the retailer's `products:` pattern and make the filename/date match (e.g. `iga_sample_20260406.csv`). |
| `Binder Error: Referenced column "…" not found in FROM clause` | **Schema drift** — the transform references a source column that doesn't exist in the real Bronze file. | Dump the file's real columns and prune/align the transform's column references. See the [matching docs](./ETL Pipeline/Product Matching & Deduplication/limitations.md). |
| Jinja `'…_table' is undefined` when rendering SQL | A `.sql` file references a `{{ placeholder }}` not provided by the job's render context. | Add the placeholder to the job's `_workflow_sql_context()`, or you're running the wrong retailer's SQL. |

## Loading / merging

| Symptom | Likely cause | Fix |
|---|---|---|
| `duplicate key value violates unique constraint "uq_dim_products_gtin"` | Two products resolved to the same barcode. | This is the matching logic's conflict guard working - investigate the GTIN backfill; a duplicate GTIN should never be written. |
| `duplicate key value violates unique constraint "uq_dim_products_canonical_key"` on a **re-run** | The canonical-key-vs-index divergence on a product with no pack size. | Known limitation - see [Limitations](./ETL Pipeline/Product Matching & Deduplication/limitations.md). The load rolls back safely; the fix is a persisted canonical-key column (DB migration). |
| Row count roughly doubles on a second identical load | Identity resolution isn't matching existing products (would be a real bug). | Confirm you're on the current transform; check the GTIN/canonical match steps. Idempotent behaviour = count unchanged. |

## Docs site build

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm run build` fails with "Broken link" | A relative/internal link points at a page that doesn't exist. | Fix the link. The build throws on **any** broken internal link (`onBrokenLinks: 'throw'`). Preview locally with `npm start` and always run `npm run build` before pushing. |
| A downloadable file 404s | Static file path wrong, or file not in `static/`. | Ensure the file is in `docs-site/static/files/` and linked via `pathname:///files/<name>`. |

:::tip Still stuck?
Check the [Repository Guide](./repository-guide.md) to find the relevant code, or ask a DE lead.
:::

**Page last modified:** 19/09/2026 (Margie Licup)
