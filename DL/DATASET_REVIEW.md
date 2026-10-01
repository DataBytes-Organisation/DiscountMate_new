# DL-04 Dataset Review

## Purpose

Review the sample retailer pricing dataset provided for the DL-04 Price & Discount Forecasting feature.

## Dataset Summary

- Total records: 3,000
- Retailers: 3
- Products: 2,621
- Categories: 18
- Date range: 25 January 2026 – 15 May 2026
- Promotional records: 389 (12.97%)

## Data Quality Findings

- No duplicate rows detected.
- No duplicate product-retailer-date observations detected.
- No invalid price values detected.
- 158 records have missing `unit_price`.
- `special_text` is missing for most records, which is expected for products not on promotion.

## Time Series Findings

- Product histories range from 1 to 4 observations.
- Most products currently have only a single historical observation.

## Contribution

A reusable Python profiling script was created to validate the real forecasting dataset before preprocessing and model development.