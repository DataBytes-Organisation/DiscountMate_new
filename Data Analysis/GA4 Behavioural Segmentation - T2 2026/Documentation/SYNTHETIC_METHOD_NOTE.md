> Historical synthetic-data record. These results do not describe the BigQuery run. See BIGQUERY_HANDOFF.md for the current real-data handoff.

# DiscountMate Synthetic Behavioural Dataset — Method Note

## Purpose

This synthetic dataset was generated for DA-01 behavioural clustering validation while real GA4 behavioural data continues to accumulate. It follows the **DA-01 Persona Archetype Definitions** and the **DA-01-T7 Behavioural Data Dictionary**.

## Dataset structure

The CSV contains **1,500 synthetic users** using the required proportions: 525 Budget-Conscious Shoppers (35%), 375 Family Planners (25%), 225 Health Enthusiasts (15%), 75 Convenience Seekers (5%), 75 Premium Shoppers (5%), and 225 low-signal residual users (15%). The residual group is generated as low-activity noise and is not treated as a persona.

The exported schema contains the required **12 behavioural features** plus `user_pseudo_id`, `reporting_window_start`, `reporting_window_end`, and `is_included_in_run`. `avg_percent_scrolled` is intentionally omitted because the source specification identifies the GA4 scroll instrumentation as having insufficient variance for T2 clustering. No archetype label is exported, so the CSV remains conformant with the behavioural data dictionary.

A single 14-day reporting window of **2026-08-17 to 2026-08-30** is used. This window was selected for this generated deliverable because no alternate agreed DA/ML date was supplied.

## Sampling and noise model

Generation uses fixed random seed **20260831**. For each behavioural feature, a base value is sampled uniformly inside the archetype-specific range and mild Gaussian noise is added with standard deviation equal to **10% of that feature's archetype range**. Values are clipped back to the supplied archetype bounds. Integer features are rounded to integers; continuous values remain floats.

The five affinity ratios are rejection-sampled until their combined value is **≤ 0.95**. `browsing_entropy` remains within `[0,1]`. `days_since_last_activity` is sampled subject to `days_since_last_activity <= days_since_first_visit`. Approximately 20% missingness requested for `days_since_first_visit` is implemented as exactly **300 users (20%)**, written as blank CSV values. `unique_pages_visited` is also capped by approximate total pageviews (`sessions_count × pageviews_per_session`) to avoid physically implausible records.

Rows are shuffled before export so users are not grouped by their generation archetype.

## Validation and deviations

Automated checks verify row count, unique user IDs, schema/order, ratio constraints, entropy bounds, recency constraints, the 20% missing-first-visit rate, reporting-window consistency, and that every generated non-missing behavioural value stays within its supplied archetype range.

Two specification details are intentionally called out rather than silently reconciled:

1. The low-signal residual range permits `avg_engagement_time_sec` values from **5–40 seconds**, while DA-01-T7 states that included users must have at least one session with at least 10 seconds engagement. Because the archetype document explicitly requires all 1,500 synthetic rows to have `is_included_in_run = 1`, the synthetic low-signal range is retained as supplied. Values below 10 seconds should be confirmed with DA/ML if the inclusion rule is intended to apply directly to this aggregate mean.
2. The raw synthetic file is not p99-capped or scaled. Values are already bounded by the archetype specification; Z-score or min-max scaling remains a downstream DA-01-T6 step.

## Execution

Setup the seed and settings:
```
SEED = 20260831
GENERATION_DATE = "20260831"
REPORTING_WINDOW_START = "2026-08-17"
REPORTING_WINDOW_END = "2026-08-30"
TOTAL_USERS = 1500
MISSING_FIRST_VISIT_COUNT = 300  # exactly 20% of 1,500
NOISE_FRACTION = 0.10
```

From the GA4 folder, run the generation script

```bash
python generate_discountmate_synthetic_users.py
```

## Data cleaning

The raw generated CSV is kept unchanged. From the GA4 folder, run the reproducible cleaning step with:

```bash
python3 clean_discountmate_data.py \
  --input Data/synthetic_users_20260831.csv \
  --output Data/cleaned_synthetic_users_20260831.csv \
  --report Documentation/cleaning_report.json
```

The script validates the documented schema, numeric types, ISO dates, unique IDs,
ratio bounds, recency ordering, and pageview consistency. It removes exact duplicate
rows and rows where `is_included_in_run` is `0` (neither occurs in the supplied
file). The 300 intentionally missing `days_since_first_visit` values are imputed
using the rounded observed median, raised to `days_since_last_activity` where needed
to preserve the recency constraint.

Outputs are `cleaned_synthetic_users_20260831.csv` and `cleaning_report.json`.
Scaling and p99 capping are not performed here because they belong to the downstream
DA-01-T6 modelling step.

The completed methodology, deviations, and modelling handoff are recorded in
`DATA_CLEANING_HANDOFF.md`. The historical synthetic team summary is retained in
`TANVI_TEAM_UPDATE.md`.

Run the cleaning regression tests with:

```bash
python3 -m unittest -v
```
