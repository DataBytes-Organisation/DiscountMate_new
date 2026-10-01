---
title: "Deep Learning: Price & Discount Forecasting"
sidebar_label: "Price & Discount Forecasting"
sidebar_position: 1
---

# Price & Discount Forecasting Data Contract

## 1. Contract Overview

- Contract name: Price & Discount Forecasting

- Version: 1.2 (working draft)

- Date created / updated: 14/09/2026

- Consumer team: ML

- Status: Draft

## 2. Purpose & Use Case

- The original approach was based on classification, but the intended direction is now a **regression-based forecasting model** using historical product pricing information.

- The Gold dataset should provide retailer-specific product prices by observation date (`DATE` only). Derive `observation_date` from `silver.fct_product_prices.recorded_at`; the source time is used only to select the daily record. This is an observation date, not a verified retailer price-change date.

- Expected consumers are the ML and DA teams.

- The intended business outcome is to provide reliable historical pricing data that can be used to train models to forecast future prices and discount behaviour.

## 3. Data Requirements

| **Requirement**               | **Status**                                                          |
|-------------------------------|---------------------------------------------------------------------|
| Product identifier            | Required \| `fct_product_prices.product_id`                           |
| Retailer identifier           | Required \| `fct_product_prices.retailer_id`                          |
| Product price                 | Required \| `fct_product_prices.price`                                |
| Observation date              | Required \| `DATE(recorded_at)`; source clock time excluded from Gold |
| Previous price                | Proposed \| derive via prior observation (LAG)                      |
| Discount amount               | Proposed \| definition/reference price unconfirmed                  |
| Discount percentage           | Proposed \| only after discount baseline is approved                |
| On-special indicator          | Proposed for Gold \| source `is_on_special` exists                    |
| Product/category information  | Optional for ML \| product/category dimensions available            |
| Historical price observations | Required \| daily history: one row per product–retailer–date        |
| Unit price                    | Proposed for Gold \| source `unit_price` exists                       |

## 4. Data Grain

- Gold grain: one product–retailer–`observation_date` row (daily; `DATE` only).

- `observation_date = DATE(silver.fct_product_prices.recorded_at)` using the agreed source time zone.

- If multiple observations occur on a date, retain the latest by source `recorded_at`; identical duplicates are collapsed and conflicting latest-time prices are quarantined for review.

- Source timestamps remain in Silver, not the Gold output.

## 5. Data Fields / Schema

