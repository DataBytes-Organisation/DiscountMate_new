---
title: Glossary
sidebar_label: Glossary
sidebar_position: 5
---

# Glossary

Quick reference for the terms and tools used across Data Engineering. Bookmark this page.

## Concepts

| Term | Meaning |
|---|---|
| **Medallion architecture** | The layered data design: **Bronze** (raw) → **Silver** (cleaned/curated) → **Gold** (aggregated for analytics). |
| **Bronze layer** | Raw, as-scraped product files, one per retailer run. Produced by the ingestion pipeline. |
| **Silver layer** | Cleaned, standardised, cross-retailer product data in the PostgreSQL `silver` schema. Most DE work happens here. |
| **Gold layer** | Aggregated, analytics-ready tables built on top of Silver for the ML and Data Analysis teams (planned). |
| **GTIN** | Global Trade Item Number: a product's barcode. The strongest signal for matching the same product across retailers. |
| **Canonical product** | The single agreed record for one physical product, stored once in `silver.dim_products`. |
| **Canonical key** | A `brand \| core-name \| pack-quantity \| pack-unit` identity string used to match products that have no barcode. |
| **Deduplication (dedup)** | Collapsing repeat rows for the same product into one canonical record. |
| **Identity resolution** | Recognising that a newly scraped product is an existing canonical product (rather than inserting a new one). |
| **Idempotency** | A property where re-running the same load produces no duplicates or changes - a key correctness test. |
| **UOM** | Unit of measure. Allowed values in the warehouse: `g, kg, ml, l, ea, pack, m`. |
| **Fact / dimension** | Warehouse modelling terms: a **fact** table stores events (price observations); a **dimension** stores entities (products, retailers, categories). |

## Tools & tech

| Tool | What it is / why we use it |
|---|---|
| **DuckDB** | In-process analytical database. The ETL loads and transforms Bronze data in DuckDB before syncing to PostgreSQL. |
| **PostgreSQL** | The warehouse database that holds the `silver` schema. |
| **MERGE** | A SQL statement that inserts-or-updates in one operation. Used to upsert products and prices. |
| **Alembic** | Database migration tool. Defines and versions the `silver` schema (`migrations/`). |
| **`uv`** | Fast Python package/dependency manager used to install and run the pipeline (`uv sync`, `uv run …`). |
| **Docker / Docker Compose** | Runs the local PostgreSQL container the pipeline connects to. |
| **OpenTofu** | Infrastructure-as-code tool used by `discount-mate-infra` to manage Google Cloud resources. |
| **GCS (Google Cloud Storage)** | Where Bronze files can live in the cloud (as an alternative to local storage). |
| **Cloud Scheduler / Cloud Run** | GCP services used to automate and run the pipelines on a schedule (deployment work). |

## Retailer quirks (matching)

| Retailer | Note |
|---|---|
| **IGA** | Has native barcodes; source columns are prefixed `iga_*`. |
| **Aldi** | **No barcodes**: GTINs are backfilled from the Coles reference table via fuzzy matching. |
| **Coles** | Also the **GTIN reference source** (`static_master_coles_products`) other retailers match against. |
| **Woolworths** | Scraper repair in progress; matching not yet validated. |

**Page last modified:** 19/09/2026 (Margie Licup)