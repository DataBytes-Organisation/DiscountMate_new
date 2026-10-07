---
title: Data Engineering Overview
sidebar_label: Overview
sidebar_position: 1
---

# Data Engineering Overview

The Data Engineering (DE) team moves retailer product data from source websites into
warehouse tables that the Analytics, Machine Learning, and Application teams can use.

:::tip New here? Start with the [**Project Onboarding**](/into.md) guide first. 
This covers the general project setup, including the tools and repository setup needed by all team members.
:::

# 1. Quick Start & Onboarding

### Local Prerequisites
Make sure you have these tools installed before starting local development:
* **Python 3.12+**
* **`uv`** (Python package installer)
* **Docker** (for local PostgreSQL database & container builds)
* **Google Cloud CLI & Credentials** (for GCS-backed workflows)
* **OpenTofu** (if working on infrastructure updates)

### Task Boards & Sprint Planning
Find active tasks, sprint cards, and sub-tasks on Microsoft Planner:

| Board | Purpose |
|---|---|
| [T2 2026 - DiscountMate Planner](https://teams.microsoft.com/l/entity/com.microsoft.teamspace.tab.planner/mytasks?tenantId=d02378ec-1688-46d5-8540-1c28b5f470f6&webUrl=https%3A%2F%2Ftasks.teams.microsoft.com%2Fteamsui%2FpersonalApp%2Falltasklists&context=%7B%22subEntityId%22%3A%22%2Fv1%2Fplan%2FW4GVIlc9ekm3v0KtLqyCpsgAEMDA%22%7D) | **Current trimester.** DE tickets (e.g. DE-06 matching & dedup) and sub-tasks. |
| [T1 2026 - DiscountMate Planner](https://teams.microsoft.com/l/entity/com.microsoft.teamspace.tab.planner/_djb2_msteams_prefix_4181795700?context=%7B%22channelId%22%3A%2219%3Ac27c09a9fe5b4092bfa3c9dbee617e50%40thread.tacv2%22%7D&tenantId=d02378ec-1688-46d5-8540-1c28b5f470f6) | Previous trimester context & original pipeline architecture. |

### Navigating These Docs

| If you want to… | Go to |
|---|---|
| Set up your environment | [Getting Started](./into.md)[cite: 2] |
| Follow GitHub & PR guidelines | [Github Guidelines](https://deakin365-my.sharepoint.com/personal/s225113285_deakin_edu_au/_layouts/15/Doc.aspx?sourcedoc=%7BD7C822EA-00E4-4206-A8D5-FEAAE8D6D7C9%7D&file=Github%20Guidelines.docx&action=default&mobileredirect=true&DefaultItemOpen=1) |
| Understand the Github repository set-up | [Repository Guide](/docs/Data%20Engineering/DE%20Onboarding/repository-guide) |
| Understand scraper layers | [Ingestion Pipeline](/docs/Data%20Engineering/Ingestion%20Pipeline/tech-specs) |
| Understand Silver database tables | ETL Pipeline → [Silver Layer](/docs/Data%20Engineering/ETL%20Pipeline/silver-layer) |
| Learn product matching rules | ETL Pipeline → [Product Matching and Deduplication](/docs/category/product-matching--deduplication) |
| View cloud deployments | [Infrastructure](/docs/category/infrastructure) |
| Look up DE terms | [Glossary](/docs/Data%20Engineering/DE%20Onboarding/glossary) |

---

## 2. Platform Architecture & Data Flow

We use a **Medallion Architecture** to process data in stages:

```text
┌──────────────────┐
│ Retailer websites│
└────────┬─────────┘
         │  scrape
         v
┌──────────────────────────────┐
│ DE/ingestion-pipeline        │   BRONZE
│ (per-retailer scrapers)      │   raw, as-scraped files
└────────┬─────────────────────┘
         │  Bronze CSV/JSONL (local or GCS)
         v
┌──────────────────────────────┐
│ DE/etl-pipeline (DuckDB)      │   SILVER
│  transform.sql  → clean + dedup + build identity keys
│  sync_dim_products.sql → match & upsert canonical products
│  sync_fct_product_prices.sql → insert price observations
└────────┬─────────────────────┘
         │  MERGE into
         v
┌──────────────────────────────┐
│ PostgreSQL  silver schema    │   dim_products, fct_product_prices, dims
└────────┬─────────────────────┘
         │  aggregate  [planned]
         v
┌──────────────────────────────┐
│ Gold layer  [in progress]    │   analytics-ready tables
└────────┬─────────────────────┘
         v
   Analytics · Machine Learning · Application teams
```

- **Bronze** - raw, as-scraped product files, one per retailer run.
- **Silver** - cleaned, standardised, cross-retailer product data (the focus of most DE work).
- **Gold** - aggregated, analytics-ready tables built on top of Silver (upcoming).

## 3. Project Repositories & Boundaries

| Project | Purpose | Main output |
|---|---|---|
| `DE/ingestion-pipeline` | Scrapes product data from supported retailers and materializes run artifacts. | JSONL, CSV, manifest, and run log files. |
| `DE/etl-pipeline` | Loads Bronze product files, normalizes them through DuckDB, and syncs curated tables to PostgreSQL. | Tables in the PostgreSQL `silver` schema. |
| `discount-mate-infra` | Manages Google Cloud infrastructure with OpenTofu. | GCS buckets, Artifact Registry, Cloud Run, Cloud Scheduler, Cloud SQL, and CI/CD identity. |


## Ownership Rules

The **ingestion pipeline** collects source-shaped product files. It should not own warehouse
schema decisions beyond producing consistent files and metadata.

The **ETL pipeline** owns schema mapping, validation, deduplication, and loading into silver
tables. It should not contain scraper-specific HTTP logic.

The **infrastructure** project owns deployed cloud resources and environment wiring. Runtime
application changes stay in the relevant application project.

## 4. Planning & handover documents

_These are stored in Teams/SharePoint._

| Document | What it is |
|---|---|
| [T2 2026 Company Structure & Objectives](https://deakin365.sharepoint.com/:w:/r/sites/DataBytes2/Shared%20Documents/Project%20-%20DiscountMate/T3%202025/Handover%20Documents/DataBytes%20Task%202.1P%20-%20T22026%20DiscountMate%20Section.docx?d=w5e63c0de25784133a77eaf7b37a359b1&csf=1&web=1&e=IBdzf3) | Company-wide handover file for T2 2026: teams, leads, aims, deliverables (DE section included). | 
| [T1 2026 Company Structure & Objectives](https://deakin365-my.sharepoint.com/:b:/g/personal/s224757434_deakin_edu_au/IQCCdi3zyAEmR4mO1ZPzwtmUAaIVUR16fXMXnC4ec5sJZpo?e=eTIr1b) | Company-wide handover file for T1 2026: teams, leads, aims, deliverables (DE section included). | 
| [T2 2026 Team Lead Roadmap](https://deakin365-my.sharepoint.com/:w:/g/personal/s224757434_deakin_edu_au/IQBWXK3WaCN0Tayhd2C6SdgoATb5-wOfN_6c9Ml0y2GVehc?e=HUuUOt) | The 10-week T2 2026 plan, including the DE feature/task breakdown. | 
| [T1 2026 Team Lead Roadmap](https://deakin365-my.sharepoint.com/:b:/r/personal/s224757434_deakin_edu_au/Documents/Microsoft%20Teams%20Chat%20Files/Roadmap%20-%20DiscountMate%20-%20T1%202026.pdf?d=w6c8c35ad2a6744c69b1d3bffd9444ee3&csf=1&web=1&e=WDYudU) | The 10-week T1 2026 plan, including the DE feature/task breakdown. |

## Trimester history (context)

- **T1 2026:** Bronze scraper standardisation + Silver ETL foundation (per-retailer pipelines, warehouse schema).
- **T2 2026:** Refine matching/dedup, automate & monitor the Silver pipelines, consolidate this documentation, prepare the Gold layer, and migrate MongoDB → PostgreSQL.


## 5. Writing documentation

These DE docs are built with Docusaurus. To add or edit a page, see the team's guide and
templates in **Templates & Examples**:
the **[How to Docusaurus](/docs/Templates%20&%20Examples/How_to_Docusaurus.md)** walkthrough and the copy-paste **[Markdown](docs/Templates%20&%20Examples/documarkdown_copy_paste_template.md)/ [MDX templates](/docs/Templates%20&%20Examples/docusaurus-MDX-copy-paste-template)**.

For DE team pages, always update this portion at the bottom - **Page last modified:** date modified (name of person responsible for the last update)

## Related pages

- Ingestion Pipeline → Tech Specs
- ETL Pipeline → [Silver Layer](./ETL Pipeline/silver-layer.md)
- ETL Pipeline → Product Matching & Deduplication
- Infrastructure → Discount Mate Infrastructure

**Page last modified:** 19/09/2026 (Margie Licup)