| **Field**           | **Data Type** | **Required?** | **Definition**                                                        | **Mock Value**         | **Source**                       | **Transformation**                                                                                                     | **Validation**                                                      |
|---------------------|---------------|---------------|-----------------------------------------------------------------------|------------------------|----------------------------------|------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------|
| `observation_id`      | ID (TBC)      | Yes           | Selected daily source price-row identifier; lineage / tie-break only. | obs001                 | `fct_product_prices.id`            | Copy ID from the selected daily source row; retain source date-selection evidence in Silver.                           | Non-null, unique; type TBC.                                         |
| `product_id`          | ID (TBC)      | Yes           | Canonical product link.                                               | P001                   | `fct_product_prices.product_id`    | Copy; join `dim_products.id`.                                                                                            | Not null; valid product FK.                                         |
| `retailer_id`         | ID (TBC)      | Yes           | Retailer of observed price.                                           | R002                   | `fct_product_prices.retailer_id`   | Copy; join dim_retailers.id.                                                                                           | Not null; valid retailer FK.                                        |
| `observation_date`    | DATE          | Yes           | Calendar date when the retailer price was observed (no time-of-day).  | 2026-09-16             | `fct_product_prices.recorded_at`   | CAST(`recorded_at` AS DATE) in agreed source time zone; select latest source observation for each product–retailer–date. | Not null; valid date; unique with `product_id` + `retailer_id` in Gold. |
| `price`             | NUMERIC (TBC) | Yes           | Observed shelf / listed price.                                        | 5.50                   | `fct_product_prices.price`         | Copy; do not substitute current dimension price.                                                                       | Not null; \> 0; currency TBC.                                       |
| `unit_price`          | NUMERIC (TBC) | No            | Observed unit price if supplied.                                      | 1.10                   | `fct_product_prices.unit_price`    | Copy; do not calculate absent unit basis.                                                                              | Null allowed; \>= 0 if present.                                     |
| `is_on_special`       | BOOLEAN (TBC) | Proposed      | Source promotional/special flag.                                      | true                   | `fct_product_prices.is_on_special` | Copy; retain null as unknown.                                                                                          | Valid boolean/null; meaning TBC.                                    |
| `category_id`         | ID (TBC)      | No            | Category for observation.                                             | C001                   | `fct_product_prices.category_id`   | Copy; optional category dimension lookup.                                                                              | Valid FK when present; mismatch review.                             |
| `item_name`           | TEXT          | No            | Retailer listing name at observation.                                 | Milk 2 L               | `fct_product_prices.item_name`     | Copy, retain original label.                                                                                           | Optional; no invented names.                                        |
| `special_text`        | TEXT          | No            | Special-description source text.                                      | Half price             | `fct_product_prices.special_text`  | Copy; no automatic discount inference.                                                                                 | Optional; preserve source value.                                    |
| `product_url`         | TEXT          | No            | Original retailer product URL.                                        | https://example.test/p | `fct_product_prices.product_url`   | Copy if required for traceability.                                                                                     | Optional; format check if present.                                  |
| `product_name`        | TEXT          | No            | Canonical product name.                                               | Milk 2 L               | `dim_products.product_name`        | Left join on `product_id` = id.                                                                                          | Optional; unmatched keys reported.                                  |
| `brand_name`          | TEXT          | No            | Canonical product brand.                                              | Example Brand          | `dim_products.brand_name`          | Left join on `product_id` = id.                                                                                          | Optional; missing permitted.                                        |
| `gtin`                | TEXT          | No            | Canonical barcode identifier.                                         | 9300000000000          | `dim_products.gtin`                | Copy as text, not numeric.                                                                                             | Optional; validate format separately.                               |
| `retailer_name`       | TEXT          | No            | Readable retailer display name.                                       | Woolworths             | `dim_retailers.retailer_name`      | Left join on `retailer_id = id`.                                                                                         | Non-empty for matched retailer.                                     |
| `previous_price`      | NUMERIC       | Proposed      | Price from the preceding retained daily observation.                  | 6.00                   | Gold derived from fact history   | LAG(price) within product and retailer ordered by `observation_date`.                                                    | Null for first; \> 0 otherwise.                                     |
| `price_change_amount` | NUMERIC       | Proposed      | Signed change from previous observed price.                           | -0.50                  | Gold derived                     | price - `previous_price`.                                                                                                | Null if no previous.                                                |
| `price_change_pct`    | NUMERIC       | Proposed      | Signed % movement vs previous price.                                  | -8.33                  | Gold derived                     | 100 \* change / `previous_price`.                                                                                        | Null if prior \<= 0 / missing.                                      |
| `discount_amount`     | NUMERIC       | Proposed      | Price-decrease proxy pending discount definition.                     | 0.50                   | Gold derived (provisional)       | max(`previous_price` - price, 0).                                                                                        | Null if no reference; \>= 0.                                        |
| `discount_pct`        | NUMERIC       | Proposed      | % price-decrease proxy, not proven promo.                             | 8.33                   | Gold derived (provisional)       | 100 \* `discount_amount` / `previous_price`.                                                                               | Null if previous \<= 0 / missing.                                   |

## 6. Business / Functional Rules

- Price values must relate to an existing canonical product and retailer.

- Order Gold price history by `observation_date` after selecting one observation per product–retailer–date.

- A discount should only be identified where an appropriate reference/previous price exists.

- Gold must contain no more than one row per `product_id`, `retailer_id` and `observation_date`; repeated identical source records must not create duplicates.

- Missing previous prices should result in null change/discount fields rather than manufactured values.

- The definition of a "discount" needs confirmation: previous price, regular price, WasPrice, or another source.

- Within each `product_id` + `retailer_id`, select the latest source `recorded_at` on each `observation_date`, then order the retained daily rows by `observation_date` ascending. The source timestamp is an internal selection aid only; no time-of-day is exposed in Gold.

- Deduplicate identical source observations. If multiple prices exist within a date, use the last recorded source observation. If different prices share the latest `recorded_at` for the same product, retailer and date, quarantine until a deterministic, approved source rule resolves the conflict.

- `is_on_special` is a supplied flag, not proof that price dropped. A price decrease is not necessarily an advertised discount; do not overwrite the source flag with an inferred one.

- Avoid look-ahead leakage: training features for time t must not use any future price, future snapshots, model predictions or `true_value_classification` from `silver.dim_products`.

## 7. Derived / Calculated Fields

