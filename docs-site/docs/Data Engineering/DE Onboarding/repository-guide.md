---
title: Repository Guide (Data Engineering)
sidebar_label: Repository Guide
sidebar_position: 3
---

# Repository Guide

**Lost trying to find something?** This page maps where the Data Engineering code and docs live
in the GitHub repo, so you don't have to hunt.

:::tip Need help with forking, syncs, commit messages, or opening a draft PR for this repository? 
Check out our **[GitHub Guidelines](https://deakin365-my.sharepoint.com/personal/s225113285_deakin_edu_au/_layouts/15/Doc.aspx?sourcedoc=%7BD7C822EA-00E4-4206-A8D5-FEAAE8D6D7C9%7D&file=Github%20Guidelines.docx&action=default&mobileredirect=true&DefaultItemOpen=1)** for a full walkthrough with screenshots. 
Use this whenever you're starting a new feature, making local commits, or getting ready to open a Pull Request for the team to review.
:::

## Where DE code lives

| Path | What's here | Open in GitHub |
|---|---|---|
| `DE/etl-pipeline/` | **Silver ETL** - loads Bronze files, transforms via DuckDB, syncs curated tables to PostgreSQL. | [↗](https://github.com/DataBytes-Organisation/DiscountMate_new/tree/main/DE/etl-pipeline) |
| `DE/etl-pipeline/features/products/<retailer>/` | Per-retailer job (`job.py`) + `workflow_sql/`. `<retailer>` = `aldi`, `iga`, `coles`, `woolworths`. | [↗](https://github.com/DataBytes-Organisation/DiscountMate_new/tree/main/DE/etl-pipeline/features/products) |
| `DE/etl-pipeline/features/products/<retailer>/workflow_sql/` | The SQL that does the work: `transform.sql`, `sync_dim_products.sql`, `sync_fct_product_prices.sql`. | [↗](https://github.com/DataBytes-Organisation/DiscountMate_new/tree/main/DE/etl-pipeline/features/products) |
| `DE/etl-pipeline/common/` | Shared helpers: CLI, DuckDB utils, Postgres attach, path resolution. | [↗](https://github.com/DataBytes-Organisation/DiscountMate_new/tree/main/DE/etl-pipeline/common) |
| `DE/etl-pipeline/migrations/` | Alembic database migrations (the `silver` schema definition + seeds). | [↗](https://github.com/DataBytes-Organisation/DiscountMate_new/tree/main/DE/etl-pipeline/migrations) |
| `DE/etl-pipeline/config/` | Runtime config templates (`config.yaml.example`, `.env.example`). | [↗](https://github.com/DataBytes-Organisation/DiscountMate_new/tree/main/DE/etl-pipeline/config) |
| `DE/etl-pipeline/main.py` | CLI entry point (`uv run main.py --model products_<retailer> …`). | [↗](https://github.com/DataBytes-Organisation/DiscountMate_new/tree/main/DE/etl-pipeline/main.py) |
| `DE/ingestion-pipeline/` | **Bronze scrapers** - collect raw product files per retailer. | [↗](https://github.com/DataBytes-Organisation/DiscountMate_new/tree/main/DE/ingestion-pipeline) |
| `discount-mate-infra/` | Cloud infrastructure (OpenTofu): GCS, Cloud Run, Cloud Scheduler, Cloud SQL, CI/CD. | [↗](https://github.com/DataBytes-Organisation/DiscountMate_new/tree/main/discount-mate-infra) |
| `docs-site/docs/Data Engineering/` | Docusaurus docs for these pages | [↗](https://github.com/DataBytes-Organisation/DiscountMate_new/tree/main/docs-site/docs/Data%20Engineering) ||

## Repo root

- **Main repository:** [DataBytes-Organisation/DiscountMate_new](https://github.com/DataBytes-Organisation/DiscountMate_new)

**Page last modified:** 19/09/2026 (Margie Licup)
