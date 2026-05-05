# Silver Layer Table Documentation

This document describes the four core tables in the product pricing warehouse:

- `fct_product_prices`
- `dim_products`
- `dim_retailers`
- `dim_categories`

## `fct_product_prices`

The `fct_product_prices` table is the historical fact table for product pricing. It stores price observations captured from retailer websites at scrape time. Each row represents a price snapshot for a product at a retailer at a specific timestamp, along with supporting retail-page attributes such as the displayed item name, source URL, and promotional text.

| Field Name | Description | Data Type | Key / Constraint | Required? |
|---|---|---|---|---|
| `id` | Surrogate identifier for each price snapshot row. | `uuid` | `PK` | Required |
| `recorded_at` | Timestamp when the price was observed on the retailer website or during scraping. | `timestamptz` | `PK` | Required |
| `product_id` | Identifier of the canonical product this price record belongs to. | `uuid` | `FK` | Required |
| `category_id` | Identifier of the canonical category this product record belongs to. | `uuid` | `FK` | Required |
| `retailer_id` | Identifier of the retailer where the price was observed. | `uuid` | `FK` | Required |
| `item_name` | Product name as displayed on the retailer website at the time of scraping. | `text` |  | Required |
| `special_text` | Raw promotional text or badge shown by the retailer, if available. | `text` |  | Optional |
| `product_url` | URL of the retailer product page used as the source for this record. | `text` |  | Optional |
| `price` | Current selling price captured at `recorded_at`. | `decimal` |  | Required |
| `unit_price` | Normalized unit price shown by the retailer, such as price per 100g, 100ml, or per unit. | `decimal` |  | Optional |
| `is_on_special` | Indicates whether the product was on promotion at the time of scraping. | `boolean` |  | Optional |
| `created_at` | Timestamp when this record was inserted into the database. | `timestamptz` |  | Required |

## `dim_products`

The `dim_products` table is the canonical product dimension. It stores standardized product attributes used across retailers, including product identity, category assignment, package information, snapshot price comparison fields, and image references. The flattened retailer-specific snapshot columns provide convenient access to current and previous price comparisons by retailer.

| Field Name | Description | Data Type | Key / Constraint | Required? |
|---|---|---|---|---|
| `id` | Surrogate identifier for the canonical product. | `uuid` | `PK` | Required |
| `category_id` | Identifier of the canonical category this product record belongs to. | `uuid` | `FK` | Required |
| `product_name` | Standardized product name used to represent the matched product across retailers. | `text` |  | Required |
| `brand_name` | Standardized brand name, when available. | `text` |  | Optional |
| `gtin` | Global Trade Item Number for the product, when available. | `varchar(14)` | `Unique` | Optional |
| `pack_quantity` | Numeric package quantity, such as 700, 1.25, or 24. | `numeric(10,3)` | `Check > 0` | Optional |
| `pack_uom` | Unit of measure for the package quantity, such as g, kg, ml, L, or each. | `text` | `Check list` | Optional |
| `price_current_coles` | Current shelf price at Coles. | `numeric(10,2)` |  | Optional |
| `price_last_coles` | Previous shelf price snapshot at Coles. | `numeric(10,2)` |  | Optional |
| `price_current_woolworths` | Current shelf price at Woolworths. | `numeric(10,2)` |  | Optional |
| `price_last_woolworths` | Previous shelf price snapshot at Woolworths. | `numeric(10,2)` |  | Optional |
| `price_current_aldi` | Current shelf price at Aldi. | `numeric(10,2)` |  | Optional |
| `price_last_aldi` | Previous shelf price snapshot at Aldi. | `numeric(10,2)` |  | Optional |
| `price_current_iga` | Current shelf price at IGA. | `numeric(10,2)` |  | Optional |
| `price_last_iga` | Previous shelf price snapshot at IGA. | `numeric(10,2)` |  | Optional |
| `unit_price_current_coles` | Current unit price at Coles. | `numeric(12,4)` |  | Optional |
| `unit_price_last_coles` | Previous unit price snapshot at Coles. | `numeric(12,4)` |  | Optional |
| `unit_price_current_woolworths` | Current unit price at Woolworths. | `numeric(12,4)` |  | Optional |
| `unit_price_last_woolworths` | Previous unit price snapshot at Woolworths. | `numeric(12,4)` |  | Optional |
| `unit_price_current_aldi` | Current unit price at Aldi. | `numeric(12,4)` |  | Optional |
| `unit_price_last_aldi` | Previous unit price snapshot at Aldi. | `numeric(12,4)` |  | Optional |
| `unit_price_current_iga` | Current unit price at IGA. | `numeric(12,4)` |  | Optional |
| `unit_price_last_iga` | Previous unit price snapshot at IGA. | `numeric(12,4)` |  | Optional |
| `image_link_side` | URL of the side or primary product image, when available. | `text` |  | Optional |
| `image_link_back` | URL of the back product image, when available. | `text` |  | Optional |
| `created_at` | Timestamp when the dimension row was first created in the warehouse. | `timestamptz` |  | Required |
| `updated_at` | Timestamp when the dimension row was last updated in the warehouse. | `timestamptz` |  | Required |

## `dim_retailers`

The `dim_retailers` table is the retailer dimension. It stores one row per retailer and is used to standardize retailer references across the warehouse. This table supports joins from fact tables and provides retailer metadata such as the retailer name and official website URL.

| Field Name | Description | Data Type | Key / Constraint | Required? |
|---|---|---|---|---|
| `id` | Surrogate identifier for each retailer. | `uuid` | `PK` | Required |
| `retailer_name` | Retailer name. | `text` | `Unique` | Required |
| `website_url` | Official base website URL of the retailer. | `text` |  | Optional |
| `created_at` | Timestamp when the retailer row was first created in the database. | `timestamptz` |  | Required |
| `updated_at` | Timestamp when the retailer row was last updated in the database. | `timestamptz` |  | Required |

## `dim_categories`

The `dim_categories` table is the category dimension. It stores the canonical product categories used to classify products consistently across retailers. This table supports category-level reporting and standardizes the category reference used by both product and price tables.

| Field Name | Description | Data Type | Key / Constraint | Required? |
|---|---|---|---|---|
| `id` | Surrogate identifier for each category. | `uuid` | `PK` | Required |
| `category_name` | Category name. | `text` | `Unique` | Required |
| `created_at` | Timestamp when the category row was first created in the database. | `timestamptz` |  | Required |
| `updated_at` | Timestamp when the category row was last updated in the database. | `timestamptz` |  | Required |