| **Derived Field**   | **Definition**                     | **Calculation / Logic**                                                                                        | **Example** | **Required?** | **Notes**                                                                      |
|---------------------|------------------------------------|----------------------------------------------------------------------------------------------------------------|-------------|---------------|--------------------------------------------------------------------------------|
| `previous_price`      | Price from previous observed date  | `LAG(price) OVER (PARTITION BY product_id, retailer_id ORDER BY observation_date)`                               | 6.00        | Proposed      | Apply after one-row-per-date selection; null for first observed date.          |
| `price_change_amount` | Signed absolute movement           | `price - previous_price`                                                                                         | -0.50       | Proposed      | Null if `previous_price` missing.                                                |
| `price_change_pct`    | Signed percentage movement         | `100 * (price - previous_price) / previous_price`                                                               | -8.33%      | Proposed      | Null if `previous_price` missing or \<= 0.                                       |
| `discount_amount`     | Provisional observed drop          | `GREATEST(previous_price - price, 0)`                                                                            | 0.50        | Proposed      | Price-drop proxy only; discount baseline requires approval.                    |
| `discount_pct`        | Provisional drop percentage        | `100 * discount_amount / previous_price`                                                                        | 8.33%       | Proposed      | Null if baseline missing/invalid; not promo proof.                             |
| `observation_date`    | Required DATE-only observation key | `CAST(source.recorded_at AS DATE)` after agreed time-zone handling; retain latest source record per date         | 2026-09-16  | Required      | Gold contains a calendar date, not a timestamp.                                |
| `elapsed_days`        | Days since previous observed date  | `observation_date - LAG(observation_date) OVER (PARTITION BY product_id, retailer_id ORDER BY observation_date)` | 1           | Optional      | Integer day gap; null for the first observed date. No time-of-day calculation. |

## 8. Data Quality Requirements

- `product_id`, `retailer_id`, `price` and `observation_date` should not be null; source `recorded_at` must be present to derive the date.

- Prices should be greater than zero.

- Prevent duplicate product–retailer–`observation_date` rows in Gold; validate the source daily selection and any ties.

- Product and retailer IDs should maintain referential integrity with the relevant dimension tables.

- Derived percentage values should only be calculated where the denominator is valid.

- Late or corrected data should preserve historical consistency.

- Preserve raw observed values and source identifiers; do not replace prior facts with `silver.dim_products.price_current_*` or `silver.dim_products.price_last_*` snapshots.

- Track nulls and duplicate/conflicting business keys separately. Confirm whether zero/negative `unit_price` is valid for specific measurement units.

- Confirm the source time zone and daily date boundary, expected currency and GTIN validation policy before enforcing stricter checks.

## 9. Historical & Update Requirements

- Historical price information must be retained to support regression-model training.

- Append new product–retailer dates as source data becomes available; upsert the daily row if a later observation arrives for an existing date.

- Corrected records may require update behaviour rather than creating duplicate history.

- Required historical period: TBC with ML team.

- Update frequency: TBC, likely aligned with retailer ETL execution frequency.

- Treatment of late-arriving data: derive the observation date from its source `recorded_at`, reselect the daily record where needed, and recalculate subsequent previous-price values.

- Incremental loads must replay an approved source window and upsert by (`product_id`, `retailer_id`, `observation_date`). Later or corrected source observations can replace the selected daily row and require previous-price recalculation for subsequent dates.

- Define the daily cut-off and source time zone with ML. Derive Gold `observation_date` from source `recorded_at`, not ingestion `created_at`; retain the original timestamp in Silver for audit and correct daily selection. Retention, cadence and late-arrival SLA remain TBC.

## 10. Source-to-Gold Mapping

