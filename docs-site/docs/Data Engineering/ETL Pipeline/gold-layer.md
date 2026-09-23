---
title: Gold Layer
sidebar_label: Gold Layer
sidebar_position: 3
---

# Gold Layer

:::info Work in Progress
The Gold Layer is currently under active development. The Data Engineering (DE) team is partnering with downstream consumers, specifically the **Machine Learning** and **Data Analytics** teams, to define and finalize **Data Contracts**.
:::

The Gold Layer will contain aggregated, business-ready, and domain-specific tables built directly on top of the `silver` schema. These curated views and tables serve specialized downstream use cases, including demand forecasting models, price trend dashboards, and application analytics.

## Active Collaborations & Data Contracts

We are actively establishing schema requirements, delivery SLAs, and validation rules in partnership with downstream stakeholders:

| Downstream Team | Collaboration Focus | Data Contract Links|
|---|---|---|
| **Machine Learning (ML)** | Feature store tables, historical price series, and prediction ingestion schemas | [ML Data Contract Specs (Teams/SharePoint)](#) |
| **Data Analytics** | Aggregated daily/weekly retailer price trends, savings metrics, and category summaries | [Analytics Data Contract Specs (Teams/SharePoint)](#) |

---

## Planned Architecture

```text
┌──────────────────────────────┐
│ PostgreSQL  silver schema    │   dim_products, fct_product_prices
└────────┬─────────────────────┘
         │  Transform & Aggregate (SQL / dbt)
         v
┌──────────────────────────────┐
│ PostgreSQL  gold schema      │   analytics & ML tables [In Progress]
└────────┬──────────────┬──────┘
         │              │
         v              v
   Data Analytics   Machine Learning
   Dashboards       Feature Store & Models
```

## Core tables

## Schema fields

## Query examples