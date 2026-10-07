---
title: "Deep Learning: Price & Discount Forecasting"
sidebar_label: "Chatbot"
sidebar_position: 2
---
# Deep Learning — Chatbot Product Search & Price Comparison

## 1. Contract Overview

- **Contract name:** Chatbot Product Search & Price Comparison
- **Version:** 1.0
- **Date created / updated:** 26/09/2026
- **Consumer team:** Deep Learning / Chatbot
- **Status:** Draft

## 2. Purpose & Use Case

This Gold dataset supports the DiscountMate chatbot capabilities implemented under DL-06.

The currently supported actions are:

- `search_products`
- `compare_prices`
- clarification for ambiguous product requests

The Gold layer should provide a clean, canonical, application-ready view of products and latest retailer prices so the chatbot does not need to reconstruct product identity or retailer pricing from raw ingestion structures.

The intended business outcomes are:

- allow users to search for products by name and product attributes;
- return ranked or candidate matches when the query is ambiguous;
- compare the same canonical product across retailers;
- display current/latest price, retailer, unit-price and special-status information;
- reduce matching and data-cleaning logic inside the chatbot service.

## 3. Data Requirements

| **Requirement** | **Status** |
|---|---|
| Product identifier | Required |
| Canonical product name | Required |
| Brand name | Required where available |
| GTIN / barcode | Recommended |
| Pack quantity | Required where available |
| Pack UOM | Required where available |
| Category identifier | Recommended |
| Category name | Recommended |
| Retailer identifier | Required |
| Retailer name | Required |
| Latest available retailer price | Required |
| Unit price | Recommended |
| On-special indicator | Required where supplied |
| Special text | Recommended |
| Retailer item name | Recommended |
| Product URL | Optional |
| Observation date | Required |

## 4. Data Grain

Ideal serving grain:

**one row per canonical product_id × retailer_id containing the latest retained valid price observation.**

The latest price should be derived from `silver.fct_product_prices`.

Where multiple source observations exist, use the approved latest-observation rule from the price-history pipeline.

Historical price forecasting is outside this contract and is covered separately by DE-09.

## 5. Data Fields / Schema

| **Field** | **Data Type** | **Required?** | **Definition** | **Source** | **Transformation / Rule** | **Validation** |
|---|---|---|---|---|---|---|
| product_id | ID (TBC) | Yes | Canonical product identifier | silver.dim_products.id / silver.fct_product_prices.product_id | Join latest retailer price to canonical product | Not null |
| product_name | TEXT | Yes | Canonical product name used for search/display | silver.dim_products.product_name | Copy canonical value | Not null |
| brand_name | TEXT | Where available | Canonical brand | silver.dim_products.brand_name | Copy | Preserve null if unavailable |
| gtin | TEXT | No | Canonical barcode/GTIN | silver.dim_products.gtin | Copy as text | GTIN format validation |
| pack_quantity | NUMERIC/TEXT (TBC) | Where available | Canonical pack quantity | silver.dim_products.pack_quantity | Copy | Preserve source meaning |
| pack_uom | TEXT | Where available | Unit associated with pack quantity | silver.dim_products.pack_uom | Copy | Use with pack_quantity |
| category_id | ID (TBC) | No | Canonical product category | silver.dim_products.category_id / silver.dim_categories.id | Join | Valid FK if present |
| category_name | TEXT | No | Readable category | silver.dim_categories.category_name | Left join | Null permitted |
| retailer_id | ID (TBC) | Yes | Retailer identifier | silver.fct_product_prices.retailer_id | Copy | Not null |
| retailer_name | TEXT | Yes | Readable retailer name | silver.dim_retailers.retailer_name | Join by retailer_id | Non-empty |
| price | NUMERIC (TBC) | Yes | Latest retained retailer price | silver.fct_product_prices.price | Select latest valid observation | Not null; > 0 |
| unit_price | NUMERIC (TBC) | Recommended | Unit price where supplied | silver.fct_product_prices.unit_price | Copy | Null allowed |
| is_on_special | BOOLEAN (TBC) | Where supplied | Source promotional flag | silver.fct_product_prices.is_on_special | Copy; do not infer | Boolean/null |
| special_text | TEXT | No | Source promotion text | silver.fct_product_prices.special_text | Copy | Preserve source value |
| observation_date | DATE | Yes | Date of retained retailer price observation | silver.fct_product_prices.recorded_at | Convert using approved timezone/date rule | Not null |
| item_name | TEXT | No | Retailer's source listing name | silver.fct_product_prices.item_name | Copy | Preserve original |
| product_url | TEXT | No | Retailer product URL | silver.fct_product_prices.product_url | Copy | URL validation if present |

## 6. Business / Functional Rules

- Product search should use structured canonical attributes rather than relying only on a single free-text product description.
- `product_name` and `brand_name` must remain separate searchable fields.
- Pack attributes should be available where possible to distinguish similar variants.
- Search should return candidate products when the request is ambiguous instead of forcing an incorrect match.
- Price comparison must compare retailer prices for the same canonical `product_id`.
- Different retailer listing names may only be treated as the same product when canonical product mapping supports that relationship.
- `is_on_special` must come from the source and must not be inferred from a price decrease.
- Latest retailer price should be reproducible from the retained observation logic.
- Missing optional metadata should not prevent a valid product-price result where the canonical identity and price are available.

## 7. Search & Matching Requirements

The chatbot currently needs enough data to support:

### Product search

Search should be able to use:

- product name
- brand
- GTIN
- pack quantity
- pack UOM
- category where useful