| **Source**                           | **Source Field**                                           | **Gold Field**                       | **Transformation**                                                                                         | **Notes**                                                                                                      |
|--------------------------------------|------------------------------------------------------------|--------------------------------------|------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| `silver.fct_product_prices`            | `id`                                                       | `observation_id`                       | Copy as stable source lineage ID.                                                                          | Verify unique, type and correction semantics.                                                                  |
| `silver.fct_product_prices`            | `product_id`, `retailer_id`                                    | `product_id`, `retailer_id`              | Copy; join to dimensions using IDs.                                                                        | Required; enforce foreign keys / reconciliation.                                                               |
| `silver.fct_product_prices`            | `recorded_at`                                                | `observation_date`                     | Convert source `recorded_at` to DATE in agreed time zone; select the latest source observation for that day. | Gold DATE only; use raw source timestamp internally to select a daily row. It is not proven price-change date. |
| `silver.fct_product_prices`            | `price`, `unit_price`                                      | `price`, `unit_price`                  | Copy numeric prices; validate \>0 for price.                                                               | Unit-price denominator and currency TBC.                                                                       |
| `silver.fct_product_prices`            | `is_on_special`, `special_text`                                | `is_on_special`, `special_text`          | Copy source promotion fields, preserving nulls.                                                            | Promotion meaning / text semantics TBC.                                                                        |
| `silver.fct_product_prices`            | `category_id`, `item_name`, `product_url`                        | Same named Gold fields               | Copy optional observation attributes.                                                                      | Category consistency with product dimension TBC.                                                               |
| `silver.dim_products`                  | `id -> product_id`                                         | `product_name`, `brand_name`, `gtin`   | Left join; select product metadata.                                                                        | Dimension metadata may be current, not point-in-time.                                                          |
| `silver.dim_categories`                | `id -> category_id`                                        | `category_name` (optional)             | Left join for readable category.                                                                           | Field exists; optional for ML feature set.                                                                     |
| `silver.dim_retailers`                 | `id -> retailer_id`                                        | `retailer_name` (optional)             | Left join; display name.                                                                                   | `website_url` is optional and is not required in the base contract.                                            |
| Fact observations                    | price + preceding price                                    | `previous_price`                       | LAG price by `product_id`, `retailer_id` ordered by `observation_date`, after daily selection.                   | Gold-derived; not a source column.                                                                             |
| Fact observations                    | price + `previous_price`                                     | `price_change_amount` / pct            | Signed amount and percent.                                                                                 | Null without valid `previous_price`.                                                                             |
| Fact observations                    | price + `previous_price`                                     | `discount_amount` / pct                | Provisional price-drop calculation only.                                                                   | Await approved reference-price definition.                                                                     |
| `silver.dim_products`                  | `price_current_*`, `price_last_*`                          | NOT historical Gold price            | Do not use as dated observation source.                                                                    | Current snapshots cannot establish daily observation history.                                                  |
| `silver.dim_products`                  | `prophet_*`, `xgboost_price_pred`, `true_value_classification` | Excluded from base forecasting input | Do not populate training features from predictions/labels.                                                 | Review separately to prevent target leakage.                                                                   |
| `silver.dim_products` / all dimensions | `created_at`, `updated_at`                                     | NOT `observation_date`                 | Keep audit timestamps separate if needed.                                                                  | Ingestion/update times are not the price observation date.                                                     |

## 11. Expected Output / Mock Data

| `product_id` | `retailer` | `observation_date` | `price` | `previous_price` | `discount_pct` |
|----------------|--------------|-----------------|-----------|--------------------|------------------|
| P001           | Woolworths   | 2026-09-14      | 6.00      | null               | null             |
| P001           | Woolworths   | 2026-09-15      | 6.00      | 6.00               | 0                |
| P001           | Woolworths   | 2026-09-16      | 5.50      | 6.00               | 8.33             |

Illustrative rows only (not a database extract). P001 is a placeholder identifier; `observation_date` is a DATE field, not a shortened timestamp. Example `discount_pct` represents a decrease from the previous daily price, not a verified retail promotion.

Illustrative special flags could be null, false or true independently of these calculated changes; only `silver.fct_product_prices.is_on_special` supplies the observed flag.

## 12. Dependencies

- Silver product dimension: `silver.dim_products` (canonical identity / optional metadata; retailer price snapshots are not time-series history).

- Silver price fact table: `silver.fct_product_prices` (observation history).

- `silver.dim_retailers` and optional `silver.dim_categories`; retailer ETL pipelines and the source time zone used to derive observation dates.

- ML regression-model requirements.

- Reliable observation-date derivation from source `recorded_at`.

- Potential API or model-serving layer depending on implementation.

## 13. Acceptance Criteria

- Gold provides valid product, retailer, price and DATE-only daily observation history.

- ML can reconstruct product price movement over time.

- Duplicate observations are controlled.

- Derived price-change fields are validated.

- The agreed historical period is available.

- The ML team confirms the dataset, target, forecast horizon, feature cut-off and any derived discount definition are suitable for regression-model training.

- Initial validation: compare Gold counts with distinct product–retailer–date groups in the fact; test one row per daily key, valid joins, ordered dates, first-date null `previous_price`, repeat loads, latest-observation selection and late-arrival recomputation.

- Discount acceptance is conditional on an agreed reference-price definition; the provisional decrease calculations alone do not certify promotion detection.

## 14. Responsibilities

- DE owns source assessment, transformation, Gold implementation and data-quality controls.

- ML/DA owns confirmation of prediction target, required model fields, historical window and acceptance of the resulting dataset.

## 15. Version & Change History

| Version             | Date       | Change                                                                                                                                                                                                                               | Owner  |
|---------------------|------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------|
| 1.1                 | 14/09/2026 | Original draft supplied; forecasting objective and draft sections.                                                                                                                                                                   | Savith |
| 1.2 (working draft) | 20/09/2026 | Date-only Gold contract: changed output to `observation_date` DATE, daily grain and latest-observation selection; revised deduplication, derivations, history, mappings, examples and decisions. Source `recorded_at` remains unchanged. | Savith |

## 16. Approval

- DE representative

- Consuming-team representative

- Relevant lead/stakeholder

- Approval date and status
