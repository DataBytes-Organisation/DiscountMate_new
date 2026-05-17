---
title: Data Engineering Overview
sidebar_label: Overview
sidebar_position: 1
---

# Data Engineering Overview

The Data Engineering projects move retailer product data from source websites into storage and warehouse tables that can be consumed by analytics, machine learning, and application teams.

## Platform flow

```text
Retailer websites
  -> DE/ingestion-pipeline
  -> Bronze files in local storage or Google Cloud Storage
  -> DE/etl-pipeline
  -> PostgreSQL silver schema
  -> downstream analytics, ML, and application features
```

## Projects

| Project | Purpose | Main output |
|---|---|---|
| `DE/ingestion-pipeline` | Scrapes product data from supported retailers and materializes run artifacts. | JSONL, CSV, manifest, and run log files. |
| `DE/etl-pipeline` | Loads Bronze product files, normalizes them through DuckDB, and syncs curated tables to PostgreSQL. | Tables in the PostgreSQL `silver` schema. |
| `discount-mate-infra` | Manages Google Cloud infrastructure with OpenTofu. | GCS buckets, Artifact Registry, Cloud Run services/jobs, Cloud Scheduler, Cloud SQL, and CI/CD identity. |

## Ownership boundaries

The ingestion pipeline is responsible for collecting source-shaped product files. It should not own warehouse schema decisions beyond producing consistent files and metadata.

The ETL pipeline is responsible for schema mapping, validation, deduplication, and loading into silver tables. It should not contain scraper-specific HTTP logic.

The infrastructure project is responsible for deployed cloud resources and environment wiring. Runtime application changes should stay in the relevant application project.

## Common prerequisites

- Python 3.12+
- `uv`
- Docker for container builds and local PostgreSQL
- Google Cloud credentials for deployed or GCS-backed workflows
- OpenTofu for infrastructure changes

## Related pages

- [Ingestion Pipeline Tech Specs](./Ingestion Pipeline/tech-specs.md)
- [ETL Pipeline Tech Specs](./ETL Pipeline/tech-specs.md)
- [Silver Layer](./ETL Pipeline/silver-layer.md)
- [Discount Mate Infrastructure](./Infrastructure/discount-mate-infra.md)