Known DL-06 behaviour shows that combined brand + product text can fail when treated as a single contiguous search string. Gold should therefore expose these attributes separately.

### Price comparison

For an identified canonical product, the serving layer should return:

- retailer
- latest price
- unit price where available
- special status
- observation date

The result should support comparison across all retailers where that canonical product has a current/latest valid observation.

## 8. Data Quality Requirements

- `product_id`, `product_name`, `retailer_id`, `retailer_name`, `price`, and `observation_date` must not be null for served rows.
- Price must be greater than zero.
- Retailer and product IDs must reconcile to canonical dimensions.
- Duplicate product-retailer rows must not appear in the latest-price serving output.
- GTIN should be treated as text.
- Missing brand or pack data should remain null rather than being invented.
- Conflicting latest-price observations should be quarantined until resolved by the upstream daily-selection rule.
- Special status should preserve source semantics.

## 9. Refresh & Freshness Requirements

- The chatbot-serving view should refresh after retailer price ingestion completes.
- Latest-price rows should update when a newer valid observation is available.
- Freshness should be observable through `observation_date`.
- Required freshness SLA: **TBC with DL / application team**.
- If the latest observation is considered too old, expected chatbot behaviour should be defined by the consuming team.

## 10. Source → Gold Mapping

| **Source** | **Source Field** | **Gold Field** | **Transformation** |
|---|---|---|---|
| silver.dim_products | id | product_id | Copy canonical key |
| silver.dim_products | product_name | product_name | Copy |
| silver.dim_products | brand_name | brand_name | Copy |
| silver.dim_products | gtin | gtin | Copy as text |
| silver.dim_products | pack_quantity | pack_quantity | Copy |
| silver.dim_products | pack_uom | pack_uom | Copy |
| silver.dim_products | category_id | category_id | Copy |
| silver.dim_categories | category_name | category_name | Left join |
| silver.fct_product_prices | retailer_id | retailer_id | Copy from selected latest observation |
| silver.dim_retailers | retailer_name | retailer_name | Join by retailer_id |
| silver.fct_product_prices | price | price | Copy latest retained price |
| silver.fct_product_prices | unit_price | unit_price | Copy |
| silver.fct_product_prices | is_on_special | is_on_special | Copy |
| silver.fct_product_prices | special_text | special_text | Copy |
| silver.fct_product_prices | recorded_at | observation_date | Convert to DATE using approved rule |
| silver.fct_product_prices | item_name | item_name | Copy |
| silver.fct_product_prices | product_url | product_url | Copy |

## 11. Recommended Gold Serving Object

Suggested object:

`gold.vw_product_current_prices`

Suggested grain:

`product_id + retailer_id`

This serving object should contain the latest valid retailer observation for each canonical product-retailer combination and the product attributes required by `search_products` and `compare_prices`.

## 12. Expected Output / Mock Data

| **product_id** | **product_name** | **brand_name** | **pack_quantity** | **pack_uom** | **retailer_name** | **price** | **unit_price** | **is_on_special** | **observation_date** |
|---|---|---|---:|---|---|---:|---:|---|---|
| P1001 | Cheese Romano Block | Example Brand | 200 | g | Woolworths | 6.50 | 3.25 | true | 2026-09-25 |
| P1001 | Cheese Romano Block | Example Brand | 200 | g | Coles | 7.50 | 3.75 | false | 2026-09-25 |
| P1001 | Cheese Romano Block | Example Brand | 200 | g | IGA | 7.50 | 3.75 | false | 2026-09-25 |

Illustrative only.

## 13. Dependencies

- `silver.dim_products`
- `silver.dim_retailers`
- `silver.dim_categories`
- `silver.fct_product_prices`
- canonical product-deduplication logic from the DE stream
- DL-06 `search_products` contract
- DL-06 `compare_prices` contract
- latest-price selection logic
- chatbot/application API response contract

## 14. Open Questions / Decisions

| **Question / Issue** | **Owner** | **Status** |
|---|---|---|
| How fresh must a price be to be considered current? | DL / DE | Open |
| Should stale prices still be returned with a warning? | DL / product | Open |
| Which product attributes are mandatory for matching? | DL / DE | Open |
| Should category be searchable or only descriptive? | DL | Open |
| How should pack variants be represented when source data is missing? | DE / DL | Open |
| Should GTIN be used as the strongest exact-match key where available? | DE / DL | Open |
| Should product_url be exposed in the chatbot response? | DL / frontend | Open |
| What is the required refresh/freshness SLA? | DL / DE | Open |

## 15. Acceptance Criteria

- The chatbot can search canonical products using structured product attributes.
- Product name and brand are independently searchable.
- Pack attributes can distinguish variants where available.
- Ambiguous searches can return multiple candidates for clarification.
- Price comparison returns latest valid retailer-specific prices for the same canonical product.
- Retailer name, price and observation date are available for each comparison row.
- Unit price and special status are returned where supplied.
- The serving output contains no duplicate product-retailer rows.
- The chatbot does not need to derive canonical product identity from raw retailer text.
- Gold supports the existing `search_products` and `compare_prices` actions without requiring raw collection queries.

## 16. Responsibilities

- **Data Engineering:** Gold transformation, canonical joins, latest-price selection and data-quality controls.
- **DL / Chatbot team:** confirm required search attributes, clarification behaviour, freshness expectations and response contract.
- **Frontend / application team:** confirm display requirements for retailer comparison and product candidate results.

## 17. Approval

- Data Engineering representative: TBC
- DL / Chatbot representative: TBC
- Relevant lead / stakeholder: TBC
- Approval date/status: Pending
