---
title: Silver Layer
sidebar_label: Silver Layer
sidebar_position: 2
---

# Silver Layer

The ETL pipeline writes curated warehouse data into the PostgreSQL `silver` schema. These tables are intended for downstream analytics, machine learning, and application-facing product comparison features.

## Core tables

| Table | Purpose |
|---|---|
| `silver.fct_product_prices` | Historical product price observations by retailer and timestamp. |
| `silver.dim_products` | Canonical product dimension with package, retailer price snapshot, image, and prediction fields. |
| `silver.dim_retailers` | Retailer dimension seeded with ALDI, Coles, IGA, and Woolworths. |
| `silver.dim_categories` | Canonical product category dimension seeded by migration. |
| `silver.demo_product_pricing_summary` | Demo summary output used by the starter example workflow. |
| `silver.static_master_coles_products` | Coles product reference table created for Coles-specific enrichment. |

## `fct_product_prices`

This fact table stores price snapshots captured from retailer websites. Each row represents a product price observation for a retailer at a specific time.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `uuid` | Yes | Surrogate row identifier. |
| `recorded_at` | `timestamptz` | Yes | Time the price was observed or scraped. Part of the primary key. |
| `product_id` | `uuid` | Yes | References `silver.dim_products.id`. |
| `category_id` | `uuid` | Yes | References `silver.dim_categories.id`. |
| `retailer_id` | `uuid` | Yes | References `silver.dim_retailers.id`. |
| `item_name` | `text` | Yes | Retailer-displayed product name at scrape time. |
| `special_text` | `text` | No | Raw promotion or badge text. |
| `product_url` | `text` | No | Retailer product URL when available. |
| `price` | `numeric(10,2)` | Yes | Current shelf price. |
| `unit_price` | `numeric(12,4)` | No | Unit price, such as per 100g or per unit. |
| `is_on_special` | `boolean` | No | Promotion indicator derived from source data. |
| `created_at` | `timestamptz` | Yes | Insert timestamp. |

## `dim_products`

This dimension stores canonical product attributes and current/previous retailer price snapshots. It is the main product lookup table for cross-retailer comparison.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `uuid` | Yes | Surrogate product identifier. |
| `category_id` | `uuid` | Yes | References `silver.dim_categories.id`. |
| `product_name` | `text` | Yes | Standardized product name. |
| `brand_name` | `text` | No | Standardized brand name when available. |
| `gtin` | `varchar(14)` | No | Global Trade Item Number. Unique when present. |
| `pack_quantity` | `numeric(10,3)` | No | Numeric package quantity. Must be positive when present. |
| `pack_uom` | `text` | No | Allowed values include `g`, `kg`, `ml`, `l`, `ea`, `pack`, and `m`. |
| `image_link_side` | `text` | No | Primary or side product image URL. |
| `image_link_back` | `text` | No | Back product image URL. |
| `created_at` | `timestamptz` | Yes | Insert timestamp. |
| `updated_at` | `timestamptz` | Yes | Last update timestamp. |

### Retailer price snapshot fields

`dim_products` stores current and previous price snapshots for each supported retailer.

| Retailer | Shelf price fields | Unit price fields |
|---|---|---|
| Coles | `price_current_coles`, `price_last_coles` | `unit_price_current_coles`, `unit_price_last_coles` |
| Woolworths | `price_current_woolworths`, `price_last_woolworths` | `unit_price_current_woolworths`, `unit_price_last_woolworths` |
| ALDI | `price_current_aldi`, `price_last_aldi` | `unit_price_current_aldi`, `unit_price_last_aldi` |
| IGA | `price_current_iga`, `price_last_iga` | `unit_price_current_iga`, `unit_price_last_iga` |

### Prediction fields

The latest migration adds prediction and discount classification fields to `dim_products`.

| Field | Type | Notes |
|---|---|---|
| `prophet_price_pred` | `float` | Forecast price from Prophet-based modelling. |
| `prophet_on_sale_pred` | `boolean` | Forecast sale indicator from Prophet-based modelling. |
| `xgboost_price_pred` | `float` | Forecast price from XGBoost-based modelling. |
| `true_value_classification` | `text` | Customer-facing discount label, such as `OK Discount`, `Good Discount`, `Excellent Discount`, or `DiscountMate Recommends`. |

## `dim_retailers`

This table standardizes retailer references across fact and dimension tables.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `uuid` | Yes | Surrogate retailer identifier. |
| `retailer_name` | `text` | Yes | Unique retailer name. |
| `website_url` | `text` | No | Official retailer website URL. |
| `created_at` | `timestamptz` | Yes | Insert timestamp. |
| `updated_at` | `timestamptz` | Yes | Last update timestamp. |

Seeded retailers:

- `aldi`
- `coles`
- `iga`
- `woolworths`

## `dim_categories`

This table standardizes product categories for reporting and product discovery.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `uuid` | Yes | Surrogate category identifier. |
| `category_name` | `text` | Yes | Unique canonical category name. |
| `created_at` | `timestamptz` | Yes | Insert timestamp. |
| `updated_at` | `timestamptz` | Yes | Last update timestamp. |

## Query examples

Inspect recent price observations:

```sql
SELECT
  retailer_id,
  product_id,
  recorded_at,
  price,
  unit_price,
  is_on_special
FROM silver.fct_product_prices
ORDER BY recorded_at DESC
LIMIT 50;
```

Inspect product price snapshots:

```sql
SELECT
  product_name,
  brand_name,
  price_current_coles,
  price_current_iga,
  true_value_classification
FROM silver.dim_products
ORDER BY updated_at DESC
LIMIT 50;
```
