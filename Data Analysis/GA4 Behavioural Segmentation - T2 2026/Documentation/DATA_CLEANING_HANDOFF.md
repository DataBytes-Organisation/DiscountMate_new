> Historical synthetic-data record. These results do not describe the BigQuery run. See BIGQUERY_HANDOFF.md for the current real-data handoff.

# DiscountMate Data Cleaning Handoff

**Owner:** Tanvi  
**Scope:** Cleaning and validation of the synthetic behavioural dataset  
**Input:** `synthetic_users_20260831.csv`  
**Output:** `cleaned_synthetic_users_20260831.csv`

## Work completed

The source documentation and generation logic were reviewed before cleaning. The
raw CSV was preserved without modification, and all cleaning was implemented in
`clean_discountmate_data.py` so the process can be reproduced.

The following checks were completed:

- Exact schema and column-order validation
- Numeric and integer type validation
- ISO reporting-date validation and window-order checks
- Duplicate-row and duplicate-user-ID checks
- Missing-value profiling
- Non-negative count and duration checks
- Individual ratio and entropy bounds of `[0, 1]`
- Combined affinity-ratio limit of `<= 0.95`
- Recency constraint: `days_since_last_activity <= days_since_first_visit`
- Physical consistency between unique pages and approximate total pageviews
- Inclusion-flag filtering
- Post-write verification by reopening and validating the cleaned CSV
- SHA-256 checksums for the source and cleaned files in `cleaning_report.json`

## Cleaning results

| Check | Result |
|---|---:|
| Input rows | 1,500 |
| Output rows | 1,500 |
| Exact duplicates removed | 0 |
| Duplicate user IDs | 0 |
| Excluded rows removed | 0 |
| Missing values before cleaning | 300 |
| Missing values after cleaning | 0 |
| Final unique users | 1,500 |
| Final validation | PASS |

All 300 missing values occurred in `days_since_first_visit`, matching the 20%
missingness documented in the README. The observed median was 9 days. Missing
values were imputed with 9, except where that would violate the recency constraint;
two records were raised to 10 days to match `days_since_last_activity`.

## Differences and decisions relative to T3/T7

1. **Missing-value treatment:** The source dataset deliberately contains 20%
   missingness in `days_since_first_visit`. The cleaning implementation uses
   constraint-aware median imputation. This decision must be recorded because it
   is an implementation choice rather than a supplied archetype value.
2. **`avg_percent_scrolled`:** This feature is not present in the source CSV. The
   README states that it was intentionally omitted because the GA4 scroll measure
   had insufficient variance. The cleaning step cannot restore an unavailable
   source feature and therefore preserves the documented 12-feature schema.
3. **Low-engagement records:** There are 32 low-signal residual users with
   `avg_engagement_time_sec` below 10 seconds. They remain in the output because
   the source specification sets `is_included_in_run = 1` for all 1,500 users and
   the README explicitly documents this conflict.
4. **Outlier capping:** No p99 capping was applied. The synthetic values are already
   bounded by their archetype ranges, and the README assigns p99 treatment to the
   downstream DA-01-T6 stage.
5. **Scaling:** No scaling was applied during cleaning. The cleaned master dataset
   remains unscaled so transformations can be applied consistently by each model.
   The team has reported that Carlin used Min-Max scaling for both models, while
   T3/T7 specify Z-score standardisation for K-means and Min-Max normalisation for
   DBSCAN. The final modelling documentation must state which approach was actually
   used and why.

## Handoff to transformation and modelling

- Use `cleaned_synthetic_users_20260831.csv`, not the raw CSV, as the transformation input.
- Use only the 12 behavioural features for clustering. Do not include the user ID,
  reporting dates, or inclusion flag as model features.
- Do not impute `days_since_first_visit` again; the cleaned output is complete.
- Fit scaling parameters on the modelling/training data only and record the scaler
  used for each model.
- Preserve `user_pseudo_id` separately so cluster assignments can be joined back to users.
- Record the exclusion of `avg_percent_scrolled` and the retained low-engagement
  exception in the final report.

## Confirmation required from the team

Before the final modelling run, the DA/ML team should confirm that the
constraint-aware median imputation is accepted. Carlin should also confirm that the
cleaned CSV is the transformation input and document the final scaling choice. These
are human approvals and are intentionally not represented as completed in this handoff.

## Reproduction

From the GA4 folder (one level above this Documentation folder), run:

```bash
python3 clean_discountmate_data.py \
  --input Data/synthetic_users_20260831.csv \
  --output Data/cleaned_synthetic_users_20260831.csv \
  --report Documentation/cleaning_report.json
```

The command regenerates the cleaned CSV, writes `cleaning_report.json`, reopens the
output, and fails if any final schema, row-count, uniqueness, missing-value, or
constraint check does not pass.

Run the regression tests with:

```bash
python3 -m unittest -v
```
