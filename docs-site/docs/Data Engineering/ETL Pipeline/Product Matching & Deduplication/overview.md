---
title: Matching & Deduplication Overview
sidebar_label: Overview
sidebar_position: 1
---

:::info Ticket Reference
**Ticket:** DE-06 - Product Matching & Deduplication (Silver Layer)  
**Sub-tasks:** DE-06-T1, DE-06-T2  
**Owner:** _TBD_ · **Status:** Done (IGA, Aldi)  
**Full scope on Planner:** [T2 2026 - DiscountMate](https://teams.microsoft.com/l/entity/com.microsoft.teamspace.tab.planner/mytasks?tenantId=d02378ec-1688-46d5-8540-1c28b5f470f6&webUrl=https%3A%2F%2Ftasks.teams.microsoft.com%2Fteamsui%2FpersonalApp%2Falltasklists&context=%7B%22subEntityId%22%3A%22%2Fv1%2Fplan%2FW4GVIlc9ekm3v0KtLqyCpsgAEMDA%22%7D)
:::

# Product Matching & Deduplication 

This section documents how the ETL pipeline makes the **same physical product map to one
canonical row** in `silver.dim_products`, across repeated scrapes and across retailers, while
preventing duplicate or conflicting inserts.

## Why it matters

Each retailer names and formats products differently, and the same item is scraped many times.
Without matching and deduplication, one product becomes many rows - which splits its price
history and clutters the catalogue. This work makes cross-retailer price comparison possible.

## The two problems it solves

1. **Deduplication** - the same product appears multiple times in one scrape (e.g. listed under
   several categories). These collapse into one row.
2. **Identity resolution** - a newly scraped product must be recognised as an existing canonical
   product (by barcode, then by name/brand/pack), not inserted again.

## Where it runs

| Step | File | What it does |
|---|---|---|
| Transform | `features/products/<retailer>/workflow_sql/transform.sql` | Cleans rows, builds identity keys, **deduplicates within a batch**. |
| Dim merge | `.../sync_dim_products.sql` | **Resolves identity** and upserts the canonical product. |
| Fact merge | `.../sync_fct_product_prices.sql` | Inserts price observations. |

## Pages in this section

- **[Matching & Deduplication Rules](./matching-rules.md)** - the rule ladder and dedup logic (T1, T2).
- **[Validation & Results](./validation-and-results.md)** - how it was tested and the outcomes (T4).
- **[Limitations & Conflict Handling](./limitations.md)** - conflict cases and known limits (T3).

**Page last modified:** 19/09/2026 (Margie Licup)